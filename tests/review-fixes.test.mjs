// review 环修复的回归测试：错误映射、CSRF bootstrap、logout、localhost、慢查询 health、限流桶、行锁、CLI 恢复校验。
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTestDatabase } from "./helpers/pg.mjs";
import { startTestServer, request, cookieValue, login } from "./helpers/server.mjs";
import { toAppError } from "../server/errors.mjs";
import { createHealthService } from "../server/services/health.mjs";
import { createPool } from "../server/db.mjs";
import { createRateLimiter, createScryptGate, createDummyHash } from "../server/auth.mjs";
import { createAuthService } from "../server/services/auth.mjs";
import * as users from "../server/repositories/users.mjs";
import * as sessions from "../server/repositories/sessions.mjs";
import * as products from "../server/repositories/products.mjs";
import { getForUpdate } from "../server/repositories/products.mjs";
import { deductStock } from "../server/repositories/orders.mjs";
import { createApiClient } from "../assets/api-client.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const NODE = process.execPath;
const repos = { users, sessions };

function cliEnv(db) {
  return { DATABASE_URL: db.url, APP_ENV: "development", DEMO_PASSWORD: "demo1234" };
}

function runCli(args, env, input) {
  const result = spawnSync(NODE, ["cli.mjs", ...args], {
    cwd: ROOT,
    env: { ...process.env, APP_ENV: "development", ...env },
    input,
    encoding: "utf8",
    timeout: 120000,
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

test("SQLSTATE errors map to 503 and never leak the raw code", async () => {
  assert.equal(toAppError({ code: "40001" }), "server-busy");
  assert.equal(toAppError({ code: "40P01" }), "server-busy");
  assert.equal(toAppError({ code: "57014" }), "server-busy");
  assert.equal(toAppError({ code: "53300" }), "db-unavailable");
  assert.equal(toAppError({ code: "ECONNREFUSED" }), "db-unavailable");
  const db = await createTestDatabase();
  const server = await startTestServer(db.url);
  try {
    const original = server.app.services.orders.checkout;
    server.app.services.orders.checkout = async () => { throw Object.assign(new Error("deadlock"), { code: "40P01" }); };
    const auth = await login(server.base);
    const response = await request(server.base, "POST", "/api/orders", {
      body: { items: [{ productId: "banana", quantity: 1 }], clientOrderId: "review-sqlstate-01" },
      cookies: [auth.session, `fruitlab_csrf=${auth.csrfToken}`],
      headers: { "x-csrf-token": auth.csrfToken },
    });
    assert.equal(response.status, 503);
    assert.equal(response.body.code, "server-busy");
    assert.equal(JSON.stringify(response.body).includes("40P01"), false);
    server.app.services.orders.checkout = original;
  } finally {
    await server.close();
    await db.close();
  }
});

test("safe GET issues a CSRF cookie so client bootstrap works", async () => {
  const db = await createTestDatabase();
  const server = await startTestServer(db.url);
  try {
    const health = await request(server.base, "GET", "/api/health");
    const csrf = cookieValue(health.setCookies, "fruitlab_csrf");
    assert.ok(csrf, "health should set fruitlab_csrf");
    const bootstrap = createApiClient({
      timeoutMs: 1000,
      fetchImpl: async (target, init) => {
        if (target === "/api/health") {
          globalThis.document = { cookie: csrf };
          return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) };
        }
        return { ok: true, status: 201, text: async () => JSON.stringify({ ok: true, order: {} }) };
      },
    });
    globalThis.document = { cookie: "" };
    await bootstrap.createOrder({ items: [{ productId: "banana", quantity: 1 }], clientOrderId: "review-csrf-0001" });
    assert.ok(globalThis.document.cookie.includes("fruitlab_csrf="));
  } finally {
    delete globalThis.document;
    await server.close();
    await db.close();
  }
});

test("logout without a session still returns 204 and clears cookies", async () => {
  const db = await createTestDatabase();
  const server = await startTestServer(db.url);
  try {
    const response = await request(server.base, "POST", "/api/auth/logout");
    assert.equal(response.status, 204);
    const cleared = response.setCookies.join(";");
    assert.match(cleared, /fruitlab_session=;/);
    assert.match(cleared, /fruitlab_csrf=;/);
  } finally {
    await server.close();
    await db.close();
  }
});

test("localhost and 127.0.0.1 are both accepted for the external port", async () => {
  const db = await createTestDatabase();
  const server = await startTestServer(db.url);
  try {
    const viaLocalhost = await request(server.base, "GET", "/api/health", { headers: { host: `localhost:${server.port}` } });
    assert.equal(viaLocalhost.status, 200);
    const viaLoopback = await request(server.base, "GET", "/api/health", { headers: { host: `127.0.0.1:${server.port}` } });
    assert.equal(viaLoopback.status, 200);
  } finally {
    await server.close();
    await db.close();
  }
});

test("health timeout destroys the checked-out client instead of leaving a long query", async () => {
  let released = null;
  const fakeClient = {
    query: () => new Promise(() => {}),
    release: (destroy) => { released = destroy; },
  };
  const fakePool = { connect: async () => fakeClient };
  const service = createHealthService({ pool: fakePool, config: { healthTimeoutMs: 80 }, clock: () => new Date() });
  const started = Date.now();
  const health = await service.health({ version: "test" });
  assert.equal(health.ok, false);
  assert.equal(health.db, "down");
  assert.ok(Date.now() - started < 1000);
  assert.equal(released, true);
});

test("account bucket limits one account across IPs and success does not reset the IP bucket", async () => {
  const db = await createTestDatabase();
  try {
    const limiter = createRateLimiter();
    const service = createAuthService({
      pool: db.pool,
      repos,
      config: { sessionTtlSeconds: 3600, scryptConcurrency: 4, scryptQueueLimit: 100 },
      clock: () => new Date("2026-10-18T00:00:00.000Z"),
      dummyHash: await createDummyHash(),
      rateLimiter: limiter,
      scryptGate: createScryptGate(),
    });
    for (let index = 0; index < 5; index += 1) {
      await assert.rejects(
        () => service.login({ username: "userA", password: "wrong-password", ip: `10.0.0.${index}` }),
        (error) => error.code === "auth-invalid-credentials",
      );
    }
    await assert.rejects(
      () => service.login({ username: "userA", password: "demo1234", ip: "10.0.0.99" }),
      (error) => error.code === "auth-rate-limited",
    );
    await service.login({ username: "userB", password: "demo1234", ip: "10.0.0.50" });
    const ipBucket = limiter.check({ username: "someone-else", ip: "10.0.0.50" });
    assert.equal(ipBucket.allowed, true);
  } finally {
    await db.close();
  }
});

test("getForUpdate locks the product row and unlisted products cannot be deducted", async () => {
  const db = await createTestDatabase();
  try {
    const client = await db.pool.connect();
    const other = await db.pool.connect();
    try {
      await client.query("BEGIN");
      await getForUpdate(client, "banana");
      await other.query("BEGIN");
      await other.query("SET LOCAL statement_timeout = 500");
      await assert.rejects(
        () => other.query("UPDATE products SET stock = stock WHERE product_id = 'banana'"),
        (error) => error.code === "57014",
      );
      await other.query("ROLLBACK");
      await client.query("ROLLBACK");
    } finally {
      client.release();
      other.release();
    }
    await products.update(db.pool, "banana", { listed: false });
    const deduct = await db.pool.connect();
    try {
      await deduct.query("BEGIN");
      assert.equal(await deductStock(deduct, { productId: "banana", quantity: 1 }), null);
      await deduct.query("ROLLBACK");
    } finally {
      deduct.release();
    }
  } finally {
    await db.close();
  }
});

test("CLI rejects truncated backups, schema mismatch and classroom-contaminated production", async () => {
  const db = await createTestDatabase();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fruitlab-review-cli-"));
  try {
    const env = cliEnv(db);
    const backup = runCli(["db", "backup", "--out", dir], env);
    const file = /备份完成: (.+)$/m.exec(backup.stdout)?.[1]?.trim();
    assert.ok(file);
    const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
    const truncated = path.join(dir, "truncated.jsonl");
    fs.writeFileSync(truncated, lines.slice(0, 2).join("\n"));
    const rejected = runCli(["db", "restore", "--in", truncated, "--yes"], env);
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /invalid-backup|missing table/);

    const wrongVersion = path.join(dir, "wrong-version.jsonl");
    const meta = JSON.parse(lines[0]);
    meta.schemaVersion = 999;
    fs.writeFileSync(wrongVersion, [JSON.stringify(meta), ...lines.slice(1)].join("\n"));
    const mismatch = runCli(["db", "restore", "--in", wrongVersion, "--yes"], env);
    assert.equal(mismatch.status, 1);
    assert.match(mismatch.stderr, /schemaVersion/);

    const production = runCli(["db", "seed"], { ...env, APP_ENV: "production", ADMIN_PASSWORD: "strong-admin-password", COOKIE_SECURE: "1" });
    assert.equal(production.status, 1);
    assert.match(production.stderr, /classroom-data-present|classroom/);

    const placeholder = runCli(["db", "seed"], {
      ...env,
      APP_ENV: "production",
      ADMIN_PASSWORD: "change-me-admin-password",
      COOKIE_SECURE: "1",
    });
    assert.equal(placeholder.status, 1);
    assert.match(placeholder.stderr, /placeholder/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    await db.close();
  }
});
