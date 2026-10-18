// 错误目录：唯一真源在 docs/error-catalog.md；本文件是实现的镜像。
// 每个 code 固定 HTTP 状态与用户文案；测试 tests/contracts.test.mjs 断言两边集合一致。

export const ERROR_CODES = Object.freeze({
  "invalid-request": { status: 400, message: "请求参数不正确" },
  "invalid-json": { status: 400, message: "请求体不是合法 JSON" },
  "invalid-quantity": { status: 400, message: "数量必须是 1 到 99 的整数" },
  "invalid-price": { status: 400, message: "价格必须是 0 到 9999999 的整数（分）" },
  "invalid-stock": { status: 400, message: "库存必须是 0 到 99999 的整数" },
  "invalid-listed": { status: 400, message: "listed 只能是 0 或 1" },
  "invalid-username": { status: 400, message: "用户名需为 3 到 32 位字母、数字、下划线或短横线" },
  "invalid-password": { status: 400, message: "口令长度需为 8 到 128 位" },
  "auth-required": { status: 401, message: "请先登录" },
  "auth-invalid-credentials": { status: 401, message: "用户名或口令不正确" },
  "auth-forbidden": { status: 403, message: "没有权限执行该操作" },
  "order-not-owned": { status: 403, message: "该订单不属于当前用户" },
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
  "server-busy": { status: 503, message: "数据库繁忙，请稍后重试" },
  "internal-error": { status: 500, message: "服务器内部错误" },
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

export class ApiError extends Error {
  constructor(code, details) {
    super(code);
    this.code = code;
    this.details = details;
  }
}
