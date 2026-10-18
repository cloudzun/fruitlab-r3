// API 路由：统一信封 {ok:true,...} / {ok:false,code,message}。
// 静态层错误仍用 problem+json（见 serve.mjs）；两者边界在 docs/contracts.md。
import crypto from "node:crypto";
import path from "node:path";
import { createSession, deleteSession, findUserByUsername, getSessionUser, listUsers, createUser, sessionCookie, clearSessionCookie, parseCookies, COOKIE_NAME, verifyPassword, validateCredentials } from "./auth.mjs";
import { getProduct, listProducts, updateProduct } from "./products.mjs";
import { createOrder, getOrderByNumber, listAllOrders, listOrdersByUser } from "./orders.mjs";
import { schemaVersion, isSeeded } from "./db.mjs";
import { errorBody, statusFor } from "./errors.mjs";

const MAX_BODY_BYTES = 64 * 1024;

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(payload);
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

function allowedHosts(config) {
  const hosts = new Set([`127.0.0.1:${config.port}`, `localhost:${config.port}`]);
  if (config.port === 80) {
    hosts.add("127.0.0.1");
    hosts.add("localhost");
  }
  return hosts;
}

function checkRequestGuards(req, config) {
  const host = String(req.headers.host ?? "");
  if (!allowedHosts(config).has(host)) return "host-not-allowed";
  if (["POST", "PATCH", "DELETE", "PUT"].includes(req.method)) {
    const origin = req.headers.origin;
    if (origin !== undefined) {
      if (origin !== `http://${host}`) return "cross-origin-blocked";
    }
    const site = req.headers["sec-fetch-site"];
    if (site !== undefined && site !== "same-origin" && site !== "none") return "cross-origin-blocked";
  }
  return null;
}

async function readJsonBody(req) {
  const type = String(req.headers["content-type"] ?? "");
  if (!/^application\/json\b/i.test(type)) return { ok: false, code: "unsupported-media-type" };
  const { tooLarge, raw } = await readBody(req);
  if (tooLarge) return { ok: false, code: "payload-too-large" };
  try {
    if (raw.trim() === "") return { ok: true, body: {} };
    return { ok: true, body: JSON.parse(raw) };
  } catch {
    return { ok: false, code: "invalid-json" };
  }
}

function currentUser(db, req) {
  const cookies = parseCookies(req.headers.cookie ?? "");
  return getSessionUser(db, cookies[COOKIE_NAME]);
}

// 健康检查只暴露相对路径，避免把绝对文件系统路径发给客户端（review 环修复）。
function publicDbPath(dbPath) {
  if (!dbPath || dbPath === ":memory:") return dbPath;
  const relative = path.relative(process.cwd(), dbPath);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) return relative.split(path.sep).join("/");
  return path.basename(dbPath);
}

