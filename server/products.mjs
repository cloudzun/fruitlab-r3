// 商品读写。
export function rowToProduct(row) {
  return {
    id: row.product_id,
    name: row.name,
    unit: row.unit,
    unitPriceCents: row.unit_price_cents,
    stock: row.stock,
    listed: row.listed === 1,
    soldOut: row.stock <= 0,
    image: row.image_path,
    alt: row.image_alt,
    description: row.description,
    sortOrder: row.sort_order,
  };
}

export function listProducts(db, { includeUnlisted = false } = {}) {
  const sql = includeUnlisted
    ? "SELECT * FROM products ORDER BY sort_order, product_id"
    : "SELECT * FROM products WHERE listed = 1 ORDER BY sort_order, product_id";
  return db.prepare(sql).all().map(rowToProduct);
}

export function getProduct(db, productId) {
  const row = db.prepare("SELECT * FROM products WHERE product_id = ?").get(productId);
  return row ? rowToProduct(row) : null;
}

export function updateProduct(db, productId, patch) {
  const current = getProduct(db, productId);
  if (!current) return { ok: false, code: "product-not-found" };
  const fields = [];
  const values = [];
  if (patch.unitPriceCents !== undefined) {
    if (!Number.isInteger(patch.unitPriceCents) || patch.unitPriceCents < 0 || patch.unitPriceCents > 9_999_999) {
      return { ok: false, code: "invalid-price" };
    }
    fields.push("unit_price_cents = ?");
    values.push(patch.unitPriceCents);
  }
  if (patch.stock !== undefined) {
    if (!Number.isInteger(patch.stock) || patch.stock < 0 || patch.stock > 99_999) {
      return { ok: false, code: "invalid-stock" };
    }
    fields.push("stock = ?");
    values.push(patch.stock);
  }
  if (patch.listed !== undefined) {
    if (patch.listed !== 0 && patch.listed !== 1 && patch.listed !== false && patch.listed !== true) {
      return { ok: false, code: "invalid-listed" };
    }
    fields.push("listed = ?");
    values.push(patch.listed ? 1 : 0);
  }
  if (fields.length === 0) return { ok: false, code: "invalid-request", details: "no updatable fields" };
  values.push(productId);
  db.prepare(`UPDATE products SET ${fields.join(", ")} WHERE product_id = ?`).run(...values);
  return { ok: true, product: getProduct(db, productId) };
}
