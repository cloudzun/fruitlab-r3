// 测试 Postgres 生命周期：up | status | down（WSL 或原生 Docker 自动探测）。
import { spawnSync } from "node:child_process";
import net from "node:net";

const NAME = "fruitlab-r3-test-pg";
const PORT = 55432;

function engine() {
  if (spawnSync("docker", ["info"], { stdio: "ignore", timeout: 15000 }).status === 0) return ["docker"];
  if (spawnSync("wsl", ["-e", "docker", "info"], { stdio: "ignore", timeout: 20000 }).status === 0) return ["wsl", "-e", "docker"];
  throw new Error("Docker 引擎不可用（原生与 WSL 都失败）；先启动 Docker Desktop 或 WSL docker");
}

function docker(args, options = {}) {
  const [command, ...prefix] = engine();
  const result = spawnSync(command, [...prefix, ...args], { encoding: "utf8", timeout: 120000, ...options });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function portOpen() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port: PORT });
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(800);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function waitReady(timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ready = docker(["exec", NAME, "pg_isready", "-U", "postgres", "-d", "postgres"]);
    if (ready.status === 0) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

const command = process.argv[2];
if (!["up", "status", "down"].includes(command)) {
  process.stdout.write("usage: node scripts/pgctl.mjs up|status|down\n");
  process.exitCode = 2;
} else if (command === "up") {
  docker(["rm", "-f", NAME]);
  const result = docker([
    "run", "-d", "--rm", "--name", NAME,
    "-e", "POSTGRES_PASSWORD=postgres",
    "-e", "POSTGRES_DB=fruitlab",
    "-p", `${PORT}:5432`,
    "postgres:16-alpine",
  ]);
  if (result.status !== 0) {
    process.stderr.write(`${result.stderr}\n`);
    process.exitCode = 1;
  } else if (!(await waitReady())) {
    process.stderr.write("test postgres did not become ready in 60s\n");
    process.exitCode = 1;
  } else {
    process.stdout.write(`test postgres ready on 127.0.0.1:${PORT} (${NAME})\n`);
  }
} else if (command === "status") {
  const ps = docker(["ps", "--filter", `name=^${NAME}$`, "--format", "{{.Status}}"]);
  const open = await portOpen();
  process.stdout.write(`container: ${ps.stdout.trim() || "not running"}\nport ${PORT}: ${open ? "open" : "closed"}\n`);
  process.exitCode = ps.stdout.trim() && open ? 0 : 1;
} else {
  docker(["rm", "-f", NAME]);
  process.stdout.write(`removed ${NAME}\n`);
}
