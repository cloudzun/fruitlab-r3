// FruitLab R3 前端 API 客户端。
// 约定：同源 Cookie（credentials: "same-origin"）、JSON 请求/响应、
// 失败体 {ok:false, code, message, details?}；文案按 code 映射，不用笼统提示。
// 本文件是前端唯一允许调用 fetch 的模块。
// 超时覆盖 fetch + 响应体读取 + JSON 解析；写请求自动带 CSRF token，403 时重试一次。

const DEFAULT_TIMEOUT_MS = 15_000;
const CSRF_COOKIE = "fruitlab_csrf";
const CSRF_HEADER = "x-csrf-token";

// 与 docs/error-catalog.md 的码表对齐；前端只负责把它翻成具体可执行的文案。
export const API_ERROR_MESSAGES = Object.freeze({
  "invalid-request": "提交的内容不完整或格式不正确，请检查后重试。",
  "invalid-json": "请求内容无法解析，请刷新页面后重试。",
  "invalid-path": "请求地址格式不正确，请从站内入口重新操作。",
  "invalid-quantity": "数量需为 1 到 99 的整数。",
  "invalid-price": "价格需为 0 到 9999999 的整数（单位：分）。",
  "invalid-stock": "库存需为 0 到 99999 的整数。",
  "invalid-listed": "上架状态只能是上架或下架。",
  "invalid-username": "用户名需为 3 到 32 位字母、数字、下划线或短横线。",
  "invalid-password": "口令长度需为 8 到 128 位。",
  "auth-required": "请先登录后再操作。",
  "auth-invalid-credentials": "用户名或口令不正确。",
  "auth-forbidden": "当前账号没有该操作权限。",
  "csrf-token-invalid": "请求校验失败，请刷新页面并允许本站 Cookie 后重试。",
  "cross-origin-blocked": "请求来源不被信任，请从本站页面重新操作。",
  "host-not-allowed": "访问地址不在允许范围，请使用 127.0.0.1 或 localhost 打开本页。",
  "product-not-found": "商品不存在或已被删除。",
  "order-not-found": "未找到该订单。",
  "not-found": "请求的资源不存在。",
  allow: "服务端不支持该请求方式。",
  "auth-username-taken": "用户名已被占用，请换一个。",
  "insufficient-stock": "库存不足，请减少数量后重试。",
  "product-unlisted": "商品已下架，无法下单。",
  "duplicate-order-number": "订单号重复，请重新提交。",
  "order-number-exhausted": "订单号生成失败，请稍后重试。",
  "payload-too-large": "提交内容超过大小上限。",
  "unsupported-media-type": "请求格式不受支持，请刷新页面后重试。",
  "auth-rate-limited": "登录尝试过于频繁，请稍后再试。",
  "server-busy": "服务繁忙，请稍后重试。",
  "db-unavailable": "数据库暂时不可用，请稍后刷新页面。",
  "internal-error": "服务端内部错误，请稍后重试。",
  "network-error": "网络请求失败，请检查本地服务是否仍在运行。",
  timeout: "请求超时，服务端未在预期时间内响应。",
  "invalid-response": "服务端返回的内容无法解析。",
});

// 这些结果代表「请求可能已生效但客户端未拿到确认」，用于 save-unknown 判定。
export const UNKNOWN_RESULT_CODES = Object.freeze(["network-error", "timeout", "invalid-response"]);

export function apiErrorMessage(code, fallback) {
  if (typeof code === "string" && Object.hasOwn(API_ERROR_MESSAGES, code)) {
    return API_ERROR_MESSAGES[code];
  }
  if (typeof fallback === "string" && fallback.trim() !== "") {
    return fallback.trim();
  }
  return API_ERROR_MESSAGES["internal-error"];
}

