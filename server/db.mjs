// SQLite 持久层：建库、迁移、种子、单写者队列。
// 零第三方依赖，使用 Node 内置 node:sqlite 的 DatabaseSync。
import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const SCHEMA_VERSION = 1;

export const PRODUCT_SEED = Object.freeze([
  { id: "fuji-apple", name: "红富士苹果", unit: "500g", unitPriceCents: 1299, stock: 120, listed: 1, description: "脆甜多汁，果香清亮", sortOrder: 1 },
  { id: "banana", name: "海南香蕉", unit: "1kg", unitPriceCents: 899, stock: 90, listed: 1, description: "软糯香甜，适合早餐", sortOrder: 2 },
  { id: "navel-orange", name: "赣南脐橙", unit: "1kg", unitPriceCents: 1599, stock: 80, listed: 1, description: "酸甜平衡，汁水充足", sortOrder: 3 },
  { id: "shine-muscat", name: "阳光玫瑰葡萄", unit: "500g", unitPriceCents: 2999, stock: 60, listed: 1, description: "果粒紧实，玫瑰香气", sortOrder: 4 },
  { id: "golden-pineapple", name: "海南金钻凤梨", unit: "1个", unitPriceCents: 1999, stock: 40, listed: 1, description: "香气浓郁，少纤维", sortOrder: 5 },
  { id: "durian", name: "泰国金枕榴莲", unit: "1kg", unitPriceCents: 4999, stock: 30, listed: 1, description: "绵密香甜，气味鲜明", sortOrder: 6 },
  { id: "hami-melon", name: "新疆哈密瓜", unit: "1个", unitPriceCents: 2599, stock: 35, listed: 1, description: "清甜脆爽，瓜香饱满", sortOrder: 7 },
  { id: "peach", name: "山东水蜜桃", unit: "500g", unitPriceCents: 1899, stock: 70, listed: 1, description: "果肉柔软，甜度高", sortOrder: 8 },
  { id: "blueberry", name: "智利蓝莓", unit: "125g", unitPriceCents: 2199, stock: 55, listed: 1, description: "颗粒饱满，微酸回甜", sortOrder: 9 },
  { id: "red-dragon-fruit", name: "云南红心火龙果", unit: "1个", unitPriceCents: 1399, stock: 65, listed: 1, description: "果肉细嫩，色泽鲜明", sortOrder: 10 },
  { id: "cherry", name: "智利车厘子", unit: "500g", unitPriceCents: 3999, stock: 45, listed: 1, description: "深红饱满，甜脆多汁", sortOrder: 11 },
  { id: "mango", name: "海南贵妃芒", unit: "1kg", unitPriceCents: 1599, stock: 50, listed: 1, description: "果香浓郁，纤维少", sortOrder: 12 },
  { id: "kiwi", name: "陕西徐香猕猴桃", unit: "500g", unitPriceCents: 1299, stock: 75, listed: 1, description: "细嫩微酸，香气清雅", sortOrder: 13 },
  { id: "strawberry", name: "辽宁丹东红颜草莓", unit: "500g", unitPriceCents: 2599, stock: 40, listed: 1, description: "果肉细腻，甜香明亮", sortOrder: 14 },
]);

export const DEMO_USERS = Object.freeze([
  { username: "userA", role: "user" },
  { username: "userB", role: "user" },
  { username: "admin", role: "admin" },
]);

export function defaultDbPath() {
  return path.resolve(process.cwd(), "data", "fruitlab.db");
}

export function openDb(dbPath = defaultDbPath()) {
  if (dbPath !== ":memory:") fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 300");
  if (dbPath !== ":memory:") {
    try { db.exec("PRAGMA journal_mode = WAL"); } catch { /* 平台不支持时保持默认 */ }
  }
  return db;
}

export function schemaVersion(db) {
  return db.prepare("PRAGMA user_version").get().user_version;
}

export function migrate(db) {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        user_id       TEXT PRIMARY KEY,
        username      TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL CHECK (role IN ('user','admin')),
        created_at    TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS products (
        product_id       TEXT PRIMARY KEY,
        name             TEXT NOT NULL,
        unit             TEXT NOT NULL,
        unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
        stock            INTEGER NOT NULL CHECK (stock >= 0),
        listed           INTEGER NOT NULL CHECK (listed IN (0,1)),
        image_path       TEXT NOT NULL,
        image_alt        TEXT NOT NULL,
        description      TEXT NOT NULL,
        sort_order       INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS orders (
        order_id        INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number    TEXT NOT NULL UNIQUE,
        user_id         TEXT NOT NULL REFERENCES users(user_id),
        client_order_id TEXT NOT NULL,
        subtotal_cents  INTEGER NOT NULL CHECK (subtotal_cents >= 0),
        created_at      TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS order_items (
        item_id          INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id         INTEGER NOT NULL REFERENCES orders(order_id),
        product_id       TEXT NOT NULL REFERENCES products(product_id),
        quantity         INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
        unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
        subtotal_cents   INTEGER NOT NULL CHECK (subtotal_cents >= 0)
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token      TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(user_id),
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
      CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_user_client ON orders(user_id, client_order_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    `);
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function isSeeded(db) {
  try {
    const productCount = db.prepare("SELECT COUNT(*) AS n FROM products").get().n;
    const userCount = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
    return productCount > 0 && userCount > 0;
  } catch {
    return false;
  }
}

export function seed(db, { hashPassword, demoPassword = "demo1234" } = {}) {
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const product of PRODUCT_SEED) {
      db.prepare(
        `INSERT INTO products (product_id, name, unit, unit_price_cents, stock, listed, image_path, image_alt, description, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(product_id) DO NOTHING`,
      ).run(
        product.id,
        product.name,
        product.unit,
        product.unitPriceCents,
        product.stock,
        product.listed,
        `assets/images/products/${product.id}.jpg`,
        `${product.name} ${product.unit}`,
        product.description,
        product.sortOrder,
      );
    }
    for (const user of DEMO_USERS) {
      const exists = db.prepare("SELECT 1 FROM users WHERE username = ?").get(user.username);
      if (exists) continue;
      const userId = `U${crypto.randomBytes(8).toString("hex")}`;
      db.prepare(
        "INSERT INTO users (user_id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run(userId, user.username, hashPassword(demoPassword), user.role, new Date().toISOString());
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

// 单写者队列：所有写事务经此串行化，避免 DatabaseSync 在多连接下阻塞事件循环。
let writeChain = Promise.resolve();
export function enqueueWrite(fn) {
  const next = writeChain.then(fn, fn);
  writeChain = next.catch(() => {});
  return next;
}

export function inTransaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* 已回滚 */ }
    throw error;
  }
}
