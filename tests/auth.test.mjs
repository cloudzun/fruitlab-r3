// 认证/会话/限流/时序测试：真实 Postgres。
import test from "node:test";
import assert from "node:assert/strict";
import { createTestDatabase } from "./helpers/pg.mjs";
import {
  hashPassword,
  verifyPassword,
  validateCredentials,
  hashToken,
  createSessionToken,
  createRateLimiter,
  createScryptGate,
  createDummyHash,
  timingSafeEqualText,
} from "../server/auth.mjs";
import * as users from "../server/repositories/users.mjs";
import * as sessions from "../server/repositories/sessions.mjs";
import { createAuthService } from "../server/services/auth.mjs";

const repos = { users, sessions };
const baseConfig = { sessionTtlSeconds: 3600, scryptConcurrency: 4, scryptQueueLimit: 100 };

function clockAt(iso) {
  let current = new Date(iso).getTime();
  return { clock: () => new Date(current), advance: (ms) => { current += ms; } };
}

test("password hashing is salted and verifiable", async () => {
  const first = await hashPassword("demo1234");
  const second = await hashPassword("demo1234");
  assert.notEqual(first, second);
  assert.equal(first.startsWith("scrypt$16384$8$1$"), true);
  assert.equal(await verifyPassword("demo1234", first), true);
  assert.equal(await verifyPassword("wrong-password", first), false);
});

test("credential validation enforces username/password bounds", () => {
  assert.equal(validateCredentials({ username: "ab", password: "demo1234" }), "invalid-username");
  assert.equal(validateCredentials({ username: "a".repeat(33), password: "demo1234" }), "invalid-username");
  assert.equal(validateCredentials({ username: "userA", password: "short" }), "invalid-password");
  assert.equal(validateCredentials({ username: "userA", password: "demo1234" }), null);
});

test("sessions store only token hash and enforce expiry", async () => {
  const db = await createTestDatabase();
  try {
    const user = await users.findByUsername(db.pool, "userA");
    const token = createSessionToken();
    const now = new Date("2026-10-18T00:00:00.000Z");
    await sessions.create(db.pool, {
      tokenHash: hashToken(token),
      userId: user.id,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
    });
    const stored = await db.pool.query("SELECT token_hash FROM sessions");
    assert.equal(stored.rows[0].token_hash, hashToken(token));
    assert.notEqual(stored.rows[0].token_hash, token);
    assert.equal((await sessions.findUserByToken(db.pool, hashToken(token), new Date(now.getTime() + 1000))).id, user.id);
    assert.equal(await sessions.findUserByToken(db.pool, hashToken(token), new Date(now.getTime() + 61_000)), null);
  } finally {
    await db.close();
  }
});

test("expired sessions are purged", async () => {
  const db = await createTestDatabase();
  try {
    const user = await users.findByUsername(db.pool, "userA");
    await sessions.create(db.pool, {
      tokenHash: hashToken("expired-token"),
      userId: user.id,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    assert.equal(await sessions.purgeExpired(db.pool, new Date("2026-10-18T00:00:00.000Z")), 1);
    assert.equal((await db.pool.query("SELECT COUNT(*)::int AS n FROM sessions")).rows[0].n, 0);
  } finally {
    await db.close();
  }
});

test("login runs exactly one scrypt verify on both existing and missing user paths", async () => {
  const db = await createTestDatabase();
  try {
    let verifies = 0;
    const gate = { run: (fn) => { verifies += 1; return fn(); } };
    const service = createAuthService({
      pool: db.pool,
      repos,
      config: baseConfig,
      clock: () => new Date("2026-10-18T00:00:00.000Z"),
      dummyHash: await createDummyHash(),
      rateLimiter: createRateLimiter(),
      scryptGate: gate,
    });
    const ok = await service.login({ username: "userA", password: "demo1234", ip: "127.0.0.1" });
    assert.equal(ok.user.username, "userA");
    assert.equal(verifies, 1);
    await assert.rejects(
      () => service.login({ username: "nobody-here", password: "wrong-password", ip: "127.0.0.1" }),
      (error) => error.code === "auth-invalid-credentials",
    );
    assert.equal(verifies, 2);
  } finally {
    await db.close();
  }
});

test("rate limiter locks after five failures and clears on success", async () => {
  const db = await createTestDatabase();
  try {
    const time = clockAt("2026-10-18T00:00:00.000Z");
    const limiter = createRateLimiter({ now: () => time.clock().getTime() });
    const service = createAuthService({
      pool: db.pool,
      repos,
      config: baseConfig,
      clock: time.clock,
      dummyHash: await createDummyHash(),
      rateLimiter: limiter,
      scryptGate: createScryptGate({ limit: 4, queueLimit: 100 }),
    });
    for (let index = 0; index < 5; index += 1) {
      await assert.rejects(
        () => service.login({ username: "userA", password: "wrong-password", ip: "10.0.0.1" }),
        (error) => error.code === "auth-invalid-credentials",
      );
    }
    await assert.rejects(
      () => service.login({ username: "userA", password: "demo1234", ip: "10.0.0.1" }),
      (error) => error.code === "auth-rate-limited" && error.details.retryAfter > 0,
    );
    time.advance(15 * 60 * 1000 + 1000);
    const ok = await service.login({ username: "userA", password: "demo1234", ip: "10.0.0.1" });
    assert.equal(ok.user.username, "userA");
  } finally {
    await db.close();
  }
});

test("login rotates the previous session and logout deletes the server row", async () => {
  const db = await createTestDatabase();
  try {
    const service = createAuthService({
      pool: db.pool,
      repos,
      config: baseConfig,
      clock: () => new Date("2026-10-18T00:00:00.000Z"),
      dummyHash: await createDummyHash(),
      rateLimiter: createRateLimiter(),
      scryptGate: createScryptGate(),
    });
    const first = await service.login({ username: "userA", password: "demo1234", ip: "127.0.0.1" });
    const second = await service.login({ username: "userA", password: "demo1234", ip: "127.0.0.1", previousToken: first.token });
    assert.equal((await db.pool.query("SELECT COUNT(*)::int AS n FROM sessions")).rows[0].n, 1);
    await assert.rejects(() => service.me(first.token), (error) => error.code === "auth-required");
    assert.equal((await service.me(second.token)).username, "userA");
    await service.logout(second.token);
    await assert.rejects(() => service.me(second.token), (error) => error.code === "auth-required");
  } finally {
    await db.close();
  }
});

test("register rejects duplicate usernames and returns the frozen user shape", async () => {
  const db = await createTestDatabase();
  try {
    const service = createAuthService({
      pool: db.pool,
      repos,
      config: baseConfig,
      clock: () => new Date("2026-10-18T00:00:00.000Z"),
      dummyHash: await createDummyHash(),
      rateLimiter: createRateLimiter(),
      scryptGate: createScryptGate(),
    });
    const created = await service.register({ username: "new-user", password: "password-123" });
    assert.deepEqual(Object.keys(created).sort(), ["id", "role", "username"]);
    assert.equal(created.role, "user");
    await assert.rejects(
      () => service.register({ username: "new-user", password: "password-123" }),
      (error) => error.code === "auth-username-taken",
    );
  } finally {
    await db.close();
  }
});

test("CSRF tokens compare in constant time and reject mismatches", () => {
  assert.equal(timingSafeEqualText("abc", "abc"), true);
  assert.equal(timingSafeEqualText("abc", "abd"), false);
  assert.equal(timingSafeEqualText("", ""), false);
});
