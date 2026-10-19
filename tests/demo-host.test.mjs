import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../config.mjs";
import { createTestDatabase } from "./helpers/pg.mjs";
import { startTestServer, request } from "./helpers/server.mjs";

const BASE_ENV = {
  APP_ENV: "production",
  DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:55432/postgres",
  ADMIN_PASSWORD: "strong-admin-password",
  COOKIE_SECURE: "1",
};

test("DEMO_ALLOW_ANY_HOST is enabled only outside production", () => {
  const dev = loadConfig({
    env: { ...BASE_ENV, APP_ENV: "development", ADMIN_PASSWORD: "", COOKIE_SECURE: "0", DEMO_ALLOW_ANY_HOST: "1" },
  });
  assert.equal(dev.demoAllowAnyHost, true);

  const prod = loadConfig({ env: { ...BASE_ENV, DEMO_ALLOW_ANY_HOST: "1" } });
  assert.equal(prod.demoAllowAnyHost, false);
});

test("demo mode accepts an arbitrary external Host", async () => {
  const db = await createTestDatabase();
  const demo = await startTestServer(db.url, { configOverrides: { demoAllowAnyHost: true } });
  const strict = await startTestServer(db.url);
  try {
    const blocked = await request(strict.base, "GET", "/api/health", { headers: { host: "killercoda.example" } });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.code, "host-not-allowed");

    const allowed = await request(demo.base, "GET", "/api/health", {
      headers: { host: "killercoda.example", origin: "https://killercoda.example" },
    });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.body.ok, true);
  } finally {
    await strict.close();
    await demo.close();
    await db.close();
  }
});
