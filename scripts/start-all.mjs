// 三版本课堂启动器：R1(4173) + R2(4174, 仓库外临时 SQLite 文件) + R3(4175, compose)。
// 只启动进程，不修改 R1/R2 文件；Ctrl+C 先停 R3 再停 Node。
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R1 = path.resolve(ROOT, "..", "r1-fruitlab");
const R2 = path.resolve(ROOT, "..", "r2-fruitlab");
const NODE = process.execPath;
const R2_DB = path.join(os.tmpdir(), "fruitlab-r2-demo.db");

function hasNativeDocker() {
  return spawnSync("docker", ["info"], { stdio: "ignore", timeout: 15000 }).status === 0;
}

function wslPath(winPath) {
  return winPath.replace(/^([A-Za-z]):\\/, (_, drive) => `/mnt/${drive.toLowerCase()}/`).replace(/\\/g, "/");
}

const native = hasNativeDocker();
const children = [];

function startNode(name, cwd, args) {
  const child = spawn(NODE, args, { cwd, stdio: "inherit", env: process.env });
  child.on("exit", (code) => process.stdout.write(`[${name}] exited ${code}\n`));
  children.push({ name, child });
}

if (!native) {
  const info = spawnSync("wsl", ["-e", "docker", "info"], { stdio: "ignore", timeout: 20000 });
  if (info.status !== 0) {
    process.stderr.write("Docker 不可用（原生与 WSL 都失败）；R1/R2 仍可单独启动。\n");
  }
}

startNode("R1", R1, [path.join(R1, "serve.mjs")]);
startNode("R2", R2, [path.join(R2, "cli.mjs"), "--db", R2_DB, "dev"]);

let r3;
if (native) {
  r3 = spawn("docker", ["compose", "-f", path.join(ROOT, "docker-compose.yml"), "up", "--build"], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
} else {
  r3 = spawn("wsl", ["-e", "docker", "compose", "-f", `${wslPath(ROOT)}/docker-compose.yml`, "up", "--build"], {
    stdio: "inherit",
    env: process.env,
  });
}
children.push({ name: "R3", child: r3 });

process.stdout.write(
  [
    "FruitLab 三版本启动中：",
    "  R1  http://127.0.0.1:4173  (localStorage)",
    "  R2  http://127.0.0.1:4174  (SQLite 文件: " + R2_DB + ")",
    "  R3  http://127.0.0.1:4175  (Postgres volume + L1/L2)",
    "Ctrl+C 停止全部；R3 使用 docker compose down（不删卷）。",
    "",
  ].join("\n"),
);

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  process.stdout.write("\n正在停止...\n");
  for (const { child } of children) {
    if (child && child.exitCode === null) child.kill("SIGINT");
  }
  const composeArgs = native
    ? ["compose", "-f", path.join(ROOT, "docker-compose.yml"), "down"]
    : ["-e", "docker", "compose", "-f", `${wslPath(ROOT)}/docker-compose.yml`, "down"];
  spawnSync(native ? "docker" : "wsl", composeArgs, { stdio: "inherit", timeout: 120000 });
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
