import test from "node:test";
import assert from "node:assert/strict";
import { createTempDb, DEMO_PASSWORD } from "./helpers/db.mjs";
import { startTestServer, request, login } from "./helpers/server.mjs";

async function withServer(fn) {
  const temp = createTempDb();
  const server = await startTestServer(temp.db, temp.dbPath);
  try {
    await fn({ temp, ...server });
  } finally {
    await server.close();
    temp.close();
  }
}

test("GET /api/health reports version, schema and seed state", async () => {
  await withServer(async ({ base }) => {
    const res = await request(base, "GET", "/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.schemaVersion, 1);
    assert.equal(res.body.seeded, true);
    assert.equal(res.body.port > 0, true);
  });
});

test("GET /api/products returns 14 listed products", async () => {
  await withServer(async ({ base }) => {
    const res = await request(base, "GET", "/api/products");
    assert.equal(res.status, 200);
    assert.equal(res.body.products.length, 14);
    assert.equal(res.body.products[0].soldOut, false);
    assert.ok(res.body.products[0].image.endsWith(".jpg"));
  });
});

test("login, me, logout removes the server session", async () => {
  await withServer(async ({ base }) => {
    const { res, cookie } = await login(base, "userA", DEMO_PASSWORD);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.username, "userA");
    assert.match(res.headers["set-cookie"][0], /HttpOnly/);
    assert.match(res.headers["set-cookie"][0], /SameSite=Lax/);

    const me = await request(base, "GET", "/api/auth/me", { headers: { Cookie: cookie } });
    assert.equal(me.status, 200);
    assert.equal(me.body.user.username, "userA");

    const logout = await request(base, "POST", "/api/auth/logout", { headers: { Cookie: cookie } });
    assert.equal(logout.status, 204);

    const after = await request(base, "GET", "/api/auth/me", { headers: { Cookie: cookie } });
    assert.equal(after.status, 401);
    assert.equal(after.body.code, "auth-required");
  });
});

test("wrong password and unknown user share the same 401 code", async () => {
  await withServer(async ({ base }) => {
    const wrong = await request(base, "POST", "/api/auth/login", { body: { username: "userA", password: "wrong-password" } });
    const unknown = await request(base, "POST", "/api/auth/login", { body: { username: "nobody", password: "wrong-password" } });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.code, "auth-invalid-credentials");
    assert.equal(unknown.body.code, "auth-invalid-credentials");
  });
});

test("checkout requires auth, decrements stock and is idempotent", async () => {
  await withServer(async ({ base, temp }) => {
    const unauth = await request(base, "POST", "/api/orders", { body: { items: [{ productId: "fuji-apple", quantity: 1 }], clientOrderId: "c-unauth" } });
    assert.equal(unauth.status, 401);

    const { cookie } = await login(base, "userA", DEMO_PASSWORD);
    const before = temp.db.prepare("SELECT stock FROM products WHERE product_id = 'fuji-apple'").get().stock;
    const created = await request(base, "POST", "/api/orders", {
      headers: { Cookie: cookie },
      body: { items: [{ productId: "fuji-apple", quantity: 2 }], clientOrderId: "client-api-1" },
    });
    assert.equal(created.status, 201);
    assert.match(created.body.order.orderNumber, /^FL-\d{8}-\d{6}-[A-Z0-9]{4}$/);
    assert.equal(created.body.order.subtotalCents, 2598);
    assert.equal(temp.db.prepare("SELECT stock FROM products WHERE product_id = 'fuji-apple'").get().stock, before - 2);

    const again = await request(base, "POST", "/api/orders", {
      headers: { Cookie: cookie },
      body: { items: [{ productId: "fuji-apple", quantity: 2 }], clientOrderId: "client-api-1" },
    });
    assert.equal(again.status, 200);
    assert.equal(again.body.order.orderNumber, created.body.order.orderNumber);
    assert.equal(temp.db.prepare("SELECT COUNT(*) AS n FROM orders").get().n, 1);
  });
});

