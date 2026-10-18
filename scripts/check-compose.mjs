// compose 配置检查：优先原生 Docker，其次 WSL。配置不可解析即失败。
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: "utf8", timeout: 60000, ...options });
}

const plain = run("docker", ["compose", "-f", path.join(ROOT, "docker-compose.yml"), "config", "--quiet"], { cwd: ROOT });
if (plain.status === 0) {
  process.stdout.write("compose config: OK (native docker)\n");
  process.exit(0);
}
const wslRoot = ROOT.replace(/^([A-Za-z]):\\/, (_, drive) => `/mnt/${drive.toLowerCase()}/`).replace(/\\/g, "/");
const wsl = run("wsl", ["-e", "docker", "compose", "-f", `${wslRoot}/docker-compose.yml`, "config", "--quiet"]);
if (wsl.status === 0) {
  process.stdout.write("compose config: OK (wsl docker)\n");
  process.exit(0);
}
process.stderr.write(`[compose-unavailable] native: ${plain.stderr.trim().split("\n")[0]}\n`);
process.stderr.write(`[compose-unavailable] wsl: ${wsl.stderr.trim().split("\n")[0]}\n`);
process.exitCode = 1;
