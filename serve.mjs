// HTTP 服务：API handler + 可选静态托管（simple/本地模式）。
// CSP 以 HTTP 头为唯一来源；静态白名单来自 server/allowlist.mjs。
import http from "node:http";
import path from "node:path";
import { readFile, realpath } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isAllowedPublicPath, mimeTypeFor } from "./server/allowlist.mjs";
import { createApp, formatStartupError } from "./server/app.mjs";
import { loadConfig, ConfigError, readVersion } from "./config.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

export const CONTENT_SECURITY_POLICY = [
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

export function createStaticServer(app, config) {
  const server = http.createServer(async (req, res) => {
    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host ?? `${config.host}:${config.port}`}`);
    } catch {
      return problem(res, 400, "bad-request", "malformed request URL");
    }

    if (url.pathname.startsWith("/api")) {
      const handled = await app.handler(req, res);
      if (handled) return;
    }

    if (!config.serveStatic) return problem(res, 404, "not-found", "static hosting is disabled (web container serves files)");

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
    const candidate = path.join(ROOT, pathname);
    try {
      const real = await realpath(candidate);
      if (!real.startsWith(ROOT + path.sep) && real !== ROOT) {
        return problem(res, 404, "not-found", "path escapes root");
      }
      const body = await readFile(real);
      res.writeHead(200, commonHeaders({ "Content-Type": mimeTypeFor(real), "Content-Length": body.length }));
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
    server.listen(config.port, config.host, () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : config.port;
      resolve({ server, port: actualPort });
    });
  });
}

export function parseArgs(argv) {
  const options = { port: undefined, host: undefined, url: undefined, help: false, version: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") options.help = true;
    else if (arg === "--version") options.version = true;
    else if (arg === "--port" || arg.startsWith("--port=")) {
      const value = arg === "--port" ? argv[++index] : arg.slice("--port=".length);
      const port = Number(value);
      if (!Number.isInteger(port) || port < 0 || port > 65535) return { kind: "invalid", message: "--port must be 0-65535" };
      options.port = port;
    } else if (arg === "--host" || arg.startsWith("--host=")) {
      options.host = arg === "--host" ? argv[++index] : arg.slice("--host=".length);
      if (!options.host) return { kind: "invalid", message: "--host requires a value" };
    } else if (arg === "--url" || arg.startsWith("--url=")) {
      options.url = arg === "--url" ? argv[++index] : arg.slice("--url=".length);
      if (!options.url) return { kind: "invalid", message: "--url requires a DATABASE_URL" };
    } else {
      return { kind: "invalid", message: `unknown argument: ${arg}` };
    }
  }
  return { kind: "ok", options };
}

export async function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);
  if (parsed.kind === "invalid") {
    process.stderr.write(`${parsed.message}\n`);
    process.exitCode = 2;
    return;
  }
  const { options } = parsed;
  if (options.help) {
    process.stdout.write(
      "FruitLab R3 server\n\nUsage: node serve.mjs [--port <0-65535>] [--host <addr>] [--url <DATABASE_URL>]\n\nDefault: http://127.0.0.1:4175\n",
    );
    return;
  }
  if (options.version) {
    process.stdout.write(`${readVersion()}\n`);
    return;
  }
  let config;
  try {
    config = loadConfig({ databaseUrl: options.url });
  } catch (error) {
    process.stderr.write(`${error instanceof ConfigError ? `[config-invalid] ${error.message}` : error}\n`);
    process.exitCode = 1;
    return;
  }
  if (options.port !== undefined) config.port = options.port;
  if (options.host !== undefined) config.host = options.host;
  if (!config.publicUrl.includes(":")) config.publicUrl = `http://${config.host}:${config.port}`;

  let app;
  try {
    app = await createApp({ config });
  } catch (error) {
    process.stderr.write(`${formatStartupError(error, config)}\n`);
    process.exitCode = 1;
    return;
  }
  const { server, port } = await createStaticServer(app, config);
  process.stdout.write(
    `${JSON.stringify({ event: "listening", url: `http://${config.host}:${port}`, port, db: "postgres", schema: app.schemaVersion, seeded: true, version: app.version, static: config.serveStatic })}\n`,
  );
  const shutdown = async () => {
    await new Promise((resolve) => server.close(resolve));
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
