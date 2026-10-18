#!/usr/bin/env node
// 证据清单：evidence/manifest.json 记录逐文件 SHA-256。
// 用法：node scripts/verify-evidence.mjs --write   # 生成/更新清单
//       node scripts/verify-evidence.mjs           # 校验清单与磁盘一致
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EVIDENCE = path.join(ROOT, "evidence");
const MANIFEST = path.join(EVIDENCE, "manifest.json");
const write = process.argv.includes("--write");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

const files = walk(EVIDENCE)
  .filter((file) => path.resolve(file) !== path.resolve(MANIFEST))
  .map((file) => path.relative(ROOT, file).split(path.sep).join("/"))
  .sort();

if (write) {
  const entries = files.map((file) => ({ file, sha256: sha256(path.join(ROOT, file)), bytes: fs.statSync(path.join(ROOT, file)).size }));
  fs.writeFileSync(MANIFEST, JSON.stringify({ generatedAt: new Date().toISOString(), files: entries }, null, 2));
  console.log(`PASS: 证据清单已生成（${entries.length} 个文件）`);
  process.exit(0);
}

if (!fs.existsSync(MANIFEST)) {
  console.error("FAIL: evidence/manifest.json 不存在；先运行 node scripts/verify-evidence.mjs --write");
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const problems = [];
const listed = new Set(manifest.files.map((entry) => entry.file));
for (const entry of manifest.files) {
  const full = path.join(ROOT, entry.file);
  if (!fs.existsSync(full)) problems.push(`缺失: ${entry.file}`);
  else if (sha256(full) !== entry.sha256) problems.push(`哈希不一致: ${entry.file}`);
}
for (const file of files) {
  if (!listed.has(file)) problems.push(`未入清单: ${file}`);
}
if (problems.length > 0) {
  console.error(problems.join("\n"));
  console.error(`FAIL: ${problems.length} 个证据问题`);
  process.exit(1);
}
console.log(`PASS: 证据清单一致（${manifest.files.length} 个文件）`);