test("orders are isolated between users; admin can read all", async () => {
  await withServer(async ({ base }) => {
    const a = await login(base, "userA", DEMO_PASSWORD);
    const b = await login(base, "userB", DEMO_PASSWORD);
    const admin = await login(base, "admin", DEMO_PASSWORD);
    const created = await request(base, "POST", "/api/orders", {
      headers: { Cookie: a.cookie },
      body: { items: [{ productId: "banana", quantity: 1 }], clientOrderId: "client-iso-1" },
    });
    const orderNumber = created.body.order.orderNumber;

    const mineB = await request(base, "GET", "/api/orders/mine", { headers: { Cookie: b.cookie } });
    assert.equal(mineB.status, 200);
    assert.equal(mineB.body.orders.length, 0);

    const readB = await request(base, "GET", `/api/orders/${orderNumber}`, { headers: { Cookie: b.cookie } });
    assert.equal(readB.status, 403);
    assert.equal(readB.body.code, "order-not-owned");

    const readA = await request(base, "GET", `/api/orders/${orderNumber}`, { headers: { Cookie: a.cookie } });
    assert.equal(readA.status, 200);

    const all = await request(base, "GET", "/api/admin/orders", { headers: { Cookie: admin.cookie } });
    assert.equal(all.status, 200);
    assert.equal(all.body.orders.length, 1);

    const forbidden = await request(base, "GET", "/api/admin/orders", { headers: { Cookie: a.cookie } });
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.code, "auth-forbidden");
  });
});

test("admin can list unlisted products, change price/stock/listing", async () => {
  await withServer(async ({ base }) => {
    const admin = await login(base, "admin", DEMO_PASSWORD);
    const user = await login(base, "userA", DEMO_PASSWORD);

    const adminProducts = await request(base, "GET", "/api/admin/products", { headers: { Cookie: admin.cookie } });
    assert.equal(adminProducts.status, 200);
    assert.equal(adminProducts.body.products.length, 14);

    const patchPrice = await request(base, "PATCH", "/api/admin/products/fuji-apple", {
      headers: { Cookie: admin.cookie },
      body: { unitPriceCents: 999 },
    });
    assert.equal(patchPrice.status, 200);
    assert.equal(patchPrice.body.product.unitPriceCents, 999);

    const patchStock = await request(base, "PATCH", "/api/admin/products/fuji-apple", {
      headers: { Cookie: admin.cookie },
      body: { stock: 0 },
    });
    assert.equal(patchStock.status, 200);
    assert.equal(patchStock.body.product.soldOut, true);

    const patchListed = await request(base, "PATCH", "/api/admin/products/fuji-apple", {
      headers: { Cookie: admin.cookie },
      body: { listed: 0 },
    });
    assert.equal(patchListed.status, 200);

    const publicList = await request(base, "GET", "/api/products");
    assert.equal(publicList.body.products.some((p) => p.id === "fuji-apple"), false);

    const forbidden = await request(base, "PATCH", "/api/admin/products/fuji-apple", {
      headers: { Cookie: user.cookie },
      body: { stock: 5 },
    });
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.code, "auth-forbidden");
  });
});

test("input and protocol errors use stable codes", async () => {
  await withServer(async ({ base }) => {
    const wrongType = await request(base, "POST", "/api/auth/login", {
      body: "not json",
      headers: { "Content-Type": "text/plain" },
    });
    assert.equal(wrongType.status, 415);
    assert.equal(wrongType.body.code, "unsupported-media-type");

    const badJson = await request(base, "POST", "/api/auth/login", { body: "{not-json" });
    assert.equal(badJson.status, 400);
    assert.equal(badJson.body.code, "invalid-json");

    const tooLarge = await request(base, "POST", "/api/auth/login", {
      body: JSON.stringify({ username: "a", password: "b".repeat(70_000) }),
    });
    assert.equal(tooLarge.status, 413);
    assert.equal(tooLarge.body.code, "payload-too-large");

    const method = await request(base, "GET", "/api/auth/login");
    assert.equal(method.status, 405);
    assert.equal(method.headers.allow, "POST");

    const unknown = await request(base, "GET", "/api/nope");
    assert.equal(unknown.status, 404);
    assert.equal(unknown.body.code, "not-found");
  });
});

test("cross-origin and bad Host are rejected", async () => {
  await withServer(async ({ base }) => {
    const origin = await request(base, "POST", "/api/auth/login", {
      body: { username: "userA", password: DEMO_PASSWORD },
      headers: { Origin: "http://evil.example" },
    });
    assert.equal(origin.status, 403);
    assert.equal(origin.body.code, "cross-origin-blocked");

    const host = await request(base, "GET", "/api/products", { headers: { Host: "evil.example" } });
    assert.equal(host.status, 403);
    assert.equal(host.body.code, "host-not-allowed");
  });
});

test("static files are served with the CSP header", async () => {
  await withServer(async ({ base }) => {
    const res = await request(base, "GET", "/SPEC.md");
    assert.equal(res.status, 200);
    assert.match(String(res.headers["content-security-policy"]), /connect-src 'self'/);
    assert.equal(res.headers["x-content-type-options"], "nosniff");
  });
});
