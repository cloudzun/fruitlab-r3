// 认证/商品/订单/健康服务的组合。
import { createAuthService } from "./auth.mjs";
import { createCatalogService } from "./catalog.mjs";
import { createOrderService } from "./orders.mjs";
import { createHealthService } from "./health.mjs";
import { createDummyHash, createScryptGate, createRateLimiter } from "../auth.mjs";

export async function createServices({ pool, config, clock, repos }) {
  const dummyHash = await createDummyHash();
  const scryptGate = createScryptGate({ limit: config.scryptConcurrency, queueLimit: config.scryptQueueLimit });
  const rateLimiter = createRateLimiter({
    now: () => clock().getTime(),
    windowMs: config.rateLimit.windowMs,
    accountLimit: config.rateLimit.accountLimit,
    ipLimit: config.rateLimit.ipLimit,
    lockMs: config.rateLimit.lockMs,
    maxEntries: config.rateLimit.maxEntries,
  });
  const auth = createAuthService({ pool, repos, config, clock, dummyHash, rateLimiter, scryptGate });
  const catalog = createCatalogService({ pool, repos });
  const orders = createOrderService({ pool, repos, clock });
  const health = createHealthService({ pool, config, clock });
  return { auth, catalog, orders, health };
}
