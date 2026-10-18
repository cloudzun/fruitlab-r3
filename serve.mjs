// FruitLab R2 服务端：静态托管 + 同源 API。
// CSP 以本文件下发的 HTTP 头为唯一来源（index.html 中的 meta 仅作兼容）。
import http from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { openDb, migrate, schemaVersion, isSeeded, defaultDbPath } from "./server/db.mjs";
import { createApiHandler } from "./server/router.mjs";

export const HOST = "127.0.0.1";
export const DEFAULT_PORT = 4174;
export const SERVER_VERSION = "2.0.0.0";

export const PUBLIC_ALLOWLIST = new Set([
  "/index.html",
  "/README.md",
  "/SPEC.md",
  "/DECISIONS.md",
  "/OFFICE_HOURS.md",
  "/BUILD.md",
  "/CHANGELOG.md",
  "/VERSION",
  "/BUILD-LOG.md",
  "/assets/app.mjs",
  "/assets/api-client.mjs",
  "/assets/boot-guard.js",
  "/assets/controller.mjs",
  "/assets/domain.mjs",
  "/assets/styles.css",
  "/docs/error-catalog.md",
  "/docs/api.md",
  "/docs/contracts.md",
  "/docs/design-tokens.md",
  "/docs/assets-credits.md",
  "/docs/branch-matrix.md",
  "/docs/obligations.md",
  "/docs/decision-log.md",
  "/docs/cli.md",
  "/docs/designs/fruitlab-traceable-demo.md",
  "/evidence/index.md",
  "/evidence/clean-run.md",
  "/evidence/manual-checks/browser.md",
  "/evidence/spec-quality-gate.md",
  "/evidence/learner-checks/pre-spec.md",
  "/evidence/test-count.txt",
]);

const IMAGE_RE = /^\/assets\/images\/products\/[a-z0-9-]+\.jpg$/;

export const MIME_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
});

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

const LAB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

function commonHeaders(extra = {}) {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": CONTENT_SECURITY_POLICY,
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    ...extra,
  };
}

function problem(res, status, code, detail, extra = {}) {
  const body = JSON.stringify({ type: "about:blank", title: code, status, detail });
  res.writeHead(status, commonHeaders({ "Content-Type": "application/problem+json; charset=utf-8", ...extra }));
  res.end(body);
}

export function supportsNodeVersion(version = process.versions.node) {
  const major = Number(String(version).split(".")[0]);
  return major >= 22;
}

export function isAllowedPublicPath(pathname) {
  return PUBLIC_ALLOWLIST.has(pathname) || IMAGE_RE.test(pathname);
}

export function createStaticServer({ port = DEFAULT_PORT, root = LAB_ROOT, db, dbPath = "", version = SERVER_VERSION, startedAt = Date.now() } = {}) {
  const portRef = { value: port };
  const handler = db ? createApiHandler({ db, version, dbPath, port: () => portRef.value, startedAt }) : null;

  const server = http.createServer(async (req, res) => {
    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host ?? `${HOST}:${port}`}`);
    } catch {
      return problem(res, 400, "bad-request", "malformed request URL");
    }

    if (handler && url.pathname.startsWith("/api")) {
      const handled = await handler(req, res);
      if (handled) return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return problem(res, 405, "method-not-allowed", "only GET and HEAD are supported", { Allow: "GET, HEAD" });
    }

    const rawPath = String(req.url ?? "");
    if (/%2f|%5c|%00/i.test(rawPath)) {
      return problem(res, 404, "not-found", "encoded path separators are not allowed");
    }

    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return problem(res, 404, "not-found", "invalid path encoding");
    }

    if (pathname === "/") pathname = "/index.html";

    if (
      pathname.includes("\\") ||
      pathname.includes("\0") ||
      pathname.includes("//") ||
      pathname.split("/").some((segment) => segment === "..") ||
      pathname.split("/").some((segment) => segment.startsWith(".") && segment !== ".") ||
      !isAllowedPublicPath(pathname)
    ) {
      return problem(res, 404, "not-found", "path is not public");
    }

    const candidate = path.join(root, pathname);
    try {
      const real = await realpath(candidate);
      if (!real.startsWith(root + path.sep) && real !== root) {
        return problem(res, 404, "not-found", "path escapes root");
      }
      const body = await readFile(real);
      const type = MIME_TYPES[path.extname(real).toLowerCase()] ?? "application/octet-stream";
      res.writeHead(200, commonHeaders({ "Content-Type": type, "Content-Length": body.length }));
      if (req.method === "HEAD") return res.end();
      return res.end(body);
    } catch (error) {
      if (error?.code === "ENOENT" || error?.code === "EISDIR" || error?.code === "ENOTDIR") {
        return problem(res, 404, "not-found", "file not found");
      }
      return problem(res, 500, "internal-error", "file read failed");
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, HOST, () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      portRef.value = actualPort;
      resolve({ server, url: `http://${HOST}:${actualPort}`, port: actualPort });
    });
  });
}

