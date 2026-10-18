// DB 集成测试：真实 Postgres，每个用例独立数据库。
import test from "node:test";
import assert from "node:assert/strict";
import { createTestDatabase } from "./helpers/pg.mjs";
import {
  migrate,
  withTransaction,
  schemaVersion,
  isSeeded,
  resetDatabase,
  runMigrations,
  verifyMigrationChecksums,
} from "../server/db.mjs";
import { hashPassword } from "../server/auth.mjs";
import { seedClassroom } from "../server/seed.mjs";
import * as users from "../server/repositories/users.mjs";
import * as products from "../server/repositories/products.mjs";
import * as orders from "../server/repositories/orders.mjs";
import { createOrderService, normalizeItems, OrderFailure } from "../server/services/orders.mjs";
import { createCatalogService } from "../server/services/catalog.mjs";

const repos = { users, products, orders };
const clock = () => new Date("2026-10-18T04:00:00.000Z");
const orderService = (pool) => createOrderService({ pool, repos, clock });

test("migrate is idempotent, records version + checksum", async () => {
  const db = await createTestDatabase({ seed: false });
  try {
    assert.equal(await schemaVersion(db.pool), 2);
    await withTransaction(db.pool, (client) => migrate(client));
    assert.equal(await schemaVersion(db.pool), 2);
    assert.deepEqual(await verifyMigrationChecksums(db.pool), []);
    assert.equal(await isSeeded(db.pool), false);
  } finally {
    await db.close();
  }
});

test("seed is idempotent: 14 products + 3 classroom users", async () => {
  const db = await createTestDatabase();
  try {
    assert.equal((await db.pool.query("SELECT COUNT(*)::int AS n FROM products")).rows[0].n, 14);
    assert.equal((await db.pool.query("SELECT COUNT(*)::int AS n FROM users")).rows[0].n, 3);
    await withTransaction(db.pool, (client) => seedClassroom(client, { hashPassword, demoPassword: "demo1234" }));
    assert.equal((await db.pool.query("SELECT COUNT(*)::int AS n FROM products")).rows[0].n, 14);
    assert.equal(await isSeeded(db.pool), true);
  } finally {
    await db.close();
  }
});

test("database constraints reject duplicate username and short clientOrderId", async () => {
  const db = await createTestDatabase();
  try {
    await assert.rejects(
      () => users.create(db.pool, { id: "Udup", username: "userA", passwordHash: "x", role: "user", createdAt: new Date() }),
      (error) => error.code === "23505",
    );
    await assert.rejects(
      () => db.pool.query(
        "INSERT INTO orders (order_number, user_id, client_order_id, subtotal_cents, created_at) VALUES ('FL-20261018-000000-AAAA', 'Umissing', 'short', 1, now())",
      ),
      (error) => ["23503", "23514"].includes(error.code),
    );
  } finally {
    await db.close();
  }
});

test("checkout creates order, snapshots prices and decrements stock", async () => {
  const db = await createTestDatabase();
  try {
    const before = await products.get(db.pool, "banana");
    const user = await users.findByUsername(db.pool, "userA");
    const result = await orderService(db.pool).checkout({
      userId: user.id,
      items: [{ productId: "banana", quantity: 2 }],
      clientOrderId: "test-order-0001",
    });
    assert.equal(result.status, "created");
    assert.equal(result.order.items[0].unitPriceCents, before.unitPriceCents);
    assert.equal(result.order.subtotalCents, before.unitPriceCents * 2);
    assert.equal((await products.get(db.pool, "banana")).stock, before.stock - 2);
  } finally {
    await db.close();
  }
});

test("insufficient stock rolls back: no order, stock unchanged", async () => {
  const db = await createTestDatabase();
  try {
    await products.update(db.pool, "banana", { stock: 1 });
    const user = await users.findByUsername(db.pool, "userA");
    await assert.rejects(
      () => orderService(db.pool).checkout({ userId: user.id, items: [{ productId: "banana", quantity: 2 }], clientOrderId: "test-order-0002" }),
      (error) => error instanceof OrderFailure && error.code === "insufficient-stock",
    );
    assert.equal((await db.pool.query("SELECT COUNT(*)::int AS n FROM orders")).rows[0].n, 0);
    assert.equal((await products.get(db.pool, "banana")).stock, 1);
  } finally {
    await db.close();
  }
});

test("unlisted product cannot be ordered", async () => {
  const db = await createTestDatabase();
  try {
    await products.update(db.pool, "banana", { listed: false });
    const user = await users.findByUsername(db.pool, "userA");
    await assert.rejects(
      () => orderService(db.pool).checkout({ userId: user.id, items: [{ productId: "banana", quantity: 1 }], clientOrderId: "test-order-0003" }),
      (error) => error.code === "product-unlisted",
    );
  } finally {
    await db.close();
  }
});

test("same clientOrderId returns the existing order without double deduction", async () => {
  const db = await createTestDatabase();
  try {
    const user = await users.findByUsername(db.pool, "userA");
    const service = orderService(db.pool);
    const first = await service.checkout({ userId: user.id, items: [{ productId: "banana", quantity: 1 }], clientOrderId: "test-idem-0001" });
    const second = await service.checkout({ userId: user.id, items: [{ productId: "banana", quantity: 1 }], clientOrderId: "test-idem-0001" });
    assert.equal(first.status, "created");
    assert.equal(second.status, "existing");
    assert.equal(first.order.orderNumber, second.order.orderNumber);
    assert.equal((await db.pool.query("SELECT COUNT(*)::int AS n FROM orders")).rows[0].n, 1);
  } finally {
    await db.close();
  }
});

