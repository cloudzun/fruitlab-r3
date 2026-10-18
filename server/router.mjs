// HTTP 层：只做协议（Host/Origin、体读取、路由/405、信封、Cookie、状态码）。
// 依赖规则：不得 import pg / repositories / db（tests/layering.test.mjs 断言）。
import crypto from "node:crypto";
import { errorBody, statusFor, toAppError, isConnectionError, isKnownAppCode } from "./errors.mjs";
import {
  COOKIE_NAME,
  CSRF_COOKIE_NAME,
  parseCookies,
  sessionCookie,
  clearSessionCookie,
  csrfCookie,
  clearCsrfCookie,
  createCsrfToken,
} from "./auth.mjs";

const MAX_BODY_BYTES = 64 * 1024;

const EXACT_ROUTES = Object.freeze({
  "/api/health": ["GET"],
  "/api/products": ["GET"],
  "/api/auth/register": ["POST"],
  "/api/auth/login": ["POST"],
  "/api/auth/logout": ["POST"],
  "/api/auth/me": ["GET"],
  "/api/orders": ["POST"],
  "/api/orders/mine": ["GET"],
  "/api/admin/orders": ["GET"],
  "/api/admin/products": ["GET"],
});

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  });
  res.end(payload);
}

function hostAllowedSets(config) {
  const set = new Set();
  set.add(config.publicOrigin.host);
  const publicPort = config.publicOrigin.port || (config.publicOrigin.protocol === "https:" ? "443" : "80");
  set.add(`127.0.0.1:${publicPort}`);
  set.add(`localhost:${publicPort}`);
  set.add(`127.0.0.1:${config.port}`);
  set.add(`localhost:${config.port}`);
  if (config.port === 80) {
    set.add("127.0.0.1");
    set.add("localhost");
  }
  return set;
}

function originAllowed(config, origin) {
  if (!origin) return true;
  const allowed = new Set([config.publicOrigin.origin, `http://${config.publicOrigin.host}`]);
  if (config.publicOrigin.protocol === "https:") allowed.add(`https://${config.publicOrigin.host}`);
  return allowed.has(origin);
}

function checkGuards(req, config) {
  const host = String(req.headers.host ?? "");
  if (!hostAllowedSets(config).has(host)) return "host-not-allowed";
  const origin = req.headers.origin;
  if (origin !== undefined && !originAllowed(config, origin)) return "cross-origin-blocked";
  const site = req.headers["sec-fetch-site"];
  if (site !== undefined && site !== "same-origin" && site !== "none") return "cross-origin-blocked";
  return null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    });
    req.on("end", () => resolve({ tooLarge, raw: Buffer.concat(chunks).toString("utf8") }));
    req.on("error", reject);
  });
}

async function readJsonBody(req) {
  const type = String(req.headers["content-type"] ?? "");
  if (!/^application\/json\b/i.test(type)) return { ok: false, code: "unsupported-media-type" };
  const { tooLarge, raw } = await readBody(req);
  if (tooLarge) return { ok: false, code: "payload-too-large" };
  if (raw.trim() === "") return { ok: true, body: {} };
  try {
    return { ok: true, body: JSON.parse(raw) };
  } catch {
    return { ok: false, code: "invalid-json" };
  }
}

function routeFor(pathname) {
  if (Object.hasOwn(EXACT_ROUTES, pathname)) return { allowed: EXACT_ROUTES[pathname], kind: "exact" };
  const orderMatch = /^\/api\/orders\/([^/]+)$/.exec(pathname);
  if (orderMatch) return { allowed: ["GET"], kind: "order", param: orderMatch[1] };
  const productMatch = /^\/api\/admin\/products\/([^/]+)$/.exec(pathname);
  if (productMatch) return { allowed: ["PATCH"], kind: "admin-product", param: productMatch[1] };
  return null;
}

function normalizePath(rawPath) {
  if (/%2f|%5c|%00/i.test(rawPath)) return { code: "not-found", detail: "encoded path separators are not allowed" };
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return { code: "invalid-path" };
  }
  if (decoded.length > 1 && decoded.endsWith("/")) return { code: "not-found" };
  if (decoded.includes("\\") || decoded.includes("\0") || decoded.includes("//")) return { code: "not-found" };
  return { pathname: decoded };
}

function clientIp(req, config) {
  if (config.trustProxy) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim() !== "") return forwarded.split(",")[0].trim().slice(0, 128);
  }
  return String(req.socket?.remoteAddress ?? "").slice(0, 128);
}

function csrfValid(req, services) {
  const cookies = parseCookies(req.headers.cookie ?? "");
  const cookieToken = cookies[CSRF_COOKIE_NAME] ?? "";
  const headerToken = String(req.headers["x-csrf-token"] ?? "");
  return services.auth.verifyCsrf(cookieToken, headerToken);
}

