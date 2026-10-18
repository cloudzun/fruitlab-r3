// 健康检查：独立总时限；超时销毁连接（服务端会取消查询），避免每 5s 的 healthcheck 留下长查询。
import { schemaVersionOn, isSeededOn } from "../db.mjs";

export const HEALTH_TIMEOUT_MS = 3000;

function timeoutError() {
  return Object.assign(new Error("health timeout"), { code: "health-timeout" });
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(timeoutError()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function connectWithTimeout(pool, ms) {
  let timedOut = false;
  const pending = pool.connect();
  pending.then((client) => {
    if (timedOut) client.release(true);
  }).catch(() => {});
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      reject(timeoutError());
    }, ms);
  });
  try {
    return await Promise.race([pending, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export function createHealthService({ pool, config, clock }) {
  const startedAt = clock().getTime();
  async function health({ version }) {
    const timeoutMs = config.healthTimeoutMs ?? HEALTH_TIMEOUT_MS;
    let client = null;
    let destroy = false;
    try {
      client = await connectWithTimeout(pool, timeoutMs);
      const [schema, seeded] = await withTimeout(
        Promise.all([schemaVersionOn(client), isSeededOn(client)]),
        timeoutMs,
      );
      return {
        ok: true,
        db: "up",
        version,
        schemaVersion: schema,
        seeded,
        uptimeSeconds: Math.round((clock().getTime() - startedAt) / 1000),
      };
    } catch {
      destroy = true;
      return {
        ok: false,
        code: "db-unavailable",
        db: "down",
        version,
        uptimeSeconds: Math.round((clock().getTime() - startedAt) / 1000),
      };
    } finally {
      if (client) client.release(destroy);
    }
  }
  return { health };
}
