// HTTP API 集成测试：真实服务器 + 真实 Postgres。
import test from "node:test";
import assert from "node:assert/strict";
import { createTestDatabase } from "./helpers/pg.mjs";
import { startTestServer, request, login, cookieValue } from "./helpers/server.mjs";
import { hashToken, createSessionToken } from "../server/auth.mjs";
import { createHealthService } from "../server/services/health.mjs";
import { createPool } from "../server/db.mjs";

async function withEnv(fn, { seed = true } = {}) {
  const db = await createTestDatabase({ seed });
  const server = await startTestServer(db.url);
  try {
    await fn({ db, server });
  } finally {
    await server.close();
    await db.close();
  }
}

function authHeaders(csrfToken) {
  return csrfToken ? { "x-csrf-token": csrfToken } : {};
}

test("health and products expose the expected contract", async () => {
  await withEnv(async ({ server }) => {
    const health = await request(server.base, "GET", "/api/health");
    assert.equal(health.status, 200);
    assert.equal(health.body.ok, true);
    assert.equal(health.body.db, "up");
    assert.equal(health.body.schemaVersion, 1);
    assert.equal(health.body.seeded, true);
    const products = await request(server.base, "GET", "/api/products");
    assert.equal(products.status, 200);
    assert.equal(products.body.products.length, 14);
    assert.equal(products.body.products[0].soldOut, false);
  });
});

test("register/login/me/logout use one user shape and HttpOnly cookies", async () => {
  await withEnv(async ({ server }) => {
    const registered = await request(server.base, "POST", "/api/auth/register", { body: { username: "new-user", password: "password-123" } });
    assert.equal(registered.status, 201);
    assert.deepEqual(Object.keys(registered.body.user).sort(), ["id", "role", "username"]);

    const { res, session, csrfToken } = await login(server.base, "new-user", "password-123");
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body.user).sort(), ["id", "role", "username"]);
    const sessionCookieText = res.setCookies.find((item) => item.startsWith("fruitlab_session=")) ?? "";
    assert.match(sessionCookieText, /HttpOnly/);
    assert.match(sessionCookieText, /SameSite=Lax/);
    assert.match(sessionCookieText, /Max-Age=86400/);
    assert.ok(session);
    assert.ok(csrfToken);

    const me = await request(server.base, "GET", "/api/auth/me", { cookies: [session] });
    assert.equal(me.status, 200);
    assert.equal(me.body.user.username, "new-user");

    const logout = await request(server.base, "POST", "/api/auth/logout", { cookies: [session, `fruitlab_csrf=${csrfToken}`], headers: authHeaders(csrfToken) });
    assert.equal(logout.status, 204);
    const after = await request(server.base, "GET", "/api/auth/me", { cookies: [session] });
    assert.equal(after.status, 401);
    assert.equal(after.body.code, "auth-required");
  });
});

test("checkout creates an order and is idempotent by clientOrderId", async () => {
  await withEnv(async ({ server }) => {
    const { session, csrfToken } = await login(server.base);
    const order = {
      items: [{ productId: "banana", quantity: 2 }],
      clientOrderId: "api-order-0001",
    };
    const first = await request(server.base, "POST", "/api/orders", {
      body: order,
      cookies: [session, `fruitlab_csrf=${csrfToken}`],
      headers: authHeaders(csrfToken),
    });
    assert.equal(first.status, 201);
    assert.equal(first.body.order.items[0].quantity, 2);
    const second = await request(server.base, "POST", "/api/orders", {
      body: order,
      cookies: [session, `fruitlab_csrf=${csrfToken}`],
      headers: authHeaders(csrfToken),
    });
    assert.equal(second.status, 200);
    assert.equal(second.body.order.orderNumber, first.body.order.orderNumber);
    const mine = await request(server.base, "GET", "/api/orders/mine", { cookies: [session] });
    assert.equal(mine.body.orders.length, 1);
  });
});

