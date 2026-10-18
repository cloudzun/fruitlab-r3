// 环境预检：Node/npm/Docker/Compose/.env/测试 Postgres。
// 用法：node scripts/preflight.mjs [--full]
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";

const ROOT = path.resolve(import.meta.dirname, "..");
const FULL = process.argv.includes("--full");
const rows = [];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 30000, ...options });
  return { ok: result.status === 0, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

const nodeMajor = Number(process.versions.node.split(".")[0]);
rows.push(["node", nodeMajor >= 22 ? "PASS" : "FAIL", process.versions.node]);

const npm = run(process.platform === "win32" ? "npm.cmd" : "npm", ["--version"], { shell: process.platform === "win32" });
rows.push(["npm", npm.ok ? "PASS" : "FAIL", npm.ok ? npm.stdout.trim() : "not found"]);

let engine = "none";
if (run("docker", ["info"]).ok) engine = "native";
else if (run("wsl", ["-e", "docker", "info"]).ok) engine = "wsl";
rows.push(["docker engine", engine === "none" ? "FAIL" : "PASS", engine]);

let composeOk = false;
if (engine === "native") composeOk = run("docker", ["compose", "version"]).ok;
else if (engine === "wsl") composeOk = run("wsl", ["-e", "docker", "compose", "version"]).ok;
rows.push(["docker compose", composeOk ? "PASS" : "FAIL", composeOk ? "available" : "not available"]);

rows.push([".env", fs.existsSync(path.join(ROOT, ".env")) ? "PASS" : "WARN", fs.existsSync(path.join(ROOT, ".env")) ? "present" : "missing (cp .env.example .env)"]);

const portOpen = await new Promise((resolve) => {
  const socket = net.connect({ host: "127.0.0.1", port: 55432 });
  const done = (value) => {
    socket.destroy();
    resolve(value);
  };
  socket.setTimeout(1000);
  socket.once("connect", () => done(true));
  socket.once("timeout", () => done(false));
  socket.once("error", () => done(false));
});
rows.push(["test postgres 55432", portOpen ? "PASS" : "WARN", portOpen ? "open" : "closed (node scripts/pgctl.mjs up)"]);

if (FULL && portOpen) {
  try {
    const { default: pg } = await import("pg");
    const client = new pg.Client({
      connectionString: process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55432/postgres",
      connectionTimeoutMillis: 3000,
    });
    await client.connect();
    await client.query("SELECT 1");
    await client.end();
    rows.push(["test postgres query", "PASS", "SELECT 1"]);
  } catch (error) {
    rows.push(["test postgres query", "FAIL", String(error.message).slice(0, 120)]);
  }
}

for (const [name, status, detail] of rows) process.stdout.write(`${status.padEnd(4)} ${name.padEnd(22)} ${detail}\n`);
const failed = rows.filter(([, status]) => status === "FAIL").length;
process.stdout.write(`\npreflight: ${rows.length - failed}/${rows.length} checks passed${FULL ? " (full)" : ""}\n`);
process.exitCode = failed > 0 ? 1 : 0;
