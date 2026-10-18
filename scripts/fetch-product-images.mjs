#!/usr/bin/env node
// 可复跑的商品图片抓取：Openverse API（CC0/CC BY）→ 下载 → 校验 JPEG → 写台账。
// 用法：node scripts/fetch-product-images.mjs [--only <productId>]
// 说明：真实联网下载；失败项如实报告，不用占位图或 AI 图冒充。
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "assets", "images", "products");
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;

const TARGETS = [
  ["fuji-apple", "red delicious apple"],
  ["banana", "bananas white background"],
  ["navel-orange", "navel oranges"],
  ["shine-muscat", "green grapes"],
  ["golden-pineapple", "pineapple on white background"],
  ["durian", "durian fruit whole"],
  ["hami-melon", "cantaloupe melon fruit"],
  ["peach", "peaches fruit"],
  ["blueberry", "blueberries"],
  ["red-dragon-fruit", "dragon fruit"],
  ["cherry", "cherries"],
  ["mango", "mango fruit"],
  ["kiwi", "kiwi fruit"],
  ["strawberry", "strawberries"],
];

const UA = "FruitLab-R2-TeachingDemo/2.0 (local classroom demo; image attribution kept in repo)";

const REJECT = {
  cherry: /blossom|wine|tree|flower|orchard|drink|juice|cake|pie|bottle/i,
  "golden-pineapple": /macro|texture|skin|leaf|plant|field|slice|juice|drink|lamb|cracker|goldbear|plantation/i,
  mango: /tree|leaf|slice|juice|smoothie|market|chutney/i,
  "navel-orange": /cocktail|drink|glass|juice|smoothie|wine|bottle|tree|blossom|slice/i,
  durian: /market|stall|shop|hanging|tree|plantation|field|sign/i,
  "hami-melon": /market|stall|shop|tree|field|sign|stand/i,
  blueberry: /bar|cafe|drink|juice|smoothie|dessert|cake|pancake|market|wine|cocktail/i,
  peach: /tree|blossom|orchard|field|market|stall/i,
};
const MIN_SHORT_SIDE = 600;;

function jpegSize(buffer) {
  let i = 2;
  while (i < buffer.length) {
    if (buffer[i] !== 0xff) { i += 1; continue; }
    const marker = buffer[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: buffer.readUInt16BE(i + 7), height: buffer.readUInt16BE(i + 5) };
    }
    const length = buffer.readUInt16BE(i + 2);
    i += 2 + length;
  }
  return null;
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function search(query) {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license=cc0,by&page_size=10`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`openverse ${res.status}`);
  const json = await res.json();
  return json.results ?? [];
}

function candidateUrls(result) {
  const urls = [];
  for (const value of [result.thumbnail, result.url]) {
    if (typeof value === "string" && /\.(jpe?g)(\?|$)/i.test(value)) urls.push(value);
  }
  return urls;
}

async function download(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const isJpeg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  return { buffer, isJpeg };
}

const manifest = fs.existsSync(path.join(ROOT, "evidence", "assets-manifest.json"))
  ? JSON.parse(fs.readFileSync(path.join(ROOT, "evidence", "assets-manifest.json"), "utf8"))
  : [];
const byId = new Map(manifest.map((entry) => [entry.product_id, entry]));
const failures = [];

for (const [productId, query] of TARGETS) {
  if (only && productId !== only) continue;
  if (byId.has(productId)) {
    console.log(`${productId}: 已存在，跳过`);
    continue;
  }
  let saved = false;
  try {
    const results = await search(query);
    for (const result of results) {
      if (REJECT[productId] && REJECT[productId].test(String(result.title ?? ""))) continue;
      if (Number.isFinite(result.width) && Number.isFinite(result.height)) {
        if (Math.min(result.width, result.height) < MIN_SHORT_SIDE) continue;
      }
      for (const url of candidateUrls(result)) {
        try {
          const { buffer, isJpeg } = await download(url);
          if (!isJpeg || buffer.length > 300 * 1024 || buffer.length < 10 * 1024) continue;
          fs.mkdirSync(OUT_DIR, { recursive: true });
          const file = path.join(OUT_DIR, `${productId}.jpg`);
          fs.writeFileSync(file, buffer);
          const entry = {
            product_id: productId,
            file: `assets/images/products/${productId}.jpg`,
            sha256: sha256(buffer),
            width: jpegSize(buffer)?.width ?? null,
            height: jpegSize(buffer)?.height ?? null,
            bytes: buffer.length,
            title: result.title ?? "",
            creator: result.creator ?? "",
            license: result.license ?? "",
            license_url: result.license_url ?? "",
            source_url: result.foreign_landing_url ?? "",
            retrieved_at: new Date().toISOString(),
          };
          byId.set(productId, entry);
          console.log(`${productId}: OK ${buffer.length}B ${entry.license} ${entry.source_url}`);
          saved = true;
          break;
        } catch (error) {
          // 尝试下一个候选
        }
      }
      if (saved) break;
    }
    if (!saved) {
      failures.push(productId);
      console.log(`${productId}: 未找到合适 JPEG（CC0/BY）`);
    }
  } catch (error) {
    failures.push(productId);
    console.log(`${productId}: 失败 ${error.message}`);
  }
}

const entries = TARGETS.map(([id]) => byId.get(id)).filter(Boolean);
for (const entry of entries) {
  if (!entry.width || !entry.height) {
    const size = jpegSize(fs.readFileSync(path.join(ROOT, entry.file)));
    if (size) { entry.width = size.width; entry.height = size.height; }
  }
}
fs.mkdirSync(path.join(ROOT, "evidence"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "evidence", "assets-manifest.json"), JSON.stringify(entries, null, 2));

const credits = [
  "# 商品图片来源与授权（R2）",
  "",
  "> 全部为仓库内本地文件（CSP `img-src 'self'`）。来源、作者与授权逐张记录；CC BY 需署名。",
  "> 由 `scripts/fetch-product-images.mjs` 与 Wikimedia Commons 精选取图；授权为 CC0 / CC BY / CC BY-SA / Public Domain（逐张记录，CC BY 与 CC BY-SA 均署名）。",
  "",
  "| 商品 | 文件 | 尺寸 | 标题 | 作者 | 授权 | 来源 |",
  "|---|---|---|---|---|---|",
  ...entries.map((e) => `| ${e.product_id} | \`${e.file}\` | ${e.width ?? "?"}x${e.height ?? "?"} | ${e.title.replace(/\|/g, "/")} | ${e.creator.replace(/\|/g, "/")} | ${e.license} | ${e.source_url} |`),
  "",
  `共 ${entries.length} 张；缺失：${failures.length ? failures.join(", ") : "无"}。`,
  "",
  "## 尺寸说明",
  "",
  (() => {
    const small = entries.filter((e) => e.width && e.height && Math.min(e.width, e.height) < 800);
    if (small.length === 0) return "全部图片短边 ≥ 800px。";
    return "以下图片短边低于 SPEC §5.8 建议的 800px（仍为真实照片，**如实记录**）：" + small.map((e) => `${e.product_id}（${e.width}x${e.height}）`).join("、") + "。";
  })(),
  "",
].join("\n");
fs.writeFileSync(path.join(ROOT, "docs", "assets-credits.md"), credits);

console.log(`\n完成：${entries.length}/14；缺失：${failures.join(", ") || "无"}`);
process.exit(entries.length === 14 ? 0 : 1);