test("concurrent checkout with stock 1: one success, one insufficient, stock 0", async () => {
  const db = await createTestDatabase();
  try {
    await products.update(db.pool, "banana", { stock: 1 });
    const user = await users.findByUsername(db.pool, "userA");
    const service = orderService(db.pool);
    const results = await Promise.allSettled([
      service.checkout({ userId: user.id, items: [{ productId: "banana", quantity: 1 }], clientOrderId: "test-conc-0001" }),
      service.checkout({ userId: user.id, items: [{ productId: "banana", quantity: 1 }], clientOrderId: "test-conc-0002" }),
    ]);
    const fulfilled = results.filter((item) => item.status === "fulfilled");
    const rejected = results.filter((item) => item.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].reason.code, "insufficient-stock");
    assert.equal((await products.get(db.pool, "banana")).stock, 0);
    assert.equal((await db.pool.query("SELECT COUNT(*)::int AS n FROM orders")).rows[0].n, 1);
  } finally {
    await db.close();
  }
});

test("concurrent same clientOrderId: one created, one existing, stock deducted once", async () => {
  const db = await createTestDatabase();
  try {
    const user = await users.findByUsername(db.pool, "userA");
    const service = orderService(db.pool);
    const results = await Promise.all([
      service.checkout({ userId: user.id, items: [{ productId: "peach", quantity: 1 }], clientOrderId: "test-same-0001" }),
      service.checkout({ userId: user.id, items: [{ productId: "peach", quantity: 1 }], clientOrderId: "test-same-0001" }),
    ]);
    assert.deepEqual(results.map((item) => item.status).sort(), ["created", "existing"]);
    assert.equal(results[0].order.orderNumber, results[1].order.orderNumber);
    assert.equal((await db.pool.query("SELECT COUNT(*)::int AS n FROM orders")).rows[0].n, 1);
    assert.equal((await products.get(db.pool, "peach")).stock, 69);
  } finally {
    await db.close();
  }
});

test("reverse-order carts do not deadlock (sorted stock deduction)", async () => {
  const db = await createTestDatabase();
  try {
    const user = await users.findByUsername(db.pool, "userA");
    const service = orderService(db.pool);
    const [first, second] = await Promise.all([
      service.checkout({ userId: user.id, items: [{ productId: "durian", quantity: 1 }, { productId: "banana", quantity: 1 }], clientOrderId: "test-lock-0001" }),
      service.checkout({ userId: user.id, items: [{ productId: "banana", quantity: 1 }, { productId: "durian", quantity: 1 }], clientOrderId: "test-lock-0002" }),
    ]);
    assert.equal(first.status, "created");
    assert.equal(second.status, "created");
    assert.equal((await products.get(db.pool, "banana")).stock, 88);
    assert.equal((await products.get(db.pool, "durian")).stock, 28);
  } finally {
    await db.close();
  }
});

test("normalizeItems merges duplicates, caps 10 items and sorts productIds", () => {
  const merged = normalizeItems([{ productId: "b", quantity: 2 }, { productId: "a", quantity: 1 }, { productId: "b", quantity: 1 }]);
  assert.deepEqual(merged.map((item) => item.productId), ["a", "b"]);
  assert.equal(merged.find((item) => item.productId === "b").quantity, 3);
  assert.throws(() => normalizeItems([{ productId: "a", quantity: 100 }]), (error) => error.code === "invalid-quantity");
  const many = Array.from({ length: 11 }, (_, index) => ({ productId: `p${index}`, quantity: 1 }));
  assert.throws(() => normalizeItems(many), (error) => error.code === "invalid-request");
});

test("concurrent db migrate is serialized by advisory lock", async () => {
  const db = await createTestDatabase({ seed: false });
  try {
    const [first, second] = await Promise.all([runMigrations(db.pool), runMigrations(db.pool)]);
    assert.equal(first, 2);
    assert.equal(second, 2);
    assert.deepEqual(await verifyMigrationChecksums(db.pool), []);
  } finally {
    await db.close();
  }
});

test("resetDatabase rolls back entirely when seed fails (original data preserved)", async () => {
  const db = await createTestDatabase();
  try {
    await assert.rejects(
      () => resetDatabase(db.pool, { seed: async () => { throw new Error("seed boom"); } }),
      /seed boom/,
    );
    assert.equal((await db.pool.query("SELECT COUNT(*)::int AS n FROM products")).rows[0].n, 14);
    assert.equal((await db.pool.query("SELECT COUNT(*)::int AS n FROM users")).rows[0].n, 3);
  } finally {
    await db.close();
  }
});

test("resetDatabase rebuilds schema and seed in one transaction", async () => {
  const db = await createTestDatabase();
  try {
    await products.update(db.pool, "banana", { stock: 1 });
    await resetDatabase(db.pool, {
      seed: (client) => seedClassroom(client, { hashPassword, demoPassword: "demo1234" }),
    });
    assert.equal((await products.get(db.pool, "banana")).stock, 90);
    assert.equal((await db.pool.query("SELECT COUNT(*)::int AS n FROM users")).rows[0].n, 3);
  } finally {
    await db.close();
  }
});

test("catalog service validates price/stock/listed bounds", async () => {
  const db = await createTestDatabase();
  try {
    const catalog = createCatalogService({ pool: db.pool, repos });
    assert.equal((await catalog.listPublic()).length, 14);
    await assert.rejects(() => catalog.updateProduct("banana", { unitPriceCents: -1 }), (error) => error.code === "invalid-price");
    await assert.rejects(() => catalog.updateProduct("banana", { stock: 100000 }), (error) => error.code === "invalid-stock");
    await assert.rejects(() => catalog.updateProduct("banana", { listed: "yes" }), (error) => error.code === "invalid-listed");
    await assert.rejects(() => catalog.updateProduct("missing", { stock: 1 }), (error) => error.code === "product-not-found");
  } finally {
    await db.close();
  }
});