export class ApiError extends Error {
  constructor({ code, status = 0, details, message } = {}) {
    super(apiErrorMessage(code, message));
    this.name = "ApiError";
    this.code = typeof code === "string" && code !== "" ? code : "internal-error";
    this.status = Number.isInteger(status) ? status : 0;
    this.details = details;
    this.serverMessage = typeof message === "string" ? message : "";
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readCookie(name) {
  const cookie = typeof globalThis.document === "object" ? globalThis.document?.cookie : "";
  if (typeof cookie !== "string" || cookie === "") return "";
  for (const part of cookie.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      try { return decodeURIComponent(part.slice(index + 1).trim()); } catch { return ""; }
    }
  }
  return "";
}

function defaultFetch(...args) {
  if (typeof globalThis.fetch !== "function") throw new ApiError({ code: "network-error" });
  return globalThis.fetch(...args);
}

function isCsrfExempt(path) {
  return path === "/api/auth/login" || path === "/api/auth/register";
}

export function createApiClient(options = {}) {
  const fetchImpl = typeof options.fetchImpl === "function" ? options.fetchImpl : defaultFetch;
  const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs >= 0 ? options.timeoutMs : DEFAULT_TIMEOUT_MS;

  async function rawRequest(path, { method = "GET", body, headers: extraHeaders = {} } = {}) {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller && timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
    const headers = { Accept: "application/json", ...extraHeaders };
    const init = { method, credentials: "same-origin", headers, cache: "no-store" };
    if (controller) init.signal = controller.signal;
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    let abortPromise = null;
    if (controller) {
      abortPromise = new Promise((_, reject) => {
        controller.signal.addEventListener(
          "abort",
          () => reject(Object.assign(new Error("request aborted"), { name: "AbortError" })),
          { once: true },
        );
      });
    }
    let response;
    let text = "";
    try {
      try {
        response = await (abortPromise ? Promise.race([fetchImpl(path, init), abortPromise]) : fetchImpl(path, init));
      } catch (error) {
        const aborted = Boolean(error) && error.name === "AbortError";
        throw new ApiError({ code: aborted ? "timeout" : "network-error" });
      }
      try {
        const textPromise = typeof response?.text === "function" ? response.text() : Promise.resolve("");
        text = await (abortPromise ? Promise.race([textPromise, abortPromise]) : textPromise);
      } catch (error) {
        const aborted = Boolean(error) && error.name === "AbortError";
        throw new ApiError({ code: aborted ? "timeout" : "invalid-response", status: response?.status });
      }
    } finally {
      if (timer) clearTimeout(timer);
    }
    const status = Number.isInteger(response?.status) ? response.status : 0;
    let payload = null;
    if (typeof text === "string" && text.trim() !== "") {
      try { payload = JSON.parse(text); } catch { payload = null; }
    }
    if (!response?.ok || payload?.ok === false) {
      const code = typeof payload?.code === "string" && payload.code !== "" ? payload.code : `http-${status}`;
      throw new ApiError({
        code,
        status,
        details: payload?.details,
        message: typeof payload?.message === "string" ? payload.message : "",
      });
    }
    if (status === 204 || (typeof text === "string" && text.trim() === "")) return { ok: true };
    if (!isPlainObject(payload) || payload.ok !== true) throw new ApiError({ code: "invalid-response", status });
    return payload;
  }

  async function ensureCsrfToken() {
    if (readCookie(CSRF_COOKIE)) return readCookie(CSRF_COOKIE);
    try {
      await rawRequest("/api/health");
    } catch {
      /* 取 token 失败由调用方按具体请求错误处理 */
    }
    return readCookie(CSRF_COOKIE);
  }

  async function request(path, options = {}, csrfRetry = true) {
    const method = options.method ?? "GET";
    const stateChanging = method === "POST" || method === "PATCH";
    let token = "";
    if (stateChanging && !isCsrfExempt(path)) {
      token = readCookie(CSRF_COOKIE) || (await ensureCsrfToken());
    }
    try {
      return await rawRequest(path, {
        ...options,
        headers: { ...(options.headers ?? {}), ...(token ? { [CSRF_HEADER]: token } : {}) },
      });
    } catch (error) {
      if (csrfRetry && stateChanging && error instanceof ApiError && error.code === "csrf-token-invalid") {
        await ensureCsrfToken();
        return request(path, options, false);
      }
      throw error;
    }
  }

  return Object.freeze({
    register(username, password) {
      return request("/api/auth/register", { method: "POST", body: { username, password } });
    },
    login(username, password) {
      return request("/api/auth/login", { method: "POST", body: { username, password } });
    },
    logout() {
      return request("/api/auth/logout", { method: "POST" });
    },
    me() {
      return request("/api/auth/me");
    },
    products() {
      return request("/api/products");
    },
    createOrder({ items, clientOrderId }) {
      return request("/api/orders", { method: "POST", body: { items, clientOrderId } });
    },
    myOrders() {
      return request("/api/orders/mine");
    },
    order(orderNumber) {
      return request(`/api/orders/${encodeURIComponent(orderNumber)}`);
    },
    adminOrders() {
      return request("/api/admin/orders");
    },
    adminProducts() {
      return request("/api/admin/products");
    },
    updateProduct(productId, patch) {
      return request(`/api/admin/products/${encodeURIComponent(productId)}`, { method: "PATCH", body: patch });
    },
    ensureCsrfToken,
  });
}
