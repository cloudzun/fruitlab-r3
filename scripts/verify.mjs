#!/usr/bin/env node
// 单一验证入口：测试 + 链接 + 编号 + 追溯 + 证据清单。
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const steps = [
  ["node --test", [process.execPath, ["--test"]]],
  ["check-links", [process.execPath, ["scripts/check-links.mjs"]]],
  ["check-numbering", [process.execPath, ["scripts/check-numbering.mjs"]]],
  ["check-traceability", [process.execPath, ["scripts/check-traceability.mjs"]]],
  ["verify-evidence", [process.execPath, ["scripts/verify-evidence.mjs"]]],
];

const results = [];
for (const [name, [command, args]] of steps) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout: 600_000 });
  const ok = result.status === 0;
  results.push({ name, ok, status: result.status });
  process.stdout.write(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` (exit ${result.status})`}\n`);
  if (!ok) process.stdout.write(String(result.stderr ?? "").split(/\r?\n/).slice(-8).join("\n") + "\n");
}

const failed = results.filter((r) => !r.ok);
process.stdout.write(`\n${failed.length === 0 ? "PASS" : "FAIL"}: ${results.length - failed.length}/${results.length} 项通过\n`);
process.exit(failed.length === 0 ? 0 : 1);
