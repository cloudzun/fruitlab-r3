// 按白名单生成 web 静态目录：public/。缺文件即失败（G1 机械保证）。
import fs from "node:fs";
import path from "node:path";
import { PUBLIC_ALLOWLIST } from "../server/allowlist.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const outIndex = process.argv.indexOf("--out");
const OUT = path.resolve(ROOT, outIndex === -1 ? "public" : process.argv[outIndex + 1]);

function copy(relative) {
  const source = path.join(ROOT, relative);
  if (!fs.existsSync(source)) {
    throw new Error(`allowlist file missing: ${relative}`);
  }
  const target = path.join(OUT, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

const files = PUBLIC_ALLOWLIST.map((item) => item.replace(/^\//, ""));
for (const file of files) copy(file);
for (const file of fs.readdirSync(path.join(ROOT, "assets", "images", "products"))) {
  if (file.endsWith(".jpg")) copy(path.join("assets", "images", "products", file));
}
const count = files.length + fs.readdirSync(path.join(ROOT, "assets", "images", "products")).filter((file) => file.endsWith(".jpg")).length;
process.stdout.write(`public built: ${count} files -> ${path.relative(ROOT, OUT)}\n`);
