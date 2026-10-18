// 前端 API 客户端：超时覆盖响应体、CSRF 头与 403 重试。
import test from "node:test";
import assert from "node:assert/strict";
import { createApiClient, ApiError, apiErrorMessage } from "../assets/api-client.mjs";

function setCookie(value) {
  globalThis.document = { cookie: value };
}

function clearCookie() {
  delete globalThis.document;
}

function jsonResponse(status, body, { setCookie } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    headers: { get: () => setCookie ?? null },
  };
}

test("timeout covers a response body that never resolves", async () => {
  setCookie("");
  try {
    const client = createApiClient({
      timeoutMs: 40,
      fetchImpl: async () => ({ ok: true, status: 200, text: () => new Promise(() => {}) }),
    });
    await assert.rejects(() => client.products(), (error) => error instanceof ApiError && error.code === "timeout");
  } finally {
    clearCookie();
  }
});

test("aborted fetch maps to timeout, network failure maps to network-error", async () => {
  setCookie("");
  try {
    const aborted = createApiClient({ timeoutMs: 1000, fetchImpl: async () => { throw Object.assign(new Error("abort"), { name: "AbortError" }); } });
    await assert.rejects(() => aborted.me(), (error) => error.code === "timeout");
    const network = createApiClient({ timeoutMs: 1000, fetchImpl: async () => { throw new Error("boom"); } });
    await assert.rejects(() => network.me(), (error) => error.code === "network-error");
  } finally {
    clearCookie();
  }
});

test("non-JSON success body maps to invalid-response", async () => {
  setCookie("");
  try {
    const client = createApiClient({ timeoutMs: 1000, fetchImpl: async () => ({ ok: true, status: 200, text: async () => "not json" }) });
    await assert.rejects(() => client.products(), (error) => error.code === "invalid-response");
  } finally {
    clearCookie();
  }
});

test("write requests send the CSRF cookie as X-CSRF-Token", async () => {
  setCookie("fruitlab_csrf=token-123");
  try {
    let seen = null;
    const client = createApiClient({
      timeoutMs: 1000,
      fetchImpl: async (path, init) => {
        seen = { path, header: init.headers["x-csrf-token"] };
        return jsonResponse(201, { ok: true, order: { orderNumber: "FL-20261018-000000-AAAA" } });
      },
    });
    await client.createOrder({ items: [{ productId: "banana", quantity: 1 }], clientOrderId: "client-order-0001" });
    assert.equal(seen.path, "/api/orders");
    assert.equal(seen.header, "token-123");
  } finally {
    clearCookie();
  }
});

test("csrf-token-invalid retries once with a refreshed token", async () => {
  setCookie("fruitlab_csrf=stale-token");
  try {
    let attempts = 0;
    const client = createApiClient({
      timeoutMs: 1000,
      fetchImpl: async (path) => {
        if (path === "/api/health") return jsonResponse(200, { ok: true, db: "up" });
        attempts += 1;
        if (attempts === 1) return jsonResponse(403, { ok: false, code: "csrf-token-invalid", message: "bad" });
        return jsonResponse(201, { ok: true, order: { orderNumber: "FL-20261018-000000-BBBB" } });
      },
    });
    await client.createOrder({ items: [{ productId: "banana", quantity: 1 }], clientOrderId: "client-order-0002" });
    assert.equal(attempts, 2);
  } finally {
    clearCookie();
  }
});

test("login is CSRF-exempt and does not bootstrap a token", async () => {
  setCookie("");
  try {
    let calls = 0;
    const client = createApiClient({
      timeoutMs: 1000,
      fetchImpl: async (path, init) => {
        calls += 1;
        assert.equal(init.headers["x-csrf-token"], undefined);
        return jsonResponse(200, { ok: true, user: { id: "U1", username: "userA", role: "user" } });
      },
    });
    const result = await client.login("userA", "demo1234");
    assert.equal(result.user.username, "userA");
    assert.equal(calls, 1);
  } finally {
    clearCookie();
  }
});

test("error messages map the R3 codes", () => {
  assert.equal(apiErrorMessage("order-not-found"), "未找到该订单。");
  assert.equal(apiErrorMessage("csrf-token-invalid"), "请求校验失败，请刷新页面并允许本站 Cookie 后重试。");
  assert.equal(apiErrorMessage("db-unavailable"), "数据库暂时不可用，请稍后刷新页面。");
  assert.equal(apiErrorMessage("auth-rate-limited"), "登录尝试过于频繁，请稍后再试。");
});
