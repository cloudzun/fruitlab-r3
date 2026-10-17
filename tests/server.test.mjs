import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  MIME_TYPES,
  createStaticServer,
  parseCliArgs,
  supportsNodeVersion,
} from "../serve.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

async function withServer(options, run) {
  const server = createStaticServer({ root: ROOT, ...options });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const { port } = server.address();
  try {
    await run({ port, server });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function requestRawPath(port, rawPath) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: "127.0.0.1",
      port,
      path: rawPath,
      method: "GET",
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        resolve({
          status: response.statusCode,
          headers: response.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    request.on("error", reject);
    request.end();
  });
}

test("GET / serves index.html with security and no-store headers", async () => {
  await withServer({}, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(response.headers.get("content-security-policy"), /default-src 'self'/);
    assert.match(body, /id="catalog"/);
    assert.match(body, /id="lookup"/);
  });
});

test("HEAD returns headers without a body and MIME values match the contract", async () => {
  await withServer({}, async ({ port }) => {
    const head = await fetch(`http://127.0.0.1:${port}/assets/styles.css`, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get("content-type"), "text/css; charset=utf-8");
    assert.equal(await head.text(), "");

    const moduleResponse = await fetch(`http://127.0.0.1:${port}/assets/domain.mjs`);
    assert.equal(moduleResponse.headers.get("content-type"), "text/javascript; charset=utf-8");

    const markdown = await fetch(`http://127.0.0.1:${port}/README.md`);
    assert.equal(markdown.headers.get("content-type"), "text/markdown; charset=utf-8");

    assert.deepEqual(MIME_TYPES, {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".mjs": "text/javascript; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".md": "text/markdown; charset=utf-8",
    });
  });
});

test("unsupported methods return problem+json 405 with Allow", async () => {
  await withServer({}, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/`, { method: "POST" });
    const problem = await response.json();

    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "GET, HEAD");
    assert.match(response.headers.get("content-type"), /^application\/problem\+json/);
    assert.equal(problem.code, "http-method-not-allowed");
    assert.equal(problem.status, 405);
  });
});

test("unknown, private, traversing, queried, and encoded paths return problem 404", async () => {
  const paths = [
    "/unknown.txt",
    "/.git/config",
    "/tests/domain.test.mjs",
    "/index.html?x=1",
    "/%2e%2e/SPEC.md",
    "/assets/%2E%2E/%2E%2E/SPEC.md",
    "/assets%5c..%5cSPEC.md",
    "/assets/%252e%252e%252fSPEC.md",
  ];

  await withServer({}, async ({ port }) => {
    for (const requestPath of paths) {
      const response = await requestRawPath(port, requestPath);
      assert.equal(response.status, 404, requestPath);
      assert.match(response.headers["content-type"], /^application\/problem\+json/);
      assert.equal(response.headers["cache-control"], "no-store");
    }
  });
});

test("read failures return redacted problem+json 500", async () => {
  await withServer(
    {
      readFileImpl: async () => {
        throw new Error(`secret path ${ROOT}`);
      },
    },
    async ({ port }) => {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      const problem = await response.json();
      const text = JSON.stringify(problem);

      assert.equal(response.status, 500);
      assert.equal(problem.code, "http-static-read-failed");
      assert.equal(text.includes(ROOT), false);
      assert.equal(text.includes("secret path"), false);
    },
  );
});

test("symlink escapes are rejected when the platform permits creating a symlink", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "fruitlab-server-"));
  const outside = await mkdtemp(path.join(tmpdir(), "fruitlab-outside-"));
  const outsideFile = path.join(outside, "secret.txt");
  await writeFile(outsideFile, "outside", "utf8");

  try {
    try {
      await symlink(outsideFile, path.join(root, "index.html"), "file");
    } catch (error) {
      if (error.code === "EPERM" || error.code === "EACCES") {
        t.skip("symlink creation is not permitted on this Windows profile");
        return;
      }
      throw error;
    }

    const server = createStaticServer({ root, allowlist: new Set(["/index.html"]) });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const { port } = server.address();
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      assert.equal(response.status, 404);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("CLI argument parsing, version check, help, and unknown-argument exit code are fixed", () => {
  assert.equal(supportsNodeVersion("v22.20.0"), true);
  assert.equal(supportsNodeVersion("v18.19.0"), false);

  assert.deepEqual(parseCliArgs([]), { kind: "serve", port: 4173 });
  assert.deepEqual(parseCliArgs(["--port", "0"]), { kind: "serve", port: 0 });
  assert.deepEqual(parseCliArgs(["--port=5000"]), { kind: "serve", port: 5000 });
  assert.deepEqual(parseCliArgs(["--help"]), { kind: "help" });
  assert.deepEqual(parseCliArgs(["--version"]), { kind: "version" });
  assert.equal(parseCliArgs(["--bogus"]).kind, "invalid");
  assert.equal(parseCliArgs(["--port", "70000"]).kind, "invalid");

  const help = spawnSync(process.execPath, ["serve.mjs", "--help"], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 5_000,
  });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /node serve\.mjs/);

  const invalid = spawnSync(process.execPath, ["serve.mjs", "--bogus"], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 5_000,
  });
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /unknown argument/i);
  assert.match(invalid.stderr, /cli-invalid-argument/);

  const version = spawnSync(process.execPath, ["serve.mjs", "--version"], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 5_000,
  });
  assert.equal(version.status, 0);
  assert.match(version.stdout, /^fruitlab-static-server \d+\.\d+\.\d+\s*$/);
});

test("an occupied port exits non-zero with a safe recovery command", async () => {
  const occupied = createStaticServer({ root: ROOT });
  await new Promise((resolve, reject) => {
    occupied.once("error", reject);
    occupied.listen(0, "127.0.0.1", resolve);
  });

  try {
    const { port } = occupied.address();
    const result = spawnSync(process.execPath, ["serve.mjs", "--port", String(port)], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 5_000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /http-port-in-use/);
    const nextPort = port === 65_535 ? 4173 : port + 1;
    assert.match(result.stderr, new RegExp(`node serve\\.mjs --port ${nextPort}`));
  } finally {
    await new Promise((resolve) => occupied.close(resolve));
  }
});
