import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ERROR_CODES } from "../server/errors.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

test("docs/error-catalog.md is the single source for error codes", () => {
  const markdown = fs.readFileSync(path.join(ROOT, "docs", "error-catalog.md"), "utf8");
  const documented = new Set();
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^\| `([a-z0-9-]+)` \| \d{3} \|/);
    if (match) documented.add(match[1]);
  }
  assert.equal(documented.size > 20, true);
  assert.deepEqual([...documented].sort(), Object.keys(ERROR_CODES).sort());
});

test("every API error code has an HTTP status and a non-empty message", () => {
  for (const [code, entry] of Object.entries(ERROR_CODES)) {
    assert.equal(Number.isInteger(entry.status), true, `${code} status`);
    assert.equal(entry.status >= 400 && entry.status <= 599, true, `${code} status range`);
    assert.equal(typeof entry.message === "string" && entry.message.length > 0, true, `${code} message`);
  }
});

test("SPEC acceptance criteria are uniquely numbered", () => {
  const spec = fs.readFileSync(path.join(ROOT, "SPEC.md"), "utf8");
  const ids = [...spec.matchAll(/^\| AC-(\d+) \|/gm)].map((match) => Number(match[1]));
  assert.equal(ids.length >= 40, true);
  assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
  assert.equal(new Set(ids).size, ids.length);
});

test("DECISIONS obligations are uniquely numbered per phase", () => {
  const decisions = fs.readFileSync(path.join(ROOT, "DECISIONS.md"), "utf8");
  const ids = [...decisions.matchAll(/^\| (OB-[A-Z]+-\d{2}) \|/gm)].map((match) => match[1]);
  assert.equal(ids.length, 42);
  assert.equal(new Set(ids).size, ids.length);
});
