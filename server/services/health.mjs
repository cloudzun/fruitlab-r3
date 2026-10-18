// 健康检查：带独立总时限，DB 不可达/查询卡住时仍尽快返回。
import { schemaVersion, isSeeded } from "../db.mjs";

export const HEALTH_TIMEOUT_MS = 3000;

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error("health timeout"), { code: "health-timeout" })), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function createHealthService({ pool, config, clock }) {
  const startedAt = clock().getTime();
  async function health({ version }) {
    try {
      const [schema, seeded] = await withTimeout(
        Promise.all([schemaVersion(pool), isSeeded(pool)]),
        config.healthTimeoutMs ?? HEALTH_TIMEOUT_MS,
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
      return {
        ok: false,
        code: "db-unavailable",
        db: "down",
        version,
        uptimeSeconds: Math.round((clock().getTime() - startedAt) / 1000),
      };
    }
  }
  return { health };
}
