// orders 数据访问：只做 SQL/事务内操作与行映射；业务分支在 services/orders.mjs。
function safeInt(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error(`unsafe integer from database: ${value}`);
  return number;
}

function mapItem(row) {
  return {
    productId: row.product_id,
    name: row.name,
    unit: row.unit,
    quantity: row.quantity,
    unitPriceCents: safeInt(row.unit_price_cents),
    subtotalCents: safeInt(row.subtotal_cents),
  };
}

function mapOrder(row, items) {
  return {
    orderNumber: row.order_number,
    userId: row.user_id,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    subtotalCents: safeInt(row.subtotal_cents),
    items,
  };
}

export async function itemsByOrderIds(pool, orderIds) {
  if (orderIds.length === 0) return new Map();
  const ids = orderIds.map((id) => safeInt(id));
  const result = await pool.query(
    `SELECT oi.order_id, oi.product_id, p.name, p.unit, oi.quantity,
            oi.unit_price_cents, oi.subtotal_cents
       FROM order_items oi JOIN products p ON p.product_id = oi.product_id
      WHERE oi.order_id = ANY($1::bigint[])
      ORDER BY oi.item_id`,
    [ids],
  );
  const grouped = new Map();
  for (const row of result.rows) {
    const key = safeInt(row.order_id);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(mapItem(row));
  }
  return grouped;
}

async function withItems(pool, rows) {
  const grouped = await itemsByOrderIds(pool, rows.map((row) => row.order_id));
  return rows.map((row) => mapOrder(row, grouped.get(safeInt(row.order_id)) ?? []));
}

export async function listByUser(pool, userId, { limit = 100 } = {}) {
  const result = await pool.query(
    `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC, order_id DESC LIMIT $2`,
    [userId, limit],
  );
  return withItems(pool, result.rows);
}

export async function listAll(pool, { limit = 100 } = {}) {
  const result = await pool.query(
    `SELECT o.*, u.username,
            (SELECT COUNT(*)::int FROM order_items oi WHERE oi.order_id = o.order_id) AS item_count
       FROM orders o JOIN users u ON u.user_id = o.user_id
      ORDER BY o.created_at DESC, o.order_id DESC
      LIMIT $1`,
    [limit],
  );
  const orders = await withItems(pool, result.rows);
  return orders.map((order, index) => ({
    ...order,
    username: result.rows[index].username,
    itemCount: result.rows[index].item_count,
  }));
}

export async function findByNumber(pool, orderNumber) {
  const result = await pool.query("SELECT * FROM orders WHERE order_number = $1", [orderNumber]);
  if (result.rowCount === 0) return null;
  const [order] = await withItems(pool, result.rows);
  return order;
}

export async function findByClientOrderId(pool, userId, clientOrderId) {
  const result = await pool.query(
    "SELECT * FROM orders WHERE user_id = $1 AND client_order_id = $2",
    [userId, clientOrderId],
  );
  if (result.rowCount === 0) return null;
  const [order] = await withItems(pool, result.rows);
  return order;
}

export async function create(client, { orderNumber, userId, clientOrderId, subtotalCents, createdAt }) {
  const result = await client.query(
    `INSERT INTO orders (order_number, user_id, client_order_id, subtotal_cents, created_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING order_id`,
    [orderNumber, userId, clientOrderId, subtotalCents, createdAt],
  );
  return { orderId: safeInt(result.rows[0].order_id), orderNumber };
}

export async function deductStock(client, { productId, quantity }) {
  const result = await client.query(
    `UPDATE products SET stock = stock - $1
      WHERE product_id = $2 AND stock >= $1
      RETURNING stock`,
    [quantity, productId],
  );
  return result.rowCount === 1 ? result.rows[0].stock : null;
}

export async function createItems(client, orderId, lines) {
  for (const line of lines) {
    await client.query(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents, subtotal_cents)
       VALUES ($1, $2, $3, $4, $5)`,
      [orderId, line.productId, line.quantity, line.unitPriceCents, line.subtotalCents],
    );
  }
}

export async function assertSubtotal(client, orderId, expectedCents) {
  const result = await client.query(
    "SELECT COALESCE(SUM(subtotal_cents), 0) AS total FROM order_items WHERE order_id = $1",
    [orderId],
  );
  const total = safeInt(result.rows[0].total);
  if (total !== expectedCents) {
    throw new Error(`order subtotal mismatch: ${total} != ${expectedCents}`);
  }
}

export async function loadOrder(pool, orderId) {
  const result = await pool.query("SELECT * FROM orders WHERE order_id = $1", [orderId]);
  if (result.rowCount === 0) return null;
  const [order] = await withItems(pool, result.rows);
  return order;
}