test("other users' orders return 404; admin can read any order", async () => {
  await withEnv(async ({ server }) => {
    const userA = await login(server.base, "userA", "demo1234");
    const created = await request(server.base, "POST", "/api/orders", {
      body: { items: [{ productId: "banana", quantity: 1 }], clientOrderId: "api-order-0002" },
      cookies: [userA.session, `fruitlab_csrf=${userA.csrfToken}`],
      headers: authHeaders(userA.csrfToken),
    });
    const orderNumber = created.body.order.orderNumber;
    const userB = await login(server.base, "userB", "demo1234");
    const forbidden = await request(server.base, "GET", `/api/orders/${orderNumber}`, { cookies: [userB.session] });
    assert.equal(forbidden.status, 404);
    assert.equal(forbidden.body.code, "order-not-found");
    const admin = await login(server.base, "admin", "demo1234");
    const visible = await request(server.base, "GET", `/api/orders/${orderNumber}`, { cookies: [admin.session] });
    assert.equal(visible.status, 200);
    assert.equal(visible.body.order.orderNumber, orderNumber);
  });
});

test("admin endpoints enforce role and allow product updates", async () => {
  await withEnv(async ({ server }) => {
    const user = await login(server.base, "userA", "demo1234");
    const denied = await request(server.base, "GET", "/api/admin/orders", { cookies: [user.session] });
    assert.equal(denied.status, 403);
    assert.equal(denied.body.code, "auth-forbidden");

    const admin = await login(server.base, "admin", "demo1234");
    const all = await request(server.base, "GET", "/api/admin/products", { cookies: [admin.session] });
    assert.equal(all.status, 200);
    assert.equal(all.body.products.length, 14);

    const patched = await request(server.base, "PATCH", "/api/admin/products/banana", {
      body: { unitPriceCents: 1111, stock: 5, listed: false },
      cookies: [admin.session, `fruitlab_csrf=${admin.csrfToken}`],
      headers: authHeaders(admin.csrfToken),
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.product.unitPriceCents, 1111);
    assert.equal(patched.body.product.listed, false);
    const publicList = await request(server.base, "GET", "/api/products");
    assert.equal(publicList.body.products.length, 13);
  });
});

test("405 table covers exact and dynamic routes with correct Allow", async () => {
  await withEnv(async ({ server }) => {
    const cases = [
      ["GET", "/api/orders", "POST"],
      ["PUT", "/api/products", "GET"],
      ["PATCH", "/api/orders/FL-20261018-000000-AAAA", "GET"],
      ["GET", "/api/admin/products/fuji-apple", "PATCH"],
      ["DELETE", "/api/auth/login", "POST"],
    ];
    for (const [method, path, allowed] of cases) {
      const response = await request(server.base, method, path, method === "PATCH" ? { body: {} } : {});
      assert.equal(response.status, 405, `${method} ${path}`);
      assert.equal(response.headers.allow, allowed, `${method} ${path} Allow`);
      assert.equal(response.body.code, "allow");
    }
  });
});

test("validation/protocol priority beats auth (415/413/400 before 401)", async () => {
  await withEnv(async ({ server }) => {
    const invalidJson = await request(server.base, "POST", "/api/orders", {
      body: "{not-json",
      headers: { "content-type": "application/json" },
    });
    assert.equal(invalidJson.status, 400);
    assert.equal(invalidJson.body.code, "invalid-json");

    const wrongType = await request(server.base, "POST", "/api/orders", {
      body: JSON.stringify({ items: [] }),
      headers: { "content-type": "text/plain" },
    });
    assert.equal(wrongType.status, 415);
    assert.equal(wrongType.body.code, "unsupported-media-type");

    const huge = await request(server.base, "POST", "/api/orders", {
      body: JSON.stringify({ pad: "x".repeat(70 * 1024) }),
    });
    assert.equal(huge.status, 413);
    assert.equal(huge.body.code, "payload-too-large");

    const unauthenticated = await request(server.base, "GET", "/api/orders/mine");
    assert.equal(unauthenticated.status, 401);
  });
});

test("CSRF token is required for session-bearing writes", async () => {
  await withEnv(async ({ server }) => {
    const { session, csrfToken } = await login(server.base);
    const missing = await request(server.base, "POST", "/api/orders", {
      body: { items: [{ productId: "banana", quantity: 1 }], clientOrderId: "api-csrf-0001" },
      cookies: [session],
    });
    assert.equal(missing.status, 403);
    assert.equal(missing.body.code, "csrf-token-invalid");
    const wrong = await request(server.base, "POST", "/api/orders", {
      body: { items: [{ productId: "banana", quantity: 1 }], clientOrderId: "api-csrf-0002" },
      cookies: [session, `fruitlab_csrf=${csrfToken}`],
      headers: { "x-csrf-token": "wrong-token" },
    });
    assert.equal(wrong.status, 403);
    assert.equal(wrong.body.code, "csrf-token-invalid");
    const ok = await request(server.base, "POST", "/api/orders", {
      body: { items: [{ productId: "banana", quantity: 1 }], clientOrderId: "api-csrf-0003" },
      cookies: [session, `fruitlab_csrf=${csrfToken}`],
      headers: authHeaders(csrfToken),
    });
    assert.equal(ok.status, 201);
  });
});

test("login rate limiting returns 429 with Retry-After", async () => {
  await withEnv(async ({ server }) => {
    for (let index = 0; index < 5; index += 1) {
      const response = await request(server.base, "POST", "/api/auth/login", { body: { username: "userA", password: "wrong-password" } });
      assert.equal(response.status, 401);
    }
    const limited = await request(server.base, "POST", "/api/auth/login", { body: { username: "userA", password: "demo1234" } });
    assert.equal(limited.status, 429);
    assert.equal(limited.body.code, "auth-rate-limited");
    assert.ok(Number(limited.headers["retry-after"]) > 0);
  });
});

test("expired sessions are rejected", async () => {
  await withEnv(async ({ db, server }) => {
    const token = createSessionToken();
    const user = await db.pool.query("SELECT user_id FROM users WHERE username = 'userA'");
    await db.pool.query(
      "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ($1, $2, now() - interval '2 hours', now() - interval '1 hour')",
      [hashToken(token), user.rows[0].user_id],
    );
    const response = await request(server.base, "GET", "/api/auth/me", { cookies: [`fruitlab_session=${token}`] });
    assert.equal(response.status, 401);
    assert.equal(response.body.code, "auth-required");
  });
});

test("malformed paths and cross-origin/host guards return stable codes", async () => {
  await withEnv(async ({ server }) => {
    const malformed = await request(server.base, "GET", "/api/orders/%zz");
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.code, "invalid-path");
    const encodedSlash = await request(server.base, "GET", "/api/orders/%2f");
    assert.equal(encodedSlash.status, 404);
    const badHost = await request(server.base, "GET", "/api/health", { headers: { host: "evil.example:4175" } });
    assert.equal(badHost.status, 403);
    assert.equal(badHost.body.code, "host-not-allowed");
    const crossOrigin = await request(server.base, "POST", "/api/auth/login", {
      body: { username: "userA", password: "demo1234" },
      headers: { origin: "http://evil.example" },
    });
    assert.equal(crossOrigin.status, 403);
    assert.equal(crossOrigin.body.code, "cross-origin-blocked");
  });
});

test("health returns 503 quickly when the pool cannot connect", async () => {
  const pool = createPool({
    connectionString: "postgres://postgres:postgres@127.0.0.1:1/postgres",
    max: 1,
    connectionTimeoutMs: 200,
  });
  try {
    const service = createHealthService({
      pool,
      config: { healthTimeoutMs: 500 },
      clock: () => new Date(),
    });
    const started = Date.now();
    const health = await service.health({ version: "test" });
    const elapsed = Date.now() - started;
    assert.equal(health.ok, false);
    assert.equal(health.code, "db-unavailable");
    assert.ok(elapsed < 3000, `health took ${elapsed}ms`);
  } finally {
    await pool.end();
  }
});
