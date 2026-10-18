#!/usr/bin/env node
// 义务追溯：每条 OB 必须出现在 BUILD.md 验收表；每个 AC 必须有映射。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];

const decisions = fs.readFileSync(path.join(ROOT, "DECISIONS.md"), "utf8");
const obIds = [...decisions.matchAll(/^\| (OB-R3-[A-Z]+-\d{2}) \|/gm)].map((m) => m[1]);

const buildPath = path.join(ROOT, "BUILD.md");
if (!fs.existsSync(buildPath)) {
  console.error("FAIL: BUILD.md 不存在，义务追溯无法核对");
  process.exit(1);
}
const build = fs.readFileSync(buildPath, "utf8");
const spec = fs.readFileSync(path.join(ROOT, "SPEC.md"), "utf8");
const acIds = [...spec.matchAll(/^\| (AC-\d+) \|/gm)].map((m) => m[1]);

for (const id of obIds) {
  if (!build.includes(id)) problems.push(`BUILD.md 未引用 ${id}`);
}
for (const id of acIds) {
  if (!build.includes(id)) problems.push(`BUILD.md 未引用 ${id}`);
}

if (obIds.length !== 42) problems.push(`DECISIONS.md 义务数量应为 42，实际 ${obIds.length}`);
if (acIds.length < 60) problems.push(`SPEC.md AC 数量异常: ${acIds.length}`);

if (problems.length > 0) {
  console.error(problems.slice(0, 50).join("\n"));
  console.error(`FAIL: ${problems.length} 个追溯缺口`);
  process.exit(1);
}
console.log(`PASS: 追溯完整（OB ${obIds.length} 条、AC ${acIds.length} 条均进入 BUILD.md）`);
