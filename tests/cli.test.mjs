// CLI 集成测试：spawnSync 子进程 + 真实 Postgres。
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTestDatabase } from "./helpers/pg.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const NODE = process.execPath;

function run(args, env = {}, { input } = {}) {
  const result = spawnSync(NODE, ["cli.mjs", ...args], {
    cwd: ROOT,
    env: { ...process.env, APP_ENV: "development", ...env },
    input,
    encoding: "utf8",
    timeout: 120000,
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function cliEnv(db) {
  return { DATABASE_URL: db.url, APP_ENV: "development", DEMO_PASSWORD: "demo1234" };
}

test("--help/--version/unknown/--db exit codes", () => {
  const help = run(["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /db restore/);
  const version = run(["--version"]);
  assert.equal(version.status, 0);
  const unknown = run(["nope"]);
  assert.equal(unknown.status, 2);
  const legacy = run(["--db", "data/x.db", "db", "migrate"]);
  assert.equal(legacy.status, 2);
  assert.match(legacy.stderr, /--db 已移除/);
});

test("db migrate/seed/check run against Postgres", async () => {
  const db = await createTestDatabase({ seed: false });
  try {
    assert.equal(run(["db", "migrate"], cliEnv(db)).status, 0);
    assert.equal(run(["db", "seed"], cliEnv(db)).status, 0);
    const check = run(["db", "check", "--json"], cliEnv(db));
    assert.equal(check.status, 0);
    const payload = JSON.parse(check.stdout);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.counts.products, 14);
    assert.equal(payload.data.counts.users, 3);
    assert.deepEqual(payload.data.problems, []);
  } finally {
    await db.close();
  }
});

test("user add + user list + product set-price", async () => {
  const db = await createTestDatabase();
  try {
    const env = cliEnv(db);
    const added = run(["user", "add", "--username", "cli-user", "--password-stdin", "--role", "admin"], env, { input: "cli-password-123\n" });
    assert.equal(added.status, 0, added.stderr);
    const list = run(["user", "list", "--json"], env);
    assert.equal(list.status, 0);
    assert.ok(JSON.parse(list.stdout).data.some((user) => user.username === "cli-user" && user.role === "admin"));
    const price = run(["product", "set-price", "--id", "banana", "--unit-price-cents", "777"], env);
    assert.equal(price.status, 0, price.stderr);
    const products = run(["product", "list", "--json"], env);
    assert.equal(JSON.parse(products.stdout).data.find((item) => item.id === "banana").unitPriceCents, 777);
  } finally {
    await db.close();
  }
});

test("db backup produces a restorable JSON Lines file", async () => {
  const db = await createTestDatabase();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fruitlab-backup-"));
  try {
    const env = cliEnv(db);
    const backup = run(["db", "backup", "--out", dir], env);
    assert.equal(backup.status, 0, backup.stderr);
    const file = /备份完成: (.+)$/m.exec(backup.stdout)?.[1]?.trim();
    assert.ok(file && fs.existsSync(file));
    const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
    const meta = JSON.parse(lines[0]);
    assert.equal(meta.type, "meta");
    assert.equal(meta.schemaVersion, 1);
    assert.ok(lines.some((line) => JSON.parse(line).name === "users"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    await db.close();
  }
});

test("db restore returns modified data to the backup state", async () => {
  const db = await createTestDatabase();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fruitlab-restore-"));
  try {
    const env = cliEnv(db);
    const backup = run(["db", "backup", "--out", dir], env);
    const file = /备份完成: (.+)$/m.exec(backup.stdout)?.[1]?.trim();
    assert.ok(file);
    await db.pool.query("UPDATE users SET role = 'admin' WHERE username = 'userB'");
    const restored = run(["db", "restore", "--in", file, "--yes"], env);
    assert.equal(restored.status, 0, restored.stderr);
    const row = await db.pool.query("SELECT role FROM users WHERE username = 'userB'");
    assert.equal(row.rows[0].role, "user");
    const counts = await db.pool.query("SELECT COUNT(*)::int AS n FROM products");
    assert.equal(counts.rows[0].n, 14);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    await db.close();
  }
});

test("db reset backs up first and rebuilds; backup failure aborts without data loss", async () => {
  const db = await createTestDatabase();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fruitlab-reset-"));
  const blocker = path.join(dir, "not-a-directory");
  try {
    fs.writeFileSync(blocker, "x");
    const env = cliEnv(db);
    const failed = run(["db", "reset", "--yes", "--out", blocker], env);
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /备份失败|backup-failed/);
    const count = await db.pool.query("SELECT COUNT(*)::int AS n FROM products");
    assert.equal(count.rows[0].n, 14);
    const ok = run(["db", "reset", "--yes", "--out", dir], env);
    assert.equal(ok.status, 0, ok.stderr);
    const after = await db.pool.query("SELECT COUNT(*)::int AS n FROM products");
    assert.equal(after.rows[0].n, 14);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    await db.close();
  }
});

test("db check fails when a migration checksum is tampered", async () => {
  const db = await createTestDatabase();
  try {
    await db.pool.query("UPDATE schema_migrations SET checksum = 'tampered' WHERE version = 1");
    const check = run(["db", "check", "--json"], cliEnv(db));
    assert.equal(check.status, 1);
    const payload = JSON.parse(check.stdout);
    assert.equal(payload.ok, false);
    assert.ok(payload.data.problems.some((item) => /checksum/.test(item)));
  } finally {
    await db.close();
  }
});

test("production mode rejects missing/weak admin password and insecure cookie", async () => {
  const db = await createTestDatabase();
  try {
    const base = { DATABASE_URL: db.url, APP_ENV: "production", DEMO_PASSWORD: "demo1234" };
    const missing = run(["db", "seed"], base);
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /ADMIN_PASSWORD/);
    const weak = run(["db", "seed"], { ...base, ADMIN_PASSWORD: "demo1234", COOKIE_SECURE: "1" });
    assert.equal(weak.status, 1);
    assert.match(weak.stderr, /ADMIN_PASSWORD/);
    const insecure = run(["db", "seed"], { ...base, ADMIN_PASSWORD: "strong-admin-password", COOKIE_SECURE: "0" });
    assert.equal(insecure.status, 1);
    assert.match(insecure.stderr, /COOKIE_SECURE/);
    const ok = run(["db", "seed"], { ...base, ADMIN_PASSWORD: "strong-admin-password", COOKIE_SECURE: "1" });
    assert.equal(ok.status, 0, ok.stderr);
  } finally {
    await db.close();
  }
});
