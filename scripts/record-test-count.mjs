#!/usr/bin/env node
// 唯一测试计数：运行 node --test，把命令、原始输出、git hash、时间写入 evidence/test-count.txt。
// 其它文档只允许引用该文件，不得手写计数。
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(process.execPath, ["--test"], { cwd: ROOT, encoding: "utf8", timeout: 300_000 });
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
const summary = {};
for (const key of ["tests", "pass", "fail", "skipped", "cancelled", "todo"]) {
  const match = output.match(new RegExp(`^# ${key} (\\d+)$`, "m"));
  if (match) summary[key] = Number(match[1]);
}
const git = spawnSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" });
const hash = (git.stdout ?? "").trim() || "unknown";
const timestamp = new Date().toISOString();
const tail = output.split(/\r?\n/).filter(Boolean).slice(-30).join("\n");
const body = [
  "# 测试计数（唯一权威来源）",
  "",
  `- 命令: node --test`,
  `- 时间: ${timestamp}`,
  `- git: ${hash}`,
  `- 结果: tests=${summary.tests ?? "?"} pass=${summary.pass ?? "?"} fail=${summary.fail ?? "?"} skipped=${summary.skipped ?? "?"} todo=${summary.todo ?? "?"}`,
  "",
  "## 原始输出（尾部）",
  "",
  "```text",
  tail,
  "```",
  "",
  "> 其它文档出现计数时必须引用本文件；不得手写数字。",
  "",
].join("\n");
fs.mkdirSync(path.join(ROOT, "evidence"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "evidence", "test-count.txt"), body);
console.log(`测试计数已写入 evidence/test-count.txt: tests=${summary.tests} pass=${summary.pass} fail=${summary.fail}`);
process.exit((summary.fail ?? 1) === 0 ? 0 : 1);
