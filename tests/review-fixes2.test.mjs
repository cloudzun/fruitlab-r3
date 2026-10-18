// review 修复的进程级回归：自定义端口 Origin、CLI 暂时性退出码。
import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { createTestDatabase } from "./helpers/pg.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const NODE = process.execPath;

async function waitForHealth(base, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return true;
    } catch {
      /* not ready */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

test("serve.mjs --port rebuilds public origin so same-origin writes are accepted", async () => {
  const db = await createTestDatabase();
  const port = 4199;
  const child = spawn(NODE, ["serve.mjs", "--port", String(port)], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: db.url, SERVE_STATIC: "1", PUBLIC_URL: "" },
    stdio: "ignore",
  });
  try {
    assert.equal(await waitForHealth(`http://127.0.0.1:${port}`), true, "server did not become healthy");
    const response = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: `http://127.0.0.1:${port}` },
      body: JSON.stringify({ username: "userA", password: "demo1234" }),
    });
    assert.equal(response.status, 200, await response.text());
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 300));
    await db.close();
  }
});

test("CLI maps connection failure to temporary exit code 3", () => {
  const result = spawnSync(NODE, ["cli.mjs", "db", "check"], {
    cwd: ROOT,
    env: {
      ...process.env,
      DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:1/postgres",
      APP_ENV: "development",
    },
    encoding: "utf8",
    timeout: 120000,
  });
  assert.equal(result.status, 3, result.stderr);
  assert.match(result.stderr, /db-unavailable|timeout|ECONNREFUSED/i);
});
