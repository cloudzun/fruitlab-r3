#!/usr/bin/env node
// 链接与白名单校验：白名单条目、页面本地引用、文档内部链接必须存在。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_ALLOWLIST } from "../serve.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];

function toFile(p) {
  return path.join(ROOT, p.replace(/^\/+/, ""));
}

for (const entry of PUBLIC_ALLOWLIST) {
  if (!fs.existsSync(toFile(entry))) problems.push(`白名单文件不存在: ${entry}`);
}

const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
for (const match of indexHtml.matchAll(/(?:href|src)="([^"]+)"/g)) {
  const ref = match[1];
  if (/^(https?:|data:|mailto:|#)/.test(ref)) continue;
  const clean = ref.replace(/^\.\//, "").split("?")[0].split("#")[0];
  if (clean === "") continue;
  if (!fs.existsSync(toFile(clean))) problems.push(`index.html 引用了不存在的文件: ${ref}`);
}

for (const file of fs.readdirSync(path.join(ROOT, "docs"))) {
  if (!file.endsWith(".md")) continue;
  const text = fs.readFileSync(path.join(ROOT, "docs", file), "utf8");
  for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
    const ref = match[1];
    if (/^(https?:|mailto:|#)/.test(ref)) continue;
    const clean = ref.split("#")[0];
    if (clean === "") continue;
    const target = path.resolve(path.join(ROOT, "docs"), clean);
    if (!fs.existsSync(target)) problems.push(`docs/${file} 引用了不存在的文件: ${ref}`);
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  console.error(`FAIL: ${problems.length} 个链接/白名单问题`);
  process.exit(1);
}
console.log("PASS: 白名单与本地链接全部存在");
