#!/usr/bin/env node
// 课堂并排演示：同时启动 R1（4173，冻结展品）与 R2（4174，本目录）。
// 用法：node scripts/start-both.mjs
// 说明：只启动进程，不修改 r1-fruitlab 任何文件；Ctrl+C 同时停止两边。
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const R2_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R1_ROOT = path.resolve(R2_ROOT, "..", "r1-fruitlab");

if (!fs.existsSync(path.join(R1_ROOT, "serve.mjs"))) {
  console.error(`找不到 R1 目录：${R1_ROOT}`);
  console.error("请确认 r1-fruitlab 与 r2-fruitlab 是同级目录（课堂展品需冻结在原位）。");
  process.exit(2);
}

const children = [];

function start(label, cwd, args) {
  const child = spawn(process.execPath, args, { cwd, stdio: "inherit" });
  child.on("exit", (code, signal) => {
    console.log(`[${label}] 退出 code=${code} signal=${signal ?? "-"}`);
    if (code && code !== 0) process.exitCode = code;
  });
  children.push({ label, child });
  return child;
}

console.log("FruitLab 并排演示");
console.log(`  R1（升级前，冻结）: ${R1_ROOT}  ->  http://127.0.0.1:4173`);
console.log(`  R2（升级后）      : ${R2_ROOT}  ->  http://127.0.0.1:4174`);
console.log("Ctrl+C 同时停止两边。\n");

start("R1", R1_ROOT, ["serve.mjs"]);
start("R2", R2_ROOT, ["cli.mjs", "--db", "data/fruitlab.db", "dev"]);

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log("\n正在停止…");
  for (const { label, child } of children) {
    if (child.exitCode === null) {
      console.log(`  stop ${label} (pid ${child.pid})`);
      child.kill("SIGTERM");
    }
  }
  setTimeout(() => process.exit(0), 800);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
