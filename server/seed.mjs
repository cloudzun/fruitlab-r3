// 种子数据：classroom（14 商品 + 3 演示账号）与 production（14 商品 + admin）。
// 只使用参数化 SQL；口令只存 scrypt 哈希；幂等（ON CONFLICT DO NOTHING / 按用户名跳过）。
import crypto from "node:crypto";
import { DEMO_PRODUCTS, DEMO_USERS } from "./db.mjs";

function userId() {
  return `U${crypto.randomBytes(8).toString("hex")}`;
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

async function insertUser(client, { username, role, password, hashPassword, now }) {
  const exists = await client.query("SELECT 1 FROM users WHERE username = $1", [username]);
  if (exists.rowCount > 0) return;
  const passwordHash = await hashPassword(password);
  await client.query(
    "INSERT INTO users (user_id, username, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5)",
    [userId(), username, passwordHash, role, now],
  );
}

export async function seedClassroom(client, { hashPassword, demoPassword, now = new Date().toISOString() }) {
  await insertProducts(client);
  for (const user of DEMO_USERS) {
    await insertUser(client, { ...user, password: demoPassword, hashPassword, now });
  }
}

// production：只创建 admin（口令来自 ADMIN_PASSWORD），不创建演示用户。
export async function seedProductionAdmin(client, { hashPassword, adminPassword, now = new Date().toISOString() }) {
  await insertProducts(client);
  await insertUser(client, { username: "admin", role: "admin", password: adminPassword, hashPassword, now });
}
