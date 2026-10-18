// 真实 Postgres 测试夹具：每个用例独立数据库，结束后清理。
// 前置：TEST_DATABASE_URL（默认 postgres://postgres:postgres@127.0.0.1:55432/postgres）。
import crypto from "node:crypto";
import pg from "pg";
import { migrate, withTransaction } from "../../server/db.mjs";
import { hashPassword } from "../../server/auth.mjs";
import { seedClassroom, seedProductionAdmin } from "../../server/seed.mjs";
import { readVersion } from "../../config.mjs";

export const TEST_ADMIN_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55432/postgres";

function databaseUrlFor(name) {
  const url = new URL(TEST_ADMIN_URL);
  url.pathname = `/${name}`;
  return url.toString();
}

function actionableError(error) {
  return new Error(
    `测试 Postgres 不可用：${error.message}\n` +
      `请先启动：wsl -e docker run -d --rm --name fruitlab-r3-test-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16-alpine\n` +
      `或设置 TEST_DATABASE_URL。`,
  );
}

async function adminClient() {
  const client = new pg.Client({ connectionString: TEST_ADMIN_URL, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
  } catch (error) {
    throw actionableError(error);
  }
  return client;
}

export async function createTestDatabase({ seed = true, mode = "classroom", demoPassword = "demo1234", adminPassword = "admin-password-123" } = {}) {
  const admin = await adminClient();
  const name = `fruitlab_test_${crypto.randomBytes(6).toString("hex")}`;
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  const pool = new pg.Pool({ connectionString: databaseUrlFor(name), max: 2, connectionTimeoutMillis: 5000 });
  try {
    await withTransaction(pool, (client) => migrate(client));
    if (seed) {
      await withTransaction(pool, async (client) => {
        if (mode === "production") await seedProductionAdmin(client, { hashPassword, adminPassword });
        else await seedClassroom(client, { hashPassword, demoPassword });
      });
    }
  } catch (error) {
    await pool.end();
    await admin.end();
    throw error;
  }
  return {
    name,
    url: databaseUrlFor(name),
    pool,
    async close() {
      try { await pool.end(); } catch { /* already closed */ }
      const cleaner = await adminClient().catch(() => null);
      if (!cleaner) return;
      try {
        await cleaner.query(
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
          [name],
        );
        await cleaner.query(`DROP DATABASE IF EXISTS ${name}`);
      } finally {
        await cleaner.end();
      }
    },
  };
}

// 清理残留测试库（上次中断留下的）。
export async function dropStaleTestDatabases() {
  const admin = await adminClient();
  try {
    const result = await admin.query("SELECT datname FROM pg_database WHERE datname LIKE 'fruitlab_test_%'");
    for (const row of result.rows) {
      try {
        await admin.query(
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
          [row.datname],
        );
        await admin.query(`DROP DATABASE IF EXISTS ${row.datname}`);
      } catch {
        /* 忽略单个清理失败 */
      }
    }
  } finally {
    await admin.end();
  }
}

export function testConfig(databaseUrl, overrides = {}) {
  const base = {
    appEnv: "test",
    isProduction: false,
    version: readVersion(),
    port: 0,
    host: "127.0.0.1",
    publicUrl: "http://127.0.0.1:0",
    publicOrigin: new URL("http://127.0.0.1:0"),
    databaseUrl,
    sessionTtlSeconds: 86400,
    cookieSecure: false,
    trustProxy: false,
    healthTimeoutMs: 3000,
    demoPassword: "demo1234",
    adminPassword: "admin-password-123",
    seedMode: "classroom",
    scryptConcurrency: 4,
    scryptQueueLimit: 100,
    db: {
      max: 2,
      connectionTimeoutMs: 5000,
      idleTimeoutMs: 30000,
      statementTimeoutMs: 15000,
      lockTimeoutMs: 5000,
    },
    rateLimit: { windowMs: 900000, accountLimit: 5, ipLimit: 50, lockMs: 900000, maxEntries: 10000 },
    serveStatic: true,
    logLevel: "silent",
  };
  const config = { ...base, ...overrides };
  config.publicOrigin = new URL(config.publicUrl);
  return config;
}
