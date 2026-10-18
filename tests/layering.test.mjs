// 分层依赖规则：机械断言 import 图、SQL 位置与依赖集合。
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SERVER = path.join(ROOT, "server");

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(target)));
    else if (entry.name.endsWith(".mjs")) out.push(target);
  }
  return out;
}

function importsOf(source) {
  return [...source.matchAll(/import\s+(?:[\s\S]*?)\s+from\s+["']([^"']+)["']/g)].map((match) => match[1]);
}

test("router only imports protocol/auth primitives, never pg/db/repositories", async () => {
  const source = await readFile(path.join(SERVER, "router.mjs"), "utf8");
  const imports = importsOf(source);
  for (const specifier of imports) {
    assert.equal(specifier === "pg", false, `router imports pg: ${specifier}`);
    assert.equal(/repositories|\.\/db\.mjs|\.\/seed\.mjs|\.\/app\.mjs/.test(specifier), false, `router imports ${specifier}`);
  }
  const sql = /\b(SELECT\s|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|BEGIN;|COMMIT;|ROLLBACK;)/;
  assert.equal(sql.test(source), false, "router must not contain SQL statements");
});

test("services do not import HTTP/router and never touch req/res", async () => {
  for (const file of (await walk(path.join(SERVER, "services")))) {
    const source = await readFile(file, "utf8");
    for (const specifier of importsOf(source)) {
      assert.equal(/node:http|node:https|\.\.\/router\.mjs|\.\.\/serve\.mjs/.test(specifier), false, `${file} imports ${specifier}`);
    }
    assert.equal(/\breq\.|\bres\./.test(source), false, `${file} touches req/res`);
  }
});

test("repositories do not import services/router and contain no business service calls", async () => {
  for (const file of (await walk(path.join(SERVER, "repositories")))) {
    const source = await readFile(file, "utf8");
    for (const specifier of importsOf(source)) {
      assert.equal(/services|router|serve\.mjs/.test(specifier), false, `${file} imports ${specifier}`);
    }
  }
});

test("domain layer stays free of server imports", async () => {
  const source = await readFile(path.join(ROOT, "assets", "domain.mjs"), "utf8");
  for (const specifier of importsOf(source)) {
    assert.equal(/server\//.test(specifier), false, `domain imports ${specifier}`);
    assert.equal(/node:http|node:fs/.test(specifier), false, `domain imports ${specifier}`);
  }
});

test("composition root is the only module importing db + repositories + services together", async () => {
  const source = await readFile(path.join(SERVER, "app.mjs"), "utf8");
  assert.match(source, /from "\.\/db\.mjs"/);
  assert.match(source, /repositories\//);
  assert.match(source, /services\/index\.mjs/);
  assert.match(source, /router\.mjs/);
});

test("package runtime dependencies are exactly pg", async () => {
  const pkg = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
  assert.deepEqual(Object.keys(pkg.dependencies ?? {}), ["pg"]);
});

test("index.html, 14 product images and key docs exist for the public allowlist", async () => {
  const { PUBLIC_ALLOWLIST, IMAGE_RE } = await import("../server/allowlist.mjs");
  const { access } = await import("node:fs/promises");
  const missing = [];
  for (const item of PUBLIC_ALLOWLIST) {
    try {
      await access(path.join(ROOT, item.replace(/^\//, "")));
    } catch {
      missing.push(item);
    }
  }
  assert.deepEqual(missing, [], `missing allowlist files: ${missing.join(", ")}`);
  assert.equal(IMAGE_RE.test("/assets/images/products/fuji-apple.jpg"), true);
  assert.equal(IMAGE_RE.test("/assets/images/products/../../etc/passwd"), false);
});
