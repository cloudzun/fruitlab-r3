// 商品用例：公开列表、管理列表、管理端更新（校验在此，SQL 在 repositories）。
import { AuthFailure } from "./auth.mjs";

export function createCatalogService({ pool, repos }) {
  async function listPublic() {
    return repos.products.list(pool, { includeUnlisted: false });
  }

  async function listAdmin() {
    return repos.products.list(pool, { includeUnlisted: true });
  }

  async function updateProduct(id, patch) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new AuthFailure("invalid-request");
    if (patch.unitPriceCents !== undefined) {
      if (!Number.isInteger(patch.unitPriceCents) || patch.unitPriceCents < 0 || patch.unitPriceCents > 9_999_999) {
        throw new AuthFailure("invalid-price");
      }
    }
    if (patch.stock !== undefined) {
      if (!Number.isInteger(patch.stock) || patch.stock < 0 || patch.stock > 99_999) throw new AuthFailure("invalid-stock");
    }
    if (patch.listed !== undefined) {
      if (patch.listed !== 0 && patch.listed !== 1 && patch.listed !== false && patch.listed !== true) {
        throw new AuthFailure("invalid-listed");
      }
    }
    const normalized = {
      ...(patch.unitPriceCents !== undefined ? { unitPriceCents: patch.unitPriceCents } : {}),
      ...(patch.stock !== undefined ? { stock: patch.stock } : {}),
      ...(patch.listed !== undefined ? { listed: Boolean(patch.listed) } : {}),
    };
    if (Object.keys(normalized).length === 0) throw new AuthFailure("invalid-request", "no updatable fields");
    const product = await repos.products.update(pool, id, normalized);
    if (!product) throw new AuthFailure("product-not-found");
    return product;
  }

  return { listPublic, listAdmin, updateProduct };
}