export function createApiHandler({ services, config, version }) {
  const cookieOptions = { secure: config.cookieSecure };
  return async function handleApi(req, res) {
    const url = new URL(req.url, `http://${req.headers.host ?? `127.0.0.1:${config.port}`}`);
    const requireId = crypto.randomUUID();
    res.setHeader("X-Request-Id", requireId);
    res.setHeader("Cache-Control", "no-store");
    if (!url.pathname.startsWith("/api")) return false;

    try {
      const guard = checkGuards(req, config);
      if (guard) return sendJson(res, statusFor(guard), errorBody(guard)), true;

      const normalized = normalizePath(url.pathname);
      if (normalized.code) {
        return sendJson(res, statusFor(normalized.code), errorBody(normalized.code, normalized.detail)), true;
      }
      const pathname = normalized.pathname;
      const route = routeFor(pathname);
      const method = req.method;

      // 1) 体协议（只对需要请求体的端点；logout 等无体端点不受 Content-Type 约束）
      let body = null;
      const needsBody =
        (method === "POST" && ["/api/auth/login", "/api/auth/register", "/api/orders"].includes(pathname)) ||
        (method === "PATCH" && /^\/api\/admin\/products\/[^/]+$/.test(pathname));
      if (needsBody) {
        const parsed = await readJsonBody(req);
        if (!parsed.ok) return sendJson(res, statusFor(parsed.code), errorBody(parsed.code)), true;
        body = parsed.body;
      }

      // 2) 405（已知路由方法不匹配）；未知 /api 路径 → 404
      if (!route) return sendJson(res, 404, errorBody("not-found")), true;
      if (!route.allowed.includes(method)) {
        return sendJson(res, 405, errorBody("allow"), { Allow: route.allowed.join(", ") }), true;
      }

      const cookies = parseCookies(req.headers.cookie ?? "");
      // 安全 GET 在缺失时签发 CSRF Cookie（health 也可作为 bootstrap，C-116）。
      if ((method === "GET" || method === "HEAD") && !cookies[CSRF_COOKIE_NAME]) {
        res.setHeader("Set-Cookie", csrfCookie(createCsrfToken(), cookieOptions));
      }
      let user = null;
      try {
        user = await services.auth.me(cookies[COOKIE_NAME]);
      } catch {
        user = null;
      }

      const needsAuth = !["/api/auth/login", "/api/auth/register", "/api/auth/logout", "/api/products", "/api/health"].includes(pathname);
      if (needsAuth && !user) return sendJson(res, 401, errorBody("auth-required")), true;

      // 3) CSRF：带会话的写请求（login/register 豁免）
      const stateChanging = method === "POST" || method === "PATCH";
      const csrfExempt = pathname === "/api/auth/login" || pathname === "/api/auth/register";
      if (stateChanging && user && !csrfExempt && !csrfValid(req, services)) {
        return sendJson(res, 403, errorBody("csrf-token-invalid")), true;
      }
      const needsRole = pathname.startsWith("/api/admin/");
      if (needsRole && user?.role !== "admin") return sendJson(res, 403, errorBody("auth-forbidden")), true;

      // 4) 业务分派
      if (pathname === "/api/health") {
        const health = await services.health.health({ version });
        const status = health.ok ? 200 : 503;
        const payload = health.ok
          ? health
          : { ...errorBody("db-unavailable"), db: "down", version: health.version, uptimeSeconds: health.uptimeSeconds };
        return sendJson(res, status, payload), true;
      }
      if (pathname === "/api/products") {
        return sendJson(res, 200, { ok: true, products: await services.catalog.listPublic() }), true;
      }
      if (pathname === "/api/auth/register") {
        const user = await services.auth.register({ username: body?.username, password: body?.password });
        return sendJson(res, 201, { ok: true, user }), true;
      }
      if (pathname === "/api/auth/login") {
        const result = await services.auth.login({
          username: body?.username,
          password: body?.password,
          ip: clientIp(req, config),
          previousToken: cookies[COOKIE_NAME] ?? "",
        });
        const csrfToken = createCsrfToken();
        return sendJson(
          res,
          200,
          { ok: true, user: result.user },
          {
            "Set-Cookie": [
              sessionCookie(result.token, { maxAge: result.maxAgeSeconds, ...cookieOptions }),
              csrfCookie(csrfToken, cookieOptions),
            ],
          },
        ), true;
      }
      if (pathname === "/api/auth/logout") {
        await services.auth.logout(cookies[COOKIE_NAME]);
        return sendJson(res, 204, {}, { "Set-Cookie": [clearSessionCookie(cookieOptions), clearCsrfCookie(cookieOptions)] }), true;
      }
      if (pathname === "/api/auth/me") {
        return sendJson(res, 200, { ok: true, user }), true;
      }
      if (pathname === "/api/orders") {
        const result = await services.orders.checkout({ userId: user.id, items: body?.items, clientOrderId: body?.clientOrderId });
        return sendJson(res, result.status === "created" ? 201 : 200, { ok: true, order: result.order }), true;
      }
      if (pathname === "/api/orders/mine") {
        return sendJson(res, 200, { ok: true, orders: await services.orders.listMine(user.id) }), true;
      }
      if (route.kind === "order") {
        const order = await services.orders.getForViewer(route.param, user);
        return sendJson(res, 200, { ok: true, order }), true;
      }
      if (pathname === "/api/admin/orders") {
        return sendJson(res, 200, { ok: true, orders: await services.orders.listAll() }), true;
      }
      if (pathname === "/api/admin/products") {
        return sendJson(res, 200, { ok: true, products: await services.catalog.listAdmin() }), true;
      }
      if (route.kind === "admin-product") {
        const product = await services.catalog.updateProduct(route.param, body ?? {});
        return sendJson(res, 200, { ok: true, product }), true;
      }
      return sendJson(res, 404, errorBody("not-found")), true;
    } catch (error) {
      if (isKnownAppCode(error?.code)) {
        const headers = {};
        if (error.code === "auth-rate-limited" && Number.isInteger(error.details?.retryAfter)) {
          headers["Retry-After"] = String(error.details.retryAfter);
        }
        return sendJson(res, statusFor(error.code), errorBody(error.code, error.details), headers), true;
      }
      const mapped = toAppError(error);
      if (mapped !== "internal-error" || isConnectionError(error)) {
        return sendJson(res, statusFor(mapped), errorBody(mapped)), true;
      }
      process.stderr.write(`[api-error] requestId=${requireId} ${req.method} ${url.pathname} ${error?.message ?? error}\n`);
      return sendJson(res, 500, errorBody("internal-error")), true;
    }
  };
}
