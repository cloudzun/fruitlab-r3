// 契约测试：错误码单源、编号唯一、导出形状。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ERROR_CODES } from "../server/errors.mjs";
import * as db from "../server/db.mjs";
import * as app from "../server/app.mjs";
import * as servicesIndex from "../server/services/index.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

test("docs/error-catalog.md is the single source for error codes", () => {
  const markdown = fs.readFileSync(path.join(ROOT, "docs", "error-catalog.md"), "utf8");
  const documented = new Set();
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^\| `([a-z0-9-]+)` \| \d{3} \|/);
    if (match) documented.add(match[1]);
  }
  assert.equal(documented.size > 25, true);
  assert.deepEqual([...documented].sort(), Object.keys(ERROR_CODES).sort());
});

test("every API error code has an HTTP status and a non-empty message", () => {
  for (const [code, entry] of Object.entries(ERROR_CODES)) {
    assert.equal(Number.isInteger(entry.status), true, `${code} status`);
    assert.equal(entry.status >= 400 && entry.status <= 599, true, `${code} status range`);
    assert.equal(typeof entry.message === "string" && entry.message.length > 0, true, `${code} message`);
  }
});

test("SPEC acceptance criteria are uniquely numbered (AC-49..AC-118)", () => {
  const spec = fs.readFileSync(path.join(ROOT, "SPEC.md"), "utf8");
  const ids = [...spec.matchAll(/^\| AC-(\d+) \|/gm)].map((match) => Number(match[1]));
  assert.equal(ids.length >= 60, true);
  assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
  assert.equal(new Set(ids).size, ids.length);
});

test("DECISIONS obligations are exactly 42 uniquely numbered OB-R3 entries", () => {
  const decisions = fs.readFileSync(path.join(ROOT, "DECISIONS.md"), "utf8");
  const ids = [...decisions.matchAll(/^\| (OB-R3-[A-Z]+-\d{2}) \|/gm)].map((match) => match[1]);
  assert.equal(ids.length, 42);
  assert.equal(new Set(ids).size, 42);
});

test("frozen module exports exist", () => {
  for (const name of ["createPool", "migrate", "withTransaction", "schemaVersion", "isSeeded", "runMigrations", "resetDatabase"]) {
    assert.equal(typeof db[name], "function", `db.${name}`);
  }
  assert.equal(typeof app.createApp, "function");
  assert.equal(typeof app.formatStartupError, "function");
  assert.equal(typeof servicesIndex.createServices, "function");
});

test("decision log records R3 decisions D-47..D-108 without duplicates", () => {
  const log = fs.readFileSync(path.join(ROOT, "docs", "decision-log.md"), "utf8");
  const ids = [...log.matchAll(/^\| D-(\d+) \|/gm)].map((match) => Number(match[1]));
  const r3 = ids.filter((id) => id >= 47);
  assert.equal(r3.length >= 60, true);
  assert.equal(new Set(r3).size, r3.length);
});
