// 认证用例：注册、登录（限流 + 时序防护）、登出、当前用户。
import crypto from "node:crypto";
import {
  hashPassword,
  verifyPassword,
  validateCredentials,
  hashToken,
  createSessionToken,
  timingSafeEqualText,
} from "../auth.mjs";

export class AuthFailure extends Error {
  constructor(code, details) {
    super(code);
    this.code = code;
    this.details = details;
  }
}

export function createAuthService({ pool, repos, config, clock, dummyHash, rateLimiter, scryptGate }) {
  async function runScrypt(fn) {
    try {
      return await scryptGate.run(fn);
    } catch (error) {
      if (error?.code === "auth-busy") throw new AuthFailure("server-busy");
      throw error;
    }
  }

  async function register({ username, password }) {
    const problem = validateCredentials({ username, password });
    if (problem) throw new AuthFailure(problem);
    const passwordHash = await runScrypt(() => hashPassword(password));
    let user;
    try {
      user = await repos.users.create(pool, {
        id: `U${crypto.randomBytes(8).toString("hex")}`,
        username,
        passwordHash,
        role: "user",
        createdAt: clock().toISOString(),
      });
    } catch (error) {
      if (error?.code === "23505") throw new AuthFailure("auth-username-taken");
      throw error;
    }
    return { id: user.id, username: user.username, role: user.role };
  }

  async function login({ username, password, ip = "", previousToken = "" }) {
    if (typeof username !== "string" || typeof password !== "string") {
      throw new AuthFailure("invalid-request");
    }
    const limited = rateLimiter.check({ username, ip });
    if (!limited.allowed) {
      throw new AuthFailure("auth-rate-limited", { retryAfter: limited.retryAfter });
    }
    const user = await repos.users.findByUsername(pool, username);
    const verified = user
      ? await runScrypt(() => verifyPassword(password, user.passwordHash))
      : await runScrypt(() => verifyPassword(password, dummyHash));
    if (!user || !verified) {
      rateLimiter.recordFailure({ username, ip });
      throw new AuthFailure("auth-invalid-credentials");
    }
    rateLimiter.clear({ username, ip });
    const now = clock();
    const token = createSessionToken();
    const expiresAt = new Date(now.getTime() + config.sessionTtlSeconds * 1000);
    if (previousToken) await repos.sessions.deleteByToken(pool, hashToken(previousToken));
    await repos.sessions.purgeExpired(pool, now);
    await repos.sessions.create(pool, {
      tokenHash: hashToken(token),
      userId: user.id,
      createdAt: now,
      expiresAt,
    });
    return {
      token,
      expiresAt,
      maxAgeSeconds: config.sessionTtlSeconds,
      user: { id: user.id, username: user.username, role: user.role },
    };
  }

  async function logout(token) {
    if (!token) return 0;
    return repos.sessions.deleteByToken(pool, hashToken(token));
  }

  async function me(token) {
    if (!token) throw new AuthFailure("auth-required");
    const user = await repos.sessions.findUserByToken(pool, hashToken(token), clock());
    if (!user) throw new AuthFailure("auth-required");
    return user;
  }

  return {
    register,
    login,
    logout,
    me,
    resetRateLimiter: () => rateLimiter.reset(),
    rateLimiter,
    verifyCsrf(cookieToken, headerToken) {
      return timingSafeEqualText(cookieToken, headerToken);
    },
  };
}
