// 配置：全部来自环境变量；生产模式在这里 fail-fast。
import fs from "node:fs";
import path from "node:path";

export class ConfigError extends Error {
  constructor(message, { code = "config-invalid" } = {}) {
    super(message);
    this.code = code;
  }
}

export const VERSION_FILE = path.join(import.meta.dirname, "VERSION");

export function readVersion(file = VERSION_FILE) {
  try {
    const value = fs.readFileSync(file, "utf8").trim();
    return value === "" ? "0.0.0.0" : value;
  } catch {
    return "0.0.0.0";
  }
}

function intFromEnv(env, name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new ConfigError(`${name} must be a non-negative integer`);
  return value;
}

function boolFromEnv(env, name, fallback = false) {
  const raw = String(env[name] ?? "").toLowerCase();
  if (raw === "") return fallback;
  return raw === "1" || raw === "true" || raw === "yes";
}

export function loadConfig({ env = process.env, databaseUrl } = {}) {
  const appEnv = String(env.APP_ENV ?? "development").toLowerCase();
  const isProduction = appEnv === "production";
  const port = intFromEnv(env, "PORT", 4175);
  if (port > 65535) throw new ConfigError("PORT must be <= 65535");
  const host = env.HOST || "127.0.0.1";
  const publicUrl = env.PUBLIC_URL || `http://127.0.0.1:${port}`;
  let publicOrigin;
  try {
    publicOrigin = new URL(publicUrl);
  } catch {
    throw new ConfigError("PUBLIC_URL must be a valid URL");
  }
  const resolvedDatabaseUrl = databaseUrl || env.DATABASE_URL;
  if (!resolvedDatabaseUrl) throw new ConfigError("DATABASE_URL (or --url) is required");

  const demoPassword = env.DEMO_PASSWORD ?? "demo1234";
  const adminPassword = env.ADMIN_PASSWORD;
  const cookieSecure = boolFromEnv(env, "COOKIE_SECURE", false);

  if (isProduction) {
    if (!adminPassword) throw new ConfigError("APP_ENV=production requires ADMIN_PASSWORD");
    if (adminPassword.length < 12) throw new ConfigError("ADMIN_PASSWORD must be at least 12 characters");
    if (adminPassword === "demo1234") throw new ConfigError("ADMIN_PASSWORD must not be the demo password");
    if (/change-me|changeme|placeholder/i.test(adminPassword)) {
      throw new ConfigError("ADMIN_PASSWORD must not be the .env.example placeholder");
    }
    if (demoPassword && adminPassword === demoPassword) {
      throw new ConfigError("ADMIN_PASSWORD must differ from DEMO_PASSWORD");
    }
    if (env.POSTGRES_PASSWORD && /change-me|changeme|placeholder/i.test(env.POSTGRES_PASSWORD)) {
      throw new ConfigError("POSTGRES_PASSWORD must not be the .env.example placeholder");
    }
    if (!cookieSecure) throw new ConfigError("APP_ENV=production requires COOKIE_SECURE=1");
  }

  return {
    appEnv,
    isProduction,
    version: readVersion(),
    port,
    host,
    publicUrl,
    publicOrigin,
    databaseUrl: resolvedDatabaseUrl,
    sessionTtlSeconds: intFromEnv(env, "SESSION_TTL_SECONDS", 86400),
    cookieSecure,
    trustProxy: boolFromEnv(env, "TRUST_PROXY", false),
    // 学生 demo 专用：仅非 production 允许跳过 Host/Origin 白名单。
    demoAllowAnyHost: !isProduction && boolFromEnv(env, "DEMO_ALLOW_ANY_HOST", false),
    healthTimeoutMs: intFromEnv(env, "HEALTH_TIMEOUT_MS", 3000),
    demoPassword,
    adminPassword: adminPassword ?? "",
    seedMode: isProduction ? "production" : "classroom",
    scryptConcurrency: intFromEnv(env, "SCRYPT_CONCURRENCY", 4),
    scryptQueueLimit: intFromEnv(env, "SCRYPT_QUEUE_LIMIT", 100),
    db: {
      max: intFromEnv(env, "PG_POOL_MAX", 10),
      connectionTimeoutMs: intFromEnv(env, "PG_CONNECT_TIMEOUT_MS", 5000),
      idleTimeoutMs: intFromEnv(env, "PG_IDLE_TIMEOUT_MS", 30000),
      statementTimeoutMs: intFromEnv(env, "PG_STATEMENT_TIMEOUT_MS", 15000),
      lockTimeoutMs: intFromEnv(env, "PG_LOCK_TIMEOUT_MS", 5000),
    },
    rateLimit: {
      windowMs: intFromEnv(env, "RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
      accountLimit: intFromEnv(env, "RATE_LIMIT_ACCOUNT", 5),
      ipLimit: intFromEnv(env, "RATE_LIMIT_IP", 50),
      lockMs: intFromEnv(env, "RATE_LIMIT_LOCK_MS", 15 * 60 * 1000),
      maxEntries: intFromEnv(env, "RATE_LIMIT_MAX_ENTRIES", 10000),
    },
    serveStatic: boolFromEnv(env, "SERVE_STATIC", false),
    logLevel: env.LOG_LEVEL || "info",
  };
}
