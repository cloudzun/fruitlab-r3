import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCT_SEED } from "../server/db.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

test("all 14 product images exist with JPEG magic", () => {
  for (const product of PRODUCT_SEED) {
    const file = path.join(ROOT, "assets", "images", "products", `${product.id}.jpg`);
    assert.equal(fs.existsSync(file), true, `missing ${product.id}.jpg`);
    const buffer = fs.readFileSync(file);
    assert.equal(buffer[0], 0xff, `${product.id} magic 0`);
    assert.equal(buffer[1], 0xd8, `${product.id} magic 1`);
    assert.equal(buffer[2], 0xff, `${product.id} magic 2`);
    assert.equal(buffer.length <= 300 * 1024, true, `${product.id} too large`);
  }
});

test("assets-manifest.json records license, source and matching sha256", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "evidence", "assets-manifest.json"), "utf8"));
  assert.equal(manifest.length, 14);
  const ids = new Set(manifest.map((entry) => entry.product_id));
  assert.equal(ids.size, 14);
  for (const entry of manifest) {
    assert.equal(typeof entry.license, "string");
    assert.equal(["cc0", "by", "by-sa", "public-domain"].includes(entry.license), true, `${entry.product_id} license ${entry.license}`);
    assert.match(entry.source_url, /^https?:\/\//);
    const file = path.join(ROOT, entry.file);
    const digest = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    assert.equal(digest, entry.sha256, `${entry.product_id} sha256 mismatch`);
  }
});

test("credits ledger lists every product image", () => {
  const credits = fs.readFileSync(path.join(ROOT, "docs", "assets-credits.md"), "utf8");
  for (const product of PRODUCT_SEED) {
    assert.equal(credits.includes(product.id), true, `credits missing ${product.id}`);
  }
});
