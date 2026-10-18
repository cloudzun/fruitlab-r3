// 组合根：建池 → 迁移 → 按需 seed → 构造 repositories/services → 构造 API handler。
// 这是唯一允许同时接触 db/repositories/services/router 的模块（见 tests/layering.test.mjs）。
import {
  createPool,
  waitForDatabase,
  runMigrations,
  isSeeded,
  withTransaction,
  closePool,
  schemaVersion,
} from "./db.mjs";
import { hashPassword } from "./auth.mjs";
import { seedClassroom, seedProductionAdmin } from "./seed.mjs";
import * as users from "./repositories/users.mjs";
import * as sessions from "./repositories/sessions.mjs";
import * as products from "./repositories/products.mjs";
import * as orders from "./repositories/orders.mjs";
import { createServices } from "./services/index.mjs";
import { createApiHandler } from "./router.mjs";

async function stage(name, fn) {
  try {
    return await fn();
  } catch (error) {
    if (error && typeof error === "object") error.stage = name;
    throw error;
  }
}

export async function createApp({ config, clock = () => new Date() }) {
  const version = config.version;
  const pool = createPool({
    connectionString: config.databaseUrl,
    max: config.db.max,
    connectionTimeoutMs: config.db.connectionTimeoutMs,
    idleTimeoutMs: config.db.idleTimeoutMs,
    statementTimeoutMs: config.db.statementTimeoutMs,
    lockTimeoutMs: config.db.lockTimeoutMs,
  });
  try {
    await stage("connect", () => waitForDatabase(pool));
    await stage("migrate", () => runMigrations(pool));
    const seeded = await isSeeded(pool);
    const metaResult = await pool.query("SELECT value FROM app_meta WHERE key = 'seed_mode'");
    const seededMode = metaResult.rowCount > 0 ? metaResult.rows[0].value : seeded ? "classroom" : "none";
    if (seeded && config.seedMode === "production" && seededMode !== "production") {
      throw Object.assign(
        new Error("production database was seeded as classroom (demo users present); run `node cli.mjs db reset --yes`"),
        { code: "classroom-data-present" },
      );
    }
    if (!seeded || (config.seedMode === "classroom" && seededMode !== "classroom")) {
      await stage("seed", () =>
        withTransaction(pool, async (client) => {
          if (config.seedMode === "production") {
            await seedProductionAdmin(client, {
              hashPassword,
              adminPassword: config.adminPassword,
              now: clock().toISOString(),
            });
          } else {
            await seedClassroom(client, {
              hashPassword,
              demoPassword: config.demoPassword,
              now: clock().toISOString(),
            });
          }
        }),
      );
    } else if (config.seedMode === "production") {
      const admin = await pool.query("SELECT role FROM users WHERE username = 'admin'");
      if (admin.rowCount === 0 || admin.rows[0].role !== "admin") {
        await stage("seed", () =>
          withTransaction(pool, (client) =>
            seedProductionAdmin(client, { hashPassword, adminPassword: config.adminPassword, now: clock().toISOString() }),
          ),
        );
      }
    }
    await stage("purge-sessions", () => sessions.purgeExpired(pool, clock()));
    const repos = { users, sessions, products, orders };
    const services = await stage("services", () => createServices({ pool, config, clock, repos }));
    const handler = createApiHandler({ services, config, pool, version });
    return {
      pool,
      services,
      handler,
      version,
      schemaVersion: await schemaVersion(pool),
      close: () => closePool(pool),
    };
  } catch (error) {
    await closePool(pool);
    throw error;
  }
}

// 启动失败的可诊断输出：stage / 尝试次数 / SQLSTATE / 脱敏目标 / 下一步命令。
export function formatStartupError(error, config) {
  const target = (() => {
    try {
      const url = new URL(config.databaseUrl);
      return `${url.hostname}:${url.port || "5432"}${url.pathname}`;
    } catch {
      return "<invalid DATABASE_URL>";
    }
  })();
  return JSON.stringify({
    event: "startup-failed",
    stage: error?.stage ?? "unknown",
    code: error?.code ?? "internal-error",
    sqlState: typeof error?.code === "string" && /^[0-9A-Z]{5}$/.test(error.code) ? error.code : "",
    database: target,
    message: String(error?.message ?? error).slice(0, 300),
    next: "检查容器/DB 是否 healthy；确认 DATABASE_URL 与 POSTGRES_USER/DB/PASSWORD 一致；运行 node scripts/preflight.mjs",
  });
}
