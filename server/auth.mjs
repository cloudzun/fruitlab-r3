// 认证：scrypt 口令哈希、会话令牌（库中只存 sha256）。
import crypto from "node:crypto";

const SCRYPT = Object.freeze({ N: 16384, r: 8, p: 1, keylen: 64 });
export const COOKIE_NAME = "fruitlab_session";
export const USERNAME_RE = /^[A-Za-z0-9_-]{3,32}$/;

export function hashPassword(password, salt = crypto.randomBytes(16)) {
  const derived = crypto.scryptSync(password, salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), derived.toString("base64")].join("$");
}

export function verifyPassword(password, stored) {
  const parts = String(stored).split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  const actual = crypto.scryptSync(password, salt, expected.length, { N, r, p });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function validateCredentials({ username, password }) {
  if (typeof username !== "string" || !USERNAME_RE.test(username)) return "invalid-username";
  if (typeof password !== "string" || password.length < 8 || password.length > 128) return "invalid-password";
  return null;
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)").run(
    hashToken(token),
    userId,
    new Date().toISOString(),
  );
  return token;
}

export function getSessionUser(db, token) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.user_id AS userId, u.username, u.role
         FROM sessions s JOIN users u ON u.user_id = s.user_id
        WHERE s.token = ?`,
    )
    .get(hashToken(token));
  return row ?? null;
}

export function deleteSession(db, token) {
  if (!token) return 0;
  return db.prepare("DELETE FROM sessions WHERE token = ?").run(hashToken(token)).changes;
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
      // 非法百分号编码的 Cookie 直接忽略，不抛错（review 环修复）
    }
  }
  return out;
}

export function sessionCookie(token) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function listUsers(db) {
  return db
    .prepare("SELECT user_id AS id, username, role, created_at AS createdAt FROM users ORDER BY username")
    .all();
}

export function createUser(db, { username, password, role = "user" }) {
  const problem = validateCredentials({ username, password });
  if (problem) return { ok: false, code: problem };
  if (!["user", "admin"].includes(role)) return { ok: false, code: "invalid-request" };
  const exists = db.prepare("SELECT 1 FROM users WHERE username = ?").get(username);
  if (exists) return { ok: false, code: "auth-username-taken" };
  const userId = `U${crypto.randomBytes(8).toString("hex")}`;
  db.prepare(
    "INSERT INTO users (user_id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(userId, username, hashPassword(password), role, new Date().toISOString());
  return { ok: true, user: { id: userId, username, role } };
}

export function findUserByUsername(db, username) {
  return db
    .prepare("SELECT user_id AS id, username, password_hash AS passwordHash, role FROM users WHERE username = ?")
    .get(username);
}