export function parseCliArgs(argv) {
  const options = { port: DEFAULT_PORT, dbPath: defaultDbPath(), help: false, version: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") options.help = true;
    else if (arg === "--version") options.version = true;
    else if (arg === "--port" || arg.startsWith("--port=")) {
      const value = arg === "--port" ? argv[++index] : arg.slice("--port=".length);
      const parsed = Number(value);
      if (!value || !Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
        return { kind: "invalid", message: "--port must be an integer from 0 to 65535" };
      }
      options.port = parsed;
    } else if (arg === "--db" || arg.startsWith("--db=")) {
      const value = arg === "--db" ? argv[++index] : arg.slice("--db=".length);
      if (!value) return { kind: "invalid", message: "--db requires a path" };
      options.dbPath = value;
    } else {
      return { kind: "invalid", message: `unknown argument: ${arg}` };
    }
  }
  return { kind: "ok", options };
}

export async function startStaticServer({ port = DEFAULT_PORT, db, root = LAB_ROOT, dbPath = "", version = SERVER_VERSION } = {}) {
  return createStaticServer({ port, root, db, dbPath, version });
}

export async function main(argv = process.argv.slice(2)) {
  const parsed = parseCliArgs(argv);
  if (parsed.kind === "invalid") {
    process.stderr.write(`${parsed.message}\n`);
    process.exitCode = 2;
    return;
  }
  const { options } = parsed;
  if (options.help) {
    process.stdout.write(
      `FruitLab R2 server\n\nUsage: node serve.mjs [--port <0-65535>] [--db <path>]\n\nDefault address: http://${HOST}:${DEFAULT_PORT}\n`,
    );
    return;
  }
  if (options.version) {
    process.stdout.write(`${SERVER_VERSION}\n`);
    return;
  }
  if (!supportsNodeVersion()) {
    process.stderr.write(`[node-version-unsupported] Node.js 22 or newer is required; found ${process.versions.node}\n`);
    process.exitCode = 1;
    return;
  }
  if (options.dbPath !== ":memory:" && !statSync(path.dirname(options.dbPath), { throwIfNoEntry: false })) {
    process.stderr.write(`[db-missing] ${path.dirname(options.dbPath)} 不存在；请先运行 node cli.mjs db init && node cli.mjs db seed\n`);
    process.exitCode = 1;
    return;
  }
  if (options.dbPath !== ":memory:" && !statSync(options.dbPath, { throwIfNoEntry: false })) {
    process.stderr.write(`[db-missing] 数据库 ${options.dbPath} 不存在；请先运行 node cli.mjs db init && node cli.mjs db seed\n`);
    process.exitCode = 1;
    return;
  }

  const db = openDb(options.dbPath);
  migrate(db);
  const { server, url, port } = await startStaticServer({ port: options.port, db, dbPath: options.dbPath });
  process.stdout.write(
    JSON.stringify({ event: "listening", url, port, db: options.dbPath, schema: schemaVersion(db), seeded: isSeeded(db) }) + "\n",
  );

  const shutdown = () => {
    server.close(() => {
      try { db.close(); } catch { /* already closed */ }
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
