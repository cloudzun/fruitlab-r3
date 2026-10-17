import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const RUNTIME_FILES = [
  "index.html",
  "assets/boot-guard.js",
  "assets/app.mjs",
  "assets/catalog.mjs",
  "assets/controller.mjs",
  "assets/domain.mjs",
  "assets/order-store.mjs",
  "assets/styles.css",
];

test("runtime source avoids HTML injection sinks", async () => {
  const forbidden = [
    "innerHTML",
    "outerHTML",
    "insertAdjacentHTML",
    "document.write",
  ];

  for (const file of RUNTIME_FILES) {
    const source = await readFile(path.join(ROOT, file), "utf8");
    for (const needle of forbidden) {
      assert.equal(source.includes(needle), false, `${file} contains ${needle}`);
    }
  }
});

test("runtime source has no remote assets or network API calls", async () => {
  const forbidden = [
    "http://",
    "https://",
    "//cdn",
    "fetch(",
    "XMLHttpRequest",
    "WebSocket",
    "EventSource",
  ];

  for (const file of RUNTIME_FILES) {
    const source = await readFile(path.join(ROOT, file), "utf8");
    for (const needle of forbidden) {
      assert.equal(source.includes(needle), false, `${file} contains ${needle}`);
    }
  }
});

test("HTML does not introduce inline script, style, or event-handler sinks", async () => {
  const html = await readFile(path.join(ROOT, "index.html"), "utf8");
  assert.equal(/<script(?![^>]*\bsrc=)/i.test(html), false);
  assert.equal(/\sstyle\s*=/i.test(html), false);
  assert.equal(/\son[a-z]+\s*=/i.test(html), false);
});

test("project remains dependency-free and has no generated build directory", async () => {
  const rootEntries = await readdir(ROOT);
  assert.equal(rootEntries.includes("package.json"), false);
  assert.equal(rootEntries.includes("node_modules"), false);
  assert.equal(rootEntries.includes("dist"), false);
});
