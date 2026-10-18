import test from "node:test";
import assert from "node:assert/strict";
import { createTempDb } from "./helpers/db.mjs";
import { schemaVersion, migrate, isSeeded } from "../server/db.mjs";
import { findUserByUsername } from "../server/auth.mjs";
import { createOrder, getOrderByNumber, listOrdersByUser } from "../server/orders.mjs";

test("migrate is idempotent and sets schema version 1", () => {
  const t = createTempDb();
  try {
    migrate(t.db);
    assert.equal(schemaVersion(t.db), 1);
    assert.equal(isSeeded(t.db), true);
  } finally { t.close(); }
});

test("seed writes 14 products and 3 demo users", () => {
  const t = createTempDb();
  try {
    assert.equal(t.db.prepare("SELECT COUNT(*) AS n FROM products").get().n, 14);
    assert.equal(t.db.prepare("SELECT COUNT(*) AS n FROM users").get().n, 3);
  } finally { t.close(); }
});

test("username is unique", () => {
  const t = createTempDb();
  try {
    const user = findUserByUsername(t.db, "userA");
    assert.throws(() => {
      t.db.prepare("INSERT INTO users (user_id, username, password_hash, role, created_at) VALUES (?,?,?,?,?)")
        .run("Ux", "userA", "h", "user", new Date().toISOString());
    });
    assert.equal(user.username, "userA");
  } finally { t.close(); }
});

test("checkout decrements stock, creates order, and is idempotent by clientOrderId", () => {
  const t = createTempDb();
  try {
    const user = findUserByUsername(t.db, "userA");
    const before = t.db.prepare("SELECT stock FROM products WHERE product_id = 'fuji-apple'").get().stock;
    const first = createOrder(t.db, {
      userId: user.id,
      items: [{ productId: "fuji-apple", quantity: 2 }],
      clientOrderId: "client-0001",
    });
    assert.equal(first.ok, true);
    assert.equal(first.status, "created");
    assert.match(first.order.orderNumber, /^FL-\d{8}-\d{6}-[A-Z0-9]{4}$/);
    assert.equal(first.order.items.length, 1);
    assert.equal(first.order.subtotalCents, 2598);
    assert.equal(t.db.prepare("SELECT stock FROM products WHERE product_id = 'fuji-apple'").get().stock, before - 2);

    const second = createOrder(t.db, {
      userId: user.id,
      items: [{ productId: "fuji-apple", quantity: 2 }],
      clientOrderId: "client-0001",
    });
    assert.equal(second.ok, true);
    assert.equal(second.status, "existing");
    assert.equal(second.order.orderNumber, first.order.orderNumber);
    assert.equal(t.db.prepare("SELECT COUNT(*) AS n FROM orders").get().n, 1);
    assert.equal(t.db.prepare("SELECT stock FROM products WHERE product_id = 'fuji-apple'").get().stock, before - 2);
  } finally { t.close(); }
});

test("insufficient stock rolls back and writes no order", () => {
  const t = createTempDb();
  try {
    const user = findUserByUsername(t.db, "userA");
    const before = t.db.prepare("SELECT stock FROM products WHERE product_id = 'durian'").get().stock;
    const result = createOrder(t.db, {
      userId: user.id,
      items: [{ productId: "durian", quantity: 99 }, { productId: "fuji-apple", quantity: 1 }],
      clientOrderId: "client-0002",
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "insufficient-stock");
    assert.equal(t.db.prepare("SELECT COUNT(*) AS n FROM orders").get().n, 0);
    assert.equal(t.db.prepare("SELECT COUNT(*) AS n FROM order_items").get().n, 0);
    assert.equal(t.db.prepare("SELECT stock FROM products WHERE product_id = 'durian'").get().stock, before);
  } finally { t.close(); }
});

test("unlisted product cannot be ordered", () => {
  const t = createTempDb();
  try {
    t.db.prepare("UPDATE products SET listed = 0 WHERE product_id = 'banana'").run();
    const user = findUserByUsername(t.db, "userA");
    const result = createOrder(t.db, {
      userId: user.id,
      items: [{ productId: "banana", quantity: 1 }],
      clientOrderId: "client-0003",
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "product-unlisted");
  } finally { t.close(); }
});

test("orders are scoped to their owner", () => {
  const t = createTempDb();
  try {
    const a = findUserByUsername(t.db, "userA");
    const b = findUserByUsername(t.db, "userB");
    createOrder(t.db, { userId: a.id, items: [{ productId: "banana", quantity: 1 }], clientOrderId: "client-a1" });
    createOrder(t.db, { userId: b.id, items: [{ productId: "peach", quantity: 1 }], clientOrderId: "client-b1" });
    assert.equal(listOrdersByUser(t.db, a.id).length, 1);
    assert.equal(listOrdersByUser(t.db, b.id).length, 1);
    const orderA = listOrdersByUser(t.db, a.id)[0];
    assert.equal(getOrderByNumber(t.db, orderA.orderNumber).userId, a.id);
  } finally { t.close(); }
});
