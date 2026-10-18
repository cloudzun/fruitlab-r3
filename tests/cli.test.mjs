import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const CLI = path.join(ROOT, "cli.mjs");

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "fruitlab-cli-"));
}

function run(args, { input } = {}) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    input,
    timeout: 30_000,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("cli --help exits 0 and lists commands", () => {
  const result = run(["--help"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /命令/);
  assert.match(result.stdout, /db init/);
  assert.match(result.stdout, /orders show/);
});

test("unknown argument exits 2", () => {
  const result = run(["--nope"]);
  assert.equal(result.status, 2);
});

test("db init and seed create 14 products", () => {
  const dir = tempDir();
  const dbPath = path.join(dir, "cli.db");
  try {
    assert.equal(run(["--db", dbPath, "db", "init"]).status, 0);
    assert.equal(run(["--db", dbPath, "--json", "db", "seed"]).status, 0);
    const list = run(["--db", dbPath, "--json", "product", "list"]);
    assert.equal(list.status, 0);
    const parsed = JSON.parse(list.stdout);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.data.length, 14);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("user add --password-stdin and user list", () => {
  const dir = tempDir();
  const dbPath = path.join(dir, "cli.db");
  try {
    run(["--db", dbPath, "db", "init"]);
    run(["--db", dbPath, "db", "seed"]);
    const created = run(["--db", dbPath, "--json", "user", "add", "--username", "staff", "--password-stdin"], { input: "password123\n" });
    assert.equal(created.status, 0);
    assert.equal(JSON.parse(created.stdout).data.username, "staff");
    const list = run(["--db", dbPath, "--json", "user", "list"]);
    const users = JSON.parse(list.stdout).data;
    assert.equal(users.some((u) => u.username === "staff"), true);
    assert.equal(users.length, 4);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("product set-price and db check", () => {
  const dir = tempDir();
  const dbPath = path.join(dir, "cli.db");
  try {
    run(["--db", dbPath, "db", "init"]);
    run(["--db", dbPath, "db", "seed"]);
    const price = run(["--db", dbPath, "--json", "product", "set-price", "--id", "fuji-apple", "--unit-price-cents", "999"]);
    assert.equal(price.status, 0);
    assert.equal(JSON.parse(price.stdout).data.unitPriceCents, 999);
    const check = run(["--db", dbPath, "--json", "db", "check"]);
    assert.equal(check.status, 0);
    assert.equal(JSON.parse(check.stdout).ok, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("db reset requires --yes and backs up", () => {
  const dir = tempDir();
  const dbPath = path.join(dir, "cli.db");
  try {
    run(["--db", dbPath, "db", "init"]);
    run(["--db", dbPath, "db", "seed"]);
    const refused = run(["--db", dbPath, "--json", "db", "reset"]);
    assert.equal(refused.status, 1);
    assert.equal(JSON.parse(refused.stdout).code, "confirmation-required");
    const allowed = run(["--db", dbPath, "db", "reset", "--yes"]);
    assert.equal(allowed.status, 0);
    const backups = fs.readdirSync(path.join(dir, "backups"));
    assert.equal(backups.length >= 1, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("orders list is empty on a fresh database", () => {
  const dir = tempDir();
  const dbPath = path.join(dir, "cli.db");
  try {
    run(["--db", dbPath, "db", "init"]);
    run(["--db", dbPath, "db", "seed"]);
    const list = run(["--db", dbPath, "--json", "orders", "list"]);
    assert.equal(list.status, 0);
    assert.deepEqual(JSON.parse(list.stdout).data, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
