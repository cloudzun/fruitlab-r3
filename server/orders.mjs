// 订单：事务下单、库存原子扣减、clientOrderId 幂等、按用户/角色查询。
import crypto from "node:crypto";
import { generateUniqueOrderNumber } from "../assets/domain.mjs";
import { inTransaction } from "./db.mjs";

export const MAX_ITEMS = 10;

const SUFFIX_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export function defaultSuffixFactory() {
  return Array.from(crypto.randomBytes(4))
    .map((byte) => SUFFIX_ALPHABET[byte % SUFFIX_ALPHABET.length])
    .join("");
}

class OrderFailure extends Error {
  constructor(code, details) {
    super(code);
    this.code = code;
    this.details = details;
  }
}

export function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) return { ok: false, code: "invalid-request" };
  const merged = new Map();
  for (const item of items) {
    if (!item || typeof item !== "object") return { ok: false, code: "invalid-request" };
    const { productId, quantity } = item;
    if (typeof productId !== "string" || productId.length === 0) return { ok: false, code: "invalid-request" };
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return { ok: false, code: "invalid-quantity" };
    const current = merged.get(productId) ?? 0;
    const next = current + quantity;
    if (next > 99) return { ok: false, code: "invalid-quantity" };
    merged.set(productId, next);
  }
  if (merged.size > MAX_ITEMS) return { ok: false, code: "invalid-request", details: `最多 ${MAX_ITEMS} 种商品` };
  return { ok: true, items: [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity })) };
}

function itemsForOrder(db, orderId) {
  return db
    .prepare(
      `SELECT oi.product_id AS productId, p.name, p.unit,
              oi.quantity, oi.unit_price_cents AS unitPriceCents, oi.subtotal_cents AS subtotalCents
         FROM order_items oi JOIN products p ON p.product_id = oi.product_id
        WHERE oi.order_id = ? ORDER BY oi.item_id`,
    )
    .all(orderId);
}

function rowToOrder(db, row) {
  return {
    orderNumber: row.order_number,
    userId: row.user_id,
    createdAt: row.created_at,
    subtotalCents: row.subtotal_cents,
    items: itemsForOrder(db, row.order_id),
  };
}

export function listOrdersByUser(db, userId, { limit = 100 } = {}) {
  const rows = db
    .prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC, order_id DESC LIMIT ?")
    .all(userId, limit);
  return rows.map((row) => rowToOrder(db, row));
}

export function getOrderByNumber(db, orderNumber) {
  const row = db.prepare("SELECT * FROM orders WHERE order_number = ?").get(orderNumber);
  return row ? rowToOrder(db, row) : null;
}

export function listAllOrders(db, { limit = 100 } = {}) {
  const rows = db
    .prepare(
      `SELECT o.*, u.username,
              (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.order_id) AS itemCount
         FROM orders o JOIN users u ON u.user_id = o.user_id
        ORDER BY o.created_at DESC, o.order_id DESC LIMIT ?`,
    )
    .all(limit);
  return rows.map((row) => ({ ...rowToOrder(db, row), username: row.username, itemCount: row.itemCount }));
}

function findExistingOrder(db, userId, clientOrderId) {
  const row = db
    .prepare("SELECT * FROM orders WHERE user_id = ? AND client_order_id = ?")
    .get(userId, clientOrderId);
  return row ? rowToOrder(db, row) : null;
}

export function createOrder(db, { userId, items, clientOrderId, now = new Date(), suffixFactory }) {
  if (typeof clientOrderId !== "string" || clientOrderId.length < 8 || clientOrderId.length > 128) {
    return { ok: false, code: "invalid-request", details: "clientOrderId 必填（8–128 字符）" };
  }
  const normalized = normalizeItems(items);
  if (!normalized.ok) return normalized;

  const existing = findExistingOrder(db, userId, clientOrderId);
  if (existing) return { ok: true, status: "existing", order: existing };

  try {
    const result = inTransaction(db, () => {
      const lines = [];
      let subtotal = 0;
      for (const { productId, quantity } of normalized.items) {
        const product = db
          .prepare("SELECT * FROM products WHERE product_id = ?")
          .get(productId);
        if (!product) throw new OrderFailure("product-not-found", productId);
        if (product.listed !== 1) throw new OrderFailure("product-unlisted", productId);
        const changed = db
          .prepare("UPDATE products SET stock = stock - ? WHERE product_id = ? AND stock >= ?")
          .run(quantity, productId, quantity).changes;
        if (changed !== 1) throw new OrderFailure("insufficient-stock", productId);
        const lineSubtotal = product.unit_price_cents * quantity;
        subtotal += lineSubtotal;
        lines.push({
          productId,
          name: product.name,
          unit: product.unit,
          quantity,
          unitPriceCents: product.unit_price_cents,
          subtotalCents: lineSubtotal,
        });
      }
      const taken = new Set(db.prepare("SELECT order_number FROM orders").all().map((row) => row.order_number));
      const orderNumber = generateUniqueOrderNumber({
        now,
        suffixFactory: suffixFactory ?? defaultSuffixFactory,
        isTaken: (candidate) => taken.has(candidate),
      });
      if (!orderNumber) throw new OrderFailure("order-number-exhausted");
      const createdAt = now.toISOString();
      const inserted = db
        .prepare(
          "INSERT INTO orders (order_number, user_id, client_order_id, subtotal_cents, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .run(orderNumber, userId, clientOrderId, subtotal, createdAt);
      const orderId = Number(inserted.lastInsertRowid);
      const insertItem = db.prepare(
        "INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents, subtotal_cents) VALUES (?, ?, ?, ?, ?)",
      );
      for (const line of lines) {
        insertItem.run(orderId, line.productId, line.quantity, line.unitPriceCents, line.subtotalCents);
      }
      const stored = db.prepare("SELECT * FROM orders WHERE order_id = ?").get(orderId);
      return { ok: true, status: "created", order: rowToOrder(db, stored) };
    });
    return result;
  } catch (error) {
    if (error instanceof OrderFailure) return { ok: false, code: error.code, details: error.details };
    if (String(error?.message ?? "").includes("BUSY")) return { ok: false, code: "server-busy" };
    throw error;
  }
}
