#!/usr/bin/env node
// 编号一致性：AC-* 必须在 SPEC 定义；OB-* 必须在 DECISIONS 定义；
// 文档中引用的编号必须可解析，不允许悬空。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];

function read(name) {
  const p = path.join(ROOT, name);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

const spec = read("SPEC.md");
const decisions = read("DECISIONS.md");
const acDefined = new Set([...spec.matchAll(/^\| (AC-\d+) \|/gm)].map((m) => m[1]));
const obDefined = new Set([...decisions.matchAll(/^\| (OB-[A-Z]+-\d{2}) \|/gm)].map((m) => m[1]));

const documents = ["SPEC.md", "DECISIONS.md", "BUILD.md", "README.md", "review.md", "qa-report.md", "retro.md"];
for (const name of documents) {
  const text = read(name);
  if (!text) continue;
  for (const match of text.matchAll(/\b(AC-\d+)\b/g)) {
    if (!acDefined.has(match[1])) problems.push(`${name}: ${match[1]} 未在 SPEC.md 定义`);
  }
  for (const match of text.matchAll(/\b(OB-[A-Z]+-\d{2})\b/g)) {
    if (!obDefined.has(match[1])) problems.push(`${name}: ${match[1]} 未在 DECISIONS.md 定义`);
  }
}

if (acDefined.size < 40) problems.push(`SPEC.md 的 AC 数量异常: ${acDefined.size}`);
if (obDefined.size !== 42) problems.push(`DECISIONS.md 的义务数量应为 42，实际 ${obDefined.size}`);

if (problems.length > 0) {
  console.error(problems.join("\n"));
  console.error(`FAIL: ${problems.length} 个编号问题`);
  process.exit(1);
}
console.log(`PASS: 编号一致（AC ${acDefined.size} 条，OB ${obDefined.size} 条）`);
