// Postgres 基础设施：连接池、迁移、事务、种子/重置编排。
// 分层规则：本模块只做连接/事务/迁移，不含业务分支；业务逻辑在 services/。
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { isRetryable, sqlStateOf } from "./errors.mjs";

const { Pool } = pg;

export const MIGRATIONS_DIR = path.join(import.meta.dirname, "migrations");
const MIGRATION_LOCK_KEY = 0x46523301; // "FR3" + 1

export const DEMO_PRODUCTS = Object.freeze([
  { id: "fuji-apple", name: "红富士苹果", unit: "500g", unitPriceCents: 1299, stock: 120, listed: true, description: "脆甜多汁，果香清亮", sortOrder: 1 },
  { id: "banana", name: "海南香蕉", unit: "1kg", unitPriceCents: 899, stock: 90, listed: true, description: "软糯香甜，适合早餐", sortOrder: 2 },
  { id: "navel-orange", name: "赣南脐橙", unit: "1kg", unitPriceCents: 1599, stock: 80, listed: true, description: "酸甜平衡，汁水充足", sortOrder: 3 },
  { id: "shine-muscat", name: "阳光玫瑰葡萄", unit: "500g", unitPriceCents: 2999, stock: 60, listed: true, description: "果粒紧实，玫瑰香气", sortOrder: 4 },
  { id: "golden-pineapple", name: "海南金钻凤梨", unit: "1个", unitPriceCents: 1999, stock: 40, listed: true, description: "香气浓郁，少纤维", sortOrder: 5 },
  { id: "durian", name: "泰国金枕榴莲", unit: "1kg", unitPriceCents: 4999, stock: 30, listed: true, description: "绵密香甜，气味鲜明", sortOrder: 6 },
  { id: "hami-melon", name: "新疆哈密瓜", unit: "1个", unitPriceCents: 2599, stock: 35, listed: true, description: "清甜脆爽，瓜香饱满", sortOrder: 7 },
  { id: "peach", name: "山东水蜜桃", unit: "500g", unitPriceCents: 1899, stock: 70, listed: true, description: "果肉柔软，甜度高", sortOrder: 8 },
  { id: "blueberry", name: "智利蓝莓", unit: "125g", unitPriceCents: 2199, stock: 55, listed: true, description: "颗粒饱满，微酸回甜", sortOrder: 9 },
  { id: "red-dragon-fruit", name: "云南红心火龙果", unit: "1个", unitPriceCents: 1399, stock: 65, listed: true, description: "果肉细嫩，色泽鲜明", sortOrder: 10 },
  { id: "cherry", name: "智利车厘子", unit: "500g", unitPriceCents: 3999, stock: 45, listed: true, description: "深红饱满，甜脆多汁", sortOrder: 11 },
  { id: "mango", name: "海南贵妃芒", unit: "1kg", unitPriceCents: 1599, stock: 50, listed: true, description: "果香浓郁，纤维少", sortOrder: 12 },
  { id: "kiwi", name: "陕西徐香猕猴桃", unit: "500g", unitPriceCents: 1299, stock: 75, listed: true, description: "细嫩微酸，香气清雅", sortOrder: 13 },
  { id: "strawberry", name: "辽宁丹东红颜草莓", unit: "500g", unitPriceCents: 2599, stock: 40, listed: true, description: "果肉细腻，甜香明亮", sortOrder: 14 },
]);

export const DEMO_USERS = Object.freeze([
  { username: "userA", role: "user" },
  { username: "userB", role: "user" },
  { username: "admin", role: "admin" },
]);

// 兼容旧的领域测试导入名（R2 的 domain.test.mjs 原样保留）。
export const PRODUCT_SEED = DEMO_PRODUCTS;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createPool({
  connectionString,
  max = 10,
  connectionTimeoutMs = 5000,
  idleTimeoutMs = 30000,
  statementTimeoutMs = 15000,
  lockTimeoutMs = 5000,
  appName = "fruitlab-r3",
} = {}) {
  if (!connectionString) throw new Error("createPool requires connectionString");
  const pool = new Pool({
    connectionString,
    max,
    connectionTimeoutMillis: connectionTimeoutMs,
    idleTimeoutMillis: idleTimeoutMs,
    application_name: appName,
    options: `-c statement_timeout=${Number(statementTimeoutMs)} -c lock_timeout=${Number(lockTimeoutMs)}`,
  });
  pool.on("error", (error) => {
    process.stderr.write(`[pg-pool-error] ${error?.message ?? error}\n`);
  });
  return pool;
}

