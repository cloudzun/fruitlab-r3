// SQLSTATE / 本地错误 → 稳定错误码映射。
// 唯一真源是 docs/error-catalog.md；本文件是实现的镜像；tests/contracts.test.mjs 断言集合一致。

export const ERROR_CODES = Object.freeze({
  "invalid-request": { status: 400, message: "请求参数不正确" },
  "invalid-json": { status: 400, message: "请求体不是合法 JSON" },
  "invalid-path": { status: 400, message: "请求路径编码不正确" },
  "invalid-quantity": { status: 400, message: "数量必须是 1 到 99 的整数" },
  "invalid-price": { status: 400, message: "价格必须是 0 到 9999999 的整数（分）" },
  "invalid-stock": { status: 400, message: "库存必须是 0 到 99999 的整数" },
  "invalid-listed": { status: 400, message: "listed 只能是 0 或 1" },
  "invalid-username": { status: 400, message: "用户名需为 3 到 32 位字母、数字、下划线或短横线" },
  "invalid-password": { status: 400, message: "口令长度需为 8 到 128 位" },
  "auth-required": { status: 401, message: "请先登录" },
  "auth-invalid-credentials": { status: 401, message: "用户名或口令不正确" },
  "auth-forbidden": { status: 403, message: "没有权限执行该操作" },
  "csrf-token-invalid": { status: 403, message: "请求校验失败，请刷新页面后重试" },
  "cross-origin-blocked": { status: 403, message: "跨站请求被拒绝" },
  "host-not-allowed": { status: 403, message: "请求 Host 不被允许" },
  "product-not-found": { status: 404, message: "商品不存在" },
  "order-not-found": { status: 404, message: "订单不存在" },
  "not-found": { status: 404, message: "请求的资源不存在" },
  allow: { status: 405, message: "请求方法不被允许" },
  "auth-username-taken": { status: 409, message: "用户名已被占用" },
  "insufficient-stock": { status: 409, message: "库存不足" },
  "product-unlisted": { status: 409, message: "商品已下架" },
  "duplicate-order-number": { status: 409, message: "订单号重复" },
  "order-number-exhausted": { status: 409, message: "订单号生成失败，请稍后重试" },
  "payload-too-large": { status: 413, message: "请求体超过 64 KiB" },
  "unsupported-media-type": { status: 415, message: "请求体必须是 application/json" },
  "auth-rate-limited": { status: 429, message: "登录尝试过于频繁，请稍后再试" },
  "internal-error": { status: 500, message: "服务器内部错误" },
  "db-unavailable": { status: 503, message: "数据库暂时不可用" },
  "server-busy": { status: 503, message: "数据库繁忙，请稍后重试" },
});

export function errorBody(code, details) {
  const entry = ERROR_CODES[code] ?? ERROR_CODES["internal-error"];
  const body = { ok: false, code, message: entry.message };
  if (details !== undefined) body.details = details;
  return body;
}

export function statusFor(code) {
  return (ERROR_CODES[code] ?? ERROR_CODES["internal-error"]).status;
}

export function sqlStateOf(error) {
  return typeof error?.code === "string" ? error.code : "";
}

export function isRetryable(error) {
  const code = sqlStateOf(error);
  return code === "40001" || code === "40P01";
}

export function isUniqueViolation(error) {
  return sqlStateOf(error) === "23505";
}

export function constraintOf(error) {
  return typeof error?.constraint === "string" ? error.constraint : "";
}

export function isConnectionError(error) {
  const code = sqlStateOf(error);
  if (["53300", "08000", "08003", "08006", "08001", "08004", "57P01"].includes(code)) return true;
  const message = String(error?.message ?? "");
  return /ECONNREFUSED|ECONNRESET|ETIMEDOUT|Connection terminated|timeout exceeded when trying to connect/i.test(message);
}

export function toAppError(error) {
  if (isRetryable(error)) return "server-busy";
  if (["57014", "55P03"].includes(sqlStateOf(error))) return "server-busy";
  if (isConnectionError(error)) return "db-unavailable";
  return "internal-error";
}
