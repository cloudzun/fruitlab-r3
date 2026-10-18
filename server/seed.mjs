// 种子数据：classroom（14 商品 + 3 演示账号）与 production（14 商品 + admin）。
// 只使用参数化 SQL；口令只存 scrypt 哈希；幂等（ON CONFLICT / 按用户名）。
// app_meta.seed_mode 记录模式，production 启动会拒绝 classroom 污染的库。
import crypto from "node:crypto";
import { DEMO_PRODUCTS, DEMO_USERS } from "./db.mjs";

function userId() {
  return `U${crypto.randomBytes(8).toString("hex")}`;
}

async function setSeedMode(client, mode) {
  await client.query(
    "INSERT INTO app_meta (key, value) VALUES ('seed_mode', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
    [mode],
  );
}

async function insertProducts(client) {
  for (const product of DEMO_PRODUCTS) {
    await client.query(
      `INSERT INTO products (product_id, name, unit, unit_price_cents, stock, listed, image_path, image_alt, description, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (product_id) DO NOTHING`,
      [
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
      ],
    );
  }
}

async function findUser(client, username) {
  const result = await client.query("SELECT user_id, username, role FROM users WHERE username = $1", [username]);
  return result.rowCount === 0 ? null : result.rows[0];
}

async function insertUser(client, { username, role, password, hashPassword, now }) {
  const exists = await findUser(client, username);
  if (exists) return exists;
  const passwordHash = await hashPassword(password);
  await client.query(
    "INSERT INTO users (user_id, username, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5)",
    [userId(), username, passwordHash, role, now],
  );
  return findUser(client, username);
}

export async function seedClassroom(client, { hashPassword, demoPassword, now = new Date().toISOString() }) {
  await insertProducts(client);
  for (const user of DEMO_USERS) {
    await insertUser(client, { ...user, password: demoPassword, hashPassword, now });
  }
  await setSeedMode(client, "classroom");
}

// production：只创建/修复 admin（口令来自 ADMIN_PASSWORD），不创建演示用户；
// 若检测到 classroom 演示账号，直接拒绝（防止 demo 数据/口令进生产）。
export async function seedProductionAdmin(client, { hashPassword, adminPassword, now = new Date().toISOString() }) {
  for (const demo of ["userA", "userB"]) {
    if (await findUser(client, demo)) {
      throw Object.assign(new Error("production database contains classroom demo users; run db reset first"), {
        code: "classroom-data-present",
      });
    }
  }
  await insertProducts(client);
  const existing = await findUser(client, "admin");
  const passwordHash = await hashPassword(adminPassword);
  if (existing) {
    await client.query("UPDATE users SET password_hash = $1, role = 'admin' WHERE username = 'admin'", [passwordHash]);
  } else {
    await client.query(
      "INSERT INTO users (user_id, username, password_hash, role, created_at) VALUES ($1, 'admin', $2, 'admin', $3)",
      [userId(), passwordHash, now],
    );
  }
  await setSeedMode(client, "production");
}