export async function closePool(pool) {
  if (!pool) return;
  try {
    await pool.end();
  } catch {
    /* already closed */
  }
}

// 连接重试：容器启动时 DB 可能尚未 ready。
export async function waitForDatabase(pool, { attempts = 30, baseDelayMs = 250, maxDelayMs = 2000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      await sleep(delay);
    }
  }
  throw lastError;
}

function listMigrationFiles(dir = MIGRATIONS_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
}

function parseVersion(name) {
  return Number(name.slice(0, 4));
}

// client 级迁移：调用方负责事务边界（reset/startup 均在同一事务内）。
export async function migrate(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    integer PRIMARY KEY,
      name       text NOT NULL,
      checksum   text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const applied = new Set((await client.query("SELECT version FROM schema_migrations")).rows.map((row) => Number(row.version)));
  for (const file of listMigrationFiles()) {
    const version = parseVersion(file);
    if (applied.has(version)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const checksum = crypto.createHash("sha256").update(sql).digest("hex");
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3) ON CONFLICT (version) DO NOTHING",
      [version, file, checksum],
    );
  }
  return schemaVersionOn(client);
}

export async function schemaVersionOn(client) {
  const result = await client.query("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations");
  return Number(result.rows[0].version);
}

export async function schemaVersion(pool) {
  const result = await pool.query("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations");
  return Number(result.rows[0].version);
}

export async function isSeeded(pool) {
  try {
    const products = await pool.query("SELECT COUNT(*)::int AS n FROM products");
    const users = await pool.query("SELECT COUNT(*)::int AS n FROM users");
    return products.rows[0].n > 0 && users.rows[0].n > 0;
  } catch {
    return false;
  }
}

export async function isSeededOn(client) {
  try {
    const products = await client.query("SELECT COUNT(*)::int AS n FROM products");
    const users = await client.query("SELECT COUNT(*)::int AS n FROM users");
    return products.rows[0].n > 0 && users.rows[0].n > 0;
  } catch {
    return false;
  }
}

export async function withTransaction(pool, fn, { retries = 3, onRetry } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* connection may be gone */
      }
      lastError = error;
      if (attempt < retries && isRetryable(error)) {
        if (onRetry) onRetry(attempt + 1, error);
        await sleep(25 * 2 ** attempt);
        continue;
      }
      throw error;
    } finally {
      client.release();
    }
  }
  throw lastError;
}

// 迁移/重置的互斥：同一时刻只允许一个进程迁移。
export async function runMigrations(pool) {
  return withTransaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [MIGRATION_LOCK_KEY]);
    return migrate(client);
  });
}

// 在单个事务内 drop + migrate + seed；任何一步失败整体回滚，原库保留。
export async function resetDatabase(pool, { seed }) {
  return withTransaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [MIGRATION_LOCK_KEY]);
    await client.query("DROP TABLE IF EXISTS order_items, orders, sessions, products, users, schema_migrations CASCADE");
    await migrate(client);
    if (typeof seed === "function") await seed(client);
    return true;
  });
}

export async function checkDatabase(pool) {
  const ping = await pool.query("SELECT 1 AS ok");
  const version = await schemaVersion(pool);
  const tables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() ORDER BY table_name",
  );
  const constraints = await pool.query(
    "SELECT conname FROM pg_constraint WHERE connamespace = current_schema()::regnamespace ORDER BY conname",
  );
  const counts = {};
  for (const table of ["products", "users", "orders", "order_items", "sessions"]) {
    if (!tables.rows.some((row) => row.table_name === table)) continue;
    const result = await pool.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
    counts[table] = result.rows[0].n;
  }
  return {
    connected: ping.rows[0].ok === 1,
    schemaVersion: version,
    tables: tables.rows.map((row) => row.table_name),
    constraints: constraints.rows.map((row) => row.conname),
    counts,
  };
}

export async function verifyMigrationChecksums(pool) {
  const applied = await pool.query("SELECT version, name, checksum FROM schema_migrations ORDER BY version");
  const problems = [];
  for (const row of applied.rows) {
    const file = listMigrationFiles().find((name) => parseVersion(name) === Number(row.version));
    if (!file) {
      problems.push(`v${row.version}: file missing`);
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const checksum = crypto.createHash("sha256").update(sql).digest("hex");
    if (checksum !== row.checksum) problems.push(`v${row.version}: checksum mismatch`);
  }
  return problems;
}

export { sqlStateOf };
