// 订单用例：校验、幂等、事务顺序、库存扣减、越权 404。
import crypto from "node:crypto";
import { createOrderNumber } from "../../assets/domain.mjs";
import { withTransaction } from "../db.mjs";
import { isUniqueViolation, constraintOf } from "../errors.mjs";
import { validateClientOrderId } from "../auth.mjs";

export const MAX_ITEMS = 10;
const SUFFIX_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export class OrderFailure extends Error {
  constructor(code, details) {
    super(code);
    this.code = code;
    this.details = details;
  }
}

function randomSuffix() {
  return Array.from(crypto.randomBytes(4))
    .map((byte) => SUFFIX_ALPHABET[byte % SUFFIX_ALPHABET.length])
    .join("");
}

export function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new OrderFailure("invalid-request");
  const merged = new Map();
  for (const item of items) {
    if (!item || typeof item !== "object") throw new OrderFailure("invalid-request");
    const { productId, quantity } = item;
    if (typeof productId !== "string" || productId.length === 0) throw new OrderFailure("invalid-request");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new OrderFailure("invalid-quantity");
    const next = (merged.get(productId) ?? 0) + quantity;
    if (next > 99) throw new OrderFailure("invalid-quantity");
    merged.set(productId, next);
  }
  if (merged.size > MAX_ITEMS) throw new OrderFailure("invalid-request", `最多 ${MAX_ITEMS} 种商品`);
  // 锁顺序：按 productId 字典序扣库存，避免相反顺序购物车的行锁环。
  return [...merged.entries()]
    .map(([productId, quantity]) => ({ productId, quantity }))
    .sort((a, b) => a.productId.localeCompare(b.productId));
}

export function createOrderService({ pool, repos, clock }) {
  async function checkout({ userId, items, clientOrderId }) {
    if (!validateClientOrderId(clientOrderId)) {
      throw new OrderFailure("invalid-request", "clientOrderId 必填（8–128 字符）");
    }
    const normalized = normalizeItems(items);
    const existing = await repos.orders.findByClientOrderId(pool, userId, clientOrderId);
    if (existing) return { status: "existing", order: existing };

    const now = clock();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const orderNumber = createOrderNumber(now, randomSuffix());
      try {
        const created = await withTransaction(pool, async (client) => {
          // 1) 事务内读取商品（价格快照 + listed 校验），按排序顺序
          const lines = [];
          let subtotalCents = 0;
          for (const { productId, quantity } of normalized) {
            const product = await repos.products.getForUpdate(client, productId);
            if (!product) throw new OrderFailure("product-not-found", productId);
            if (!product.listed) throw new OrderFailure("product-unlisted", productId);
            const subtotal = product.unitPriceCents * quantity;
            subtotalCents += subtotal;
            lines.push({
              productId,
              quantity,
              unitPriceCents: product.unitPriceCents,
              subtotalCents: subtotal,
            });
          }
          // 2) 先插入订单行，预留 (user_id, client_order_id) 幂等键
          const order = await repos.orders.create(client, {
            orderNumber,
            userId,
            clientOrderId,
            subtotalCents,
            createdAt: now.toISOString(),
          });
          // 3) 再条件扣库存（已排序）
          for (const line of lines) {
            const stock = await repos.orders.deductStock(client, line);
            if (stock === null) throw new OrderFailure("insufficient-stock", line.productId);
          }
          // 4) 明细 + 合计断言
          await repos.orders.createItems(client, order.orderId, lines);
          await repos.orders.assertSubtotal(client, order.orderId, subtotalCents);
          return order;
        });
        const order = await repos.orders.loadOrder(pool, created.orderId);
        return { status: "created", order };
      } catch (error) {
        if (error instanceof OrderFailure) throw error;
        if (isUniqueViolation(error)) {
          const constraint = constraintOf(error);
          if (constraint === "ux_orders_user_client") {
            const raced = await repos.orders.findByClientOrderId(pool, userId, clientOrderId);
            if (raced) return { status: "existing", order: raced };
            continue;
          }
          if (constraint === "orders_order_number_key") continue; // 换订单号重试
        }
        throw error;
      }
    }
    throw new OrderFailure("order-number-exhausted");
  }

  async function listMine(userId) {
    return repos.orders.listByUser(pool, userId);
  }

  async function getForViewer(orderNumber, viewer) {
    const order = await repos.orders.findByNumber(pool, orderNumber);
    // 存在性隐藏：他人订单一律 404（supersede D-32）。
    if (!order) throw new OrderFailure("order-not-found");
    if (viewer.role !== "admin" && order.userId !== viewer.id) throw new OrderFailure("order-not-found");
    return order;
  }

  async function listAll() {
    return repos.orders.listAll(pool);
  }

  return { checkout, listMine, getForViewer, listAll };
}
