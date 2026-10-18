// 认证原语：scrypt（异步）、会话令牌、Cookie、CSRF、登录限流。
// 本模块不依赖数据库（分层规则：services 负责用例，repositories 负责 SQL）。
import crypto from "node:crypto";

const SCRYPT = Object.freeze({ N: 16384, r: 8, p: 1, keylen: 64 });
const SCRYPT_OPTIONS = Object.freeze({ N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
export const COOKIE_NAME = "fruitlab_session";
export const CSRF_COOKIE_NAME = "fruitlab_csrf";
export const USERNAME_RE = /^[A-Za-z0-9_-]{3,32}$/;
export const CLIENT_ORDER_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;

function scryptAsync(password, salt, keylen) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, SCRYPT_OPTIONS, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

// 全局 scrypt 并发闸门：避免大量登录阻塞事件循环。
export function createScryptGate({ limit = 4, queueLimit = 100 } = {}) {
  let active = 0;
  const queue = [];
  const pump = () => {
    while (active < limit && queue.length > 0) {
      const job = queue.shift();
      active += 1;
      job.run().then(job.resolve, job.reject).finally(() => {
        active -= 1;
        pump();
      });
    }
  };
  return {
    run(fn) {
      return new Promise((resolve, reject) => {
        if (queue.length >= queueLimit) {
          reject(Object.assign(new Error("scrypt queue full"), { code: "auth-busy" }));
          return;
        }
        queue.push({ run: fn, resolve, reject });
        pump();
      });
    },
    get active() {
      return active;
    },
    get pending() {
      return queue.length;
    },
  };
}

export async function hashPassword(password, salt = crypto.randomBytes(16)) {
  const derived = await scryptAsync(password, salt, SCRYPT.keylen);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), derived.toString("base64")].join("$");
}

export async function verifyPassword(password, stored) {
  const parts = String(stored).split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  if (!Buffer.isBuffer(salt) || !Buffer.isBuffer(expected) || expected.length === 0) return false;
  const actual = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, expected.length, { N, r, p }, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function validateCredentials({ username, password }) {
  if (typeof username !== "string" || !USERNAME_RE.test(username)) return "invalid-username";
  if (typeof password !== "string" || password.length < 8 || password.length > 128) return "invalid-password";
  return null;
}

export function validateClientOrderId(value) {
  return typeof value === "string" && CLIENT_ORDER_ID_RE.test(value);
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function createCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function timingSafeEqualText(a, b) {
  const left = Buffer.from(String(a ?? ""), "utf8");
  const right = Buffer.from(String(b ?? ""), "utf8");
  if (left.length !== right.length || left.length === 0) return false;
  return crypto.timingSafeEqual(left, right);
}

export function parseCookies(header = "") {
  const out = {};
  for (const part of String(header).split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      /* 坏 Cookie 忽略，不抛 500 */
    }
  }
  return out;
}

function cookieAttributes({ maxAge, secure }) {
  const parts = ["Path=/", "HttpOnly", "SameSite=Lax"];
  if (Number.isInteger(maxAge)) parts.push(`Max-Age=${maxAge}`);
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function sessionCookie(token, { maxAge, secure = false } = {}) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieAttributes({ maxAge, secure })}`;
}

export function clearSessionCookie({ secure = false } = {}) {
  return `${COOKIE_NAME}=; ${cookieAttributes({ maxAge: 0, secure })}`;
}

// CSRF 双提交 Cookie 必须可被同源 JS 读取，因此无 HttpOnly。
export function csrfCookie(token, { secure = false } = {}) {
  const parts = ["Path=/", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  return `${CSRF_COOKIE_NAME}=${encodeURIComponent(token)}; ${parts.join("; ")}`;
}

export function clearCsrfCookie({ secure = false } = {}) {
  const parts = ["Path=/", "SameSite=Lax", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return `${CSRF_COOKIE_NAME}=; ${parts.join("; ")}`;
}

// 登录限流：账号桶 + IP 桶。内存实现（单实例；进程重启清零）。
export function createRateLimiter({
  now = () => Date.now(),
  windowMs = 15 * 60 * 1000,
  accountLimit = 5,
  ipLimit = 50,
  lockMs = 15 * 60 * 1000,
  maxEntries = 10000,
} = {}) {
  const buckets = new Map();

  function get(key, limit) {
    const current = buckets.get(key);
    if (!current) return { key, fails: 0, firstAt: 0, lockedUntil: 0, limit };
    return current;
  }

  function prune(time) {
    for (const [key, bucket] of buckets) {
      if (bucket.lockedUntil > time) continue;
      if (time - bucket.firstAt > windowMs) buckets.delete(key);
    }
    if (buckets.size > maxEntries) {
      const overflow = buckets.size - maxEntries;
      let removed = 0;
      for (const key of buckets.keys()) {
        buckets.delete(key);
        if (++removed >= overflow) break;
      }
    }
  }

  function check({ username, ip }) {
    const time = now();
    prune(time);
    const account = get(`a:${username}`, accountLimit);
    const address = get(`i:${ip}`, ipLimit);
    const locked = Math.max(account.lockedUntil, address.lockedUntil);
    if (locked > time) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((locked - time) / 1000)) };
    }
    return { allowed: true, retryAfter: 0 };
  }

  function recordFailure({ username, ip }) {
    const time = now();
    for (const [key, limit] of [[`a:${username}`, accountLimit], [`i:${ip}`, ipLimit]]) {
      const bucket = get(key, limit);
      if (time - bucket.firstAt > windowMs) {
        bucket.firstAt = time;
        bucket.fails = 0;
      }
      bucket.fails += 1;
      if (bucket.fails >= limit) bucket.lockedUntil = time + lockMs;
      buckets.set(key, bucket);
    }
  }

  function clear({ username, ip }) {
    buckets.delete(`a:${username}`);
    buckets.delete(`i:${ip}`);
  }

  return {
    check,
    recordFailure,
    clear,
    reset() {
      buckets.clear();
    },
    get size() {
      return buckets.size;
    },
  };
}

// 登录时序：缺失用户也执行一次 verify（固定假哈希）。
export async function createDummyHash() {
  return hashPassword("fruitlab-dummy-password-not-used", Buffer.alloc(16, 7));
}
