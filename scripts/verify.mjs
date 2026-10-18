#!/usr/bin/env node
// 单一验证入口：
//   node scripts/verify.mjs --quick   # 纯逻辑/静态/编号/链接（无需 Docker/PG）
//   node scripts/verify.mjs [--full]  # preflight + 真实 PG 测试 + 全部机械检查 + compose 配置
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const QUICK = process.argv.includes("--quick");
const results = [];

function step(name, command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout: 600_000, ...options });
  const ok = result.status === 0;
  results.push({ name, ok });
  process.stdout.write(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` (exit ${result.status})`}\n`);
  if (!ok) process.stdout.write(String(result.stderr ?? result.stdout ?? "").split(/\r?\n/).slice(-10).join("\n") + "\n");
  return ok;
}

if (QUICK) {
  const files = [
    "tests/domain.test.mjs",
    "tests/controller.test.mjs",
    "tests/app.test.mjs",
    "tests/assets.test.mjs",
    "tests/client.test.mjs",
    "tests/contracts.test.mjs",
    "tests/static-scan.test.mjs",
    "tests/layering.test.mjs",
  ];
  const ok = step("node --test (quick)", process.execPath, ["--test", ...files]);
  if (ok) {
    step("check-links", process.execPath, ["scripts/check-links.mjs"]);
    step("check-numbering", process.execPath, ["scripts/check-numbering.mjs"]);
    step("check-traceability", process.execPath, ["scripts/check-traceability.mjs"]);
    step("check-redaction", process.execPath, ["scripts/check-redaction.mjs"]);
    step("check-docs-stale", process.execPath, ["scripts/check-docs-stale.mjs"]);
  }
} else {
  step("preflight --full", process.execPath, ["scripts/preflight.mjs", "--full"]);
  step("node --test --test-concurrency=4", process.execPath, ["--test", "--test-concurrency=4"]);
  step("check-links", process.execPath, ["scripts/check-links.mjs"]);
  step("check-numbering", process.execPath, ["scripts/check-numbering.mjs"]);
  step("check-traceability", process.execPath, ["scripts/check-traceability.mjs"]);
  step("check-redaction", process.execPath, ["scripts/check-redaction.mjs"]);
  step("check-docs-stale", process.execPath, ["scripts/check-docs-stale.mjs"]);
  step("verify-evidence", process.execPath, ["scripts/verify-evidence.mjs"]);
  step("check-compose", process.execPath, ["scripts/check-compose.mjs"]);
}

const failed = results.filter((item) => !item.ok);
process.stdout.write(`\n${failed.length === 0 ? "PASS" : "FAIL"}: ${results.length - failed.length}/${results.length} 项通过${QUICK ? "（quick）" : "（full）"}\n`);
process.exit(failed.length === 0 ? 0 : 1);
