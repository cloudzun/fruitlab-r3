// products 数据访问：只做 SQL 与行映射。
export function rowToProduct(row) {
  return {
    id: row.product_id,
    name: row.name,
    unit: row.unit,
    unitPriceCents: Number(row.unit_price_cents),
    stock: row.stock,
    listed: row.listed,
    soldOut: row.stock <= 0,
    image: row.image_path,
    alt: row.image_alt,
    description: row.description,
    sortOrder: row.sort_order,
  };
}

export async function list(pool, { includeUnlisted = false } = {}) {
  const sql = includeUnlisted
    ? "SELECT * FROM products ORDER BY sort_order, product_id"
    : "SELECT * FROM products WHERE listed = true ORDER BY sort_order, product_id";
  const result = await pool.query(sql);
  return result.rows.map(rowToProduct);
}

export async function get(pool, productId) {
  const result = await pool.query("SELECT * FROM products WHERE product_id = $1", [productId]);
  return result.rowCount === 0 ? null : rowToProduct(result.rows[0]);
}

// 事务内读取（价格快照/上下架校验必须与扣库存同一事务）。
export async function getForUpdate(client, productId) {
  const result = await client.query("SELECT * FROM products WHERE product_id = $1", [productId]);
  return result.rowCount === 0 ? null : rowToProduct(result.rows[0]);
}

export async function update(client, productId, patch) {
  const sets = [];
  const values = [];
  if (patch.unitPriceCents !== undefined) {
    sets.push(`unit_price_cents = $${values.length + 1}`);
    values.push(patch.unitPriceCents);
  }
  if (patch.stock !== undefined) {
    sets.push(`stock = $${values.length + 1}`);
    values.push(patch.stock);
  }
  if (patch.listed !== undefined) {
    sets.push(`listed = $${values.length + 1}`);
    values.push(patch.listed);
  }
  if (sets.length === 0) return null;
  values.push(productId);
  const result = await client.query(
    `UPDATE products SET ${sets.join(", ")} WHERE product_id = $${values.length} RETURNING *`,
    values,
  );
  return result.rowCount === 0 ? null : rowToProduct(result.rows[0]);
}