export function createApiHandler({ db, version = "2.0.0.0", dbPath = "", port = 0, startedAt = Date.now() }) {
  const portValue = () => (typeof port === "function" ? port() : port);
  return async function handleApi(req, res) {
    const url = new URL(req.url, `http://${req.headers.host ?? `127.0.0.1:${portValue()}`}`);
    const path = url.pathname;
    if (!path.startsWith("/api")) return false;

    const requestId = crypto.randomUUID();
    res.setHeader("X-Request-Id", requestId);

    try {
      const guard = checkRequestGuards(req, { port: portValue() });
      if (guard) return sendJson(res, statusFor(guard), errorBody(guard)), true;

      const user = currentUser(db, req);
      const route = `${req.method} ${path}`;

      if (route === "GET /api/health") {
        const body = {
          ok: true,
          version,
          schemaVersion: schemaVersion(db),
          dbPath: publicDbPath(dbPath),
          port: portValue(),
          seeded: isSeeded(db),
          uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        };
        return sendJson(res, 200, body), true;
      }

      if (route === "GET /api/products") {
        return sendJson(res, 200, { ok: true, products: listProducts(db) }), true;
      }

      if (route === "POST /api/auth/register") {
        const parsed = await readJsonBody(req);
        if (!parsed.ok) return sendJson(res, statusFor(parsed.code), errorBody(parsed.code)), true;
        const { username, password } = parsed.body ?? {};
        const problem = validateCredentials({ username, password });
        if (problem) return sendJson(res, statusFor(problem), errorBody(problem)), true;
        const created = createUser(db, { username, password, role: "user" });
        if (!created.ok) return sendJson(res, statusFor(created.code), errorBody(created.code)), true;
        return sendJson(res, 201, { ok: true, user: created.user }), true;
      }

      if (route === "POST /api/auth/login") {
        const parsed = await readJsonBody(req);
        if (!parsed.ok) return sendJson(res, statusFor(parsed.code), errorBody(parsed.code)), true;
        const { username, password } = parsed.body ?? {};
        if (typeof username !== "string" || typeof password !== "string") {
          return sendJson(res, 400, errorBody("invalid-request")), true;
        }
        const found = findUserByUsername(db, username);
        if (!found || !verifyPassword(password, found.passwordHash)) {
          return sendJson(res, 401, errorBody("auth-invalid-credentials")), true;
        }
        // 登录时作废旧会话，避免会话行堆积（review 环修复）。
        const previousToken = parseCookies(req.headers.cookie ?? "")[COOKIE_NAME];
        if (previousToken) deleteSession(db, previousToken);
        const token = createSession(db, found.id);
        return sendJson(res, 200, { ok: true, user: { id: found.id, username: found.username, role: found.role } }, {
          "Set-Cookie": sessionCookie(token),
        }), true;
      }

      if (route === "POST /api/auth/logout") {
        const cookies = parseCookies(req.headers.cookie ?? "");
        deleteSession(db, cookies[COOKIE_NAME]);
        return sendJson(res, 204, {}, { "Set-Cookie": clearSessionCookie() }), true;
      }

      if (route === "GET /api/auth/me") {
        if (!user) return sendJson(res, 401, errorBody("auth-required")), true;
        return sendJson(res, 200, { ok: true, user }), true;
      }

      if (route === "POST /api/orders") {
        if (!user) return sendJson(res, 401, errorBody("auth-required")), true;
        const parsed = await readJsonBody(req);
        if (!parsed.ok) return sendJson(res, statusFor(parsed.code), errorBody(parsed.code)), true;
        const { items, clientOrderId } = parsed.body ?? {};
        const result = createOrder(db, { userId: user.userId, items, clientOrderId });
        if (!result.ok) return sendJson(res, statusFor(result.code), errorBody(result.code, result.details)), true;
        return sendJson(res, result.status === "created" ? 201 : 200, { ok: true, order: result.order }), true;
      }

      if (route === "GET /api/orders/mine") {
        if (!user) return sendJson(res, 401, errorBody("auth-required")), true;
        return sendJson(res, 200, { ok: true, orders: listOrdersByUser(db, user.userId) }), true;
      }

      if (req.method === "GET" && path.startsWith("/api/orders/")) {
        if (!user) return sendJson(res, 401, errorBody("auth-required")), true;
        const orderNumber = decodeURIComponent(path.slice("/api/orders/".length));
        const order = getOrderByNumber(db, orderNumber);
        if (!order) return sendJson(res, 404, errorBody("order-not-found")), true;
        if (order.userId !== user.userId && user.role !== "admin") {
          return sendJson(res, 403, errorBody("order-not-owned")), true;
        }
        return sendJson(res, 200, { ok: true, order }), true;
      }

      if (route === "GET /api/admin/orders") {
        if (!user) return sendJson(res, 401, errorBody("auth-required")), true;
        if (user.role !== "admin") return sendJson(res, 403, errorBody("auth-forbidden")), true;
        return sendJson(res, 200, { ok: true, orders: listAllOrders(db) }), true;
      }

      if (route === "GET /api/admin/products") {
        if (!user) return sendJson(res, 401, errorBody("auth-required")), true;
        if (user.role !== "admin") return sendJson(res, 403, errorBody("auth-forbidden")), true;
        return sendJson(res, 200, { ok: true, products: listProducts(db, { includeUnlisted: true }) }), true;
      }

      if (req.method === "PATCH" && path.startsWith("/api/admin/products/")) {
        if (!user) return sendJson(res, 401, errorBody("auth-required")), true;
        if (user.role !== "admin") return sendJson(res, 403, errorBody("auth-forbidden")), true;
        const productId = decodeURIComponent(path.slice("/api/admin/products/".length));
        const parsed = await readJsonBody(req);
        if (!parsed.ok) return sendJson(res, statusFor(parsed.code), errorBody(parsed.code)), true;
        const result = updateProduct(db, productId, parsed.body ?? {});
        if (!result.ok) return sendJson(res, statusFor(result.code), errorBody(result.code, result.details)), true;
        return sendJson(res, 200, { ok: true, product: result.product }), true;
      }

      // 已知路径但方法不对 → 405 + Allow
      const allowed = {
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
      }[path];
      if (allowed) {
        return sendJson(res, 405, errorBody("allow"), { Allow: allowed.join(", ") }), true;
      }

      // /api/orders/:num 与 /api/admin/products/:id 的方法错误
      if ((path.startsWith("/api/orders/") || path.startsWith("/api/admin/products/")) && req.method !== "GET" && req.method !== "PATCH") {
        return sendJson(res, 405, errorBody("allow"), { Allow: path.startsWith("/api/orders/") ? "GET" : "PATCH" }), true;
      }

      return sendJson(res, 404, errorBody("not-found")), true;
    } catch (error) {
      process.stderr.write(`[api-error] requestId=${requestId} ${req.method} ${path} ${error?.message ?? error}\n`);
      return sendJson(res, 500, errorBody("internal-error")), true;
    }
  };
}
