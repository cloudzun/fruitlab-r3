import http from "node:http";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const HOST = "127.0.0.1";
export const DEFAULT_PORT = 4173;
export const SERVER_VERSION = "1.0.0";

export const PUBLIC_ALLOWLIST = new Set([
  "/index.html",
  "/README.md",
  "/BUILD-LOG.md",
  "/SPEC.md",
  "/DECISIONS.md",
  "/OFFICE_HOURS.md",
  "/assets/app.mjs",
  "/assets/boot-guard.js",
  "/assets/catalog.mjs",
  "/assets/controller.mjs",
  "/assets/domain.mjs",
  "/assets/order-store.mjs",
  "/assets/styles.css",
  "/docs/error-catalog.md",
  "/docs/designs/fruitlab-traceable-demo.md",
  "/evidence/clean-run.md",
  "/evidence/index.md",
  "/evidence/learner-checks/pre-spec.md",
  "/evidence/manual-checks/browser.md",
  "/evidence/spec-quality-gate.md",
]);

export const MIME_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
});

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'none'",
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
    ...extra,
  };
}

function problem(status, code, detail, fix, instance = "/") {
  return {
    type: "about:blank",
    title: http.STATUS_CODES[status] ?? "Error",
    status,
    detail,
    instance,
    code,
    fix,
  };
}

function sendProblem(response, status, code, detail, fix, instance, extraHeaders = {}) {
  const body = JSON.stringify(problem(status, code, detail, fix, instance));
  response.writeHead(status, commonHeaders({
    "Content-Type": "application/problem+json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...extraHeaders,
  }));
  response.end(body);
}

function isRejectedRawPath(rawUrl) {
  return (
    rawUrl.includes("\\") ||
    rawUrl.includes("\0") ||
    rawUrl.includes("?") ||
    rawUrl.includes("#") ||
    /%(?:2f|5c|00)/i.test(rawUrl)
  );
}

function decodePublicPath(rawUrl) {
  if (typeof rawUrl !== "string" || isRejectedRawPath(rawUrl)) return null;

  let decoded;
  try {
    decoded = decodeURIComponent(rawUrl);
  } catch {
    return null;
  }

  if (!decoded.startsWith("/") || decoded.includes("\\") || decoded.includes("\0")) {
    return null;
  }

  const segments = decoded.split("/");
  if (segments.some((segment) => segment.startsWith("."))) {
    return null;
  }
  if (path.posix.normalize(decoded) !== decoded) {
    return null;
  }

  return decoded === "/" ? "/index.html" : decoded;
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function createStaticServer({
  root = LAB_ROOT,
  allowlist = PUBLIC_ALLOWLIST,
  readFileImpl = readFile,
  logger = console,
} = {}) {
  const projectRoot = path.resolve(root);

  return http.createServer(async (request, response) => {
    const instance = typeof request.url === "string" ? request.url : "/";

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendProblem(
        response,
        405,
        "http-method-not-allowed",
        "Only GET and HEAD are available from this demo server.",
        "Use GET or HEAD.",
        instance,
        { Allow: "GET, HEAD" },
      );
      return;
    }

    const publicPath = decodePublicPath(request.url);
    if (!publicPath || !allowlist.has(publicPath)) {
      sendProblem(
        response,
        404,
        "http-not-found",
        "The requested public file was not found.",
        "Open / or another path listed by the demo README.",
        instance,
      );
      return;
    }

    let canonicalRoot;
    let canonicalTarget;
    try {
      canonicalRoot = await realpath(projectRoot);
      canonicalTarget = await realpath(path.join(projectRoot, publicPath.slice(1)));
    } catch (error) {
      if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
        sendProblem(
          response,
          404,
          "http-not-found",
          "The requested public file was not found.",
          "Open / or another path listed by the demo README.",
          instance,
        );
      } else {
        sendProblem(
          response,
          500,
          "http-static-read-failed",
          "The static server could not read the requested file.",
          "Check the repository files and restart node serve.mjs.",
          instance,
        );
      }
      return;
    }

    if (!isWithin(canonicalRoot, canonicalTarget)) {
      sendProblem(
        response,
        404,
        "http-not-found",
        "The requested public file was not found.",
        "Open / or another path listed by the demo README.",
        instance,
      );
      return;
    }

    let body;
    try {
      body = await readFileImpl(canonicalTarget);
    } catch {
      logger?.error?.("static read failed [http-static-read-failed]");
      sendProblem(
        response,
        500,
        "http-static-read-failed",
        "The static server could not read the requested file.",
        "Check the repository files and restart node serve.mjs.",
        instance,
      );
      return;
    }

    const content = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
    const contentType = MIME_TYPES[path.extname(publicPath).toLowerCase()] ??
      "application/octet-stream";

    response.writeHead(200, commonHeaders({
      "Content-Type": contentType,
      "Content-Length": content.byteLength,
    }));

    if (request.method === "HEAD") {
      response.end();
    } else {
      response.end(content);
    }
  });
}

export function supportsNodeVersion(version = process.versions.node) {
  const major = Number.parseInt(String(version).replace(/^v/, "").split(".")[0], 10);
  return Number.isInteger(major) && major >= 22;
}

export function parseCliArgs(argv) {
  let port = DEFAULT_PORT;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") return { kind: "help" };
    if (arg === "--version" || arg === "-v") return { kind: "version" };

    if (arg === "--port") {
      const value = argv[index + 1];
      if (value === undefined || value.trim() === "" || value.startsWith("-")) {
        return { kind: "invalid", message: "--port requires a value" };
      }
      index += 1;
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65_535) {
        return { kind: "invalid", message: "--port must be an integer from 0 to 65535" };
      }
      port = parsed;
      continue;
    }

    if (arg.startsWith("--port=")) {
      const value = arg.slice("--port=".length);
      if (value.trim() === "") {
        return { kind: "invalid", message: "--port requires a value" };
      }
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65_535) {
        return { kind: "invalid", message: "--port must be an integer from 0 to 65535" };
      }
      port = parsed;
      continue;
    }

    return { kind: "invalid", message: `unknown argument: ${arg}` };
  }

  return { kind: "serve", port };
}

export async function startStaticServer({ port = DEFAULT_PORT, root = LAB_ROOT, ...options } = {}) {
  const server = createStaticServer({ root, ...options });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, HOST, resolve);
  });
  const actualPort = server.address().port;
  return {
    server,
    port: actualPort,
    url: `http://${HOST}:${actualPort}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

const HELP_TEXT = `FruitLab static server

Usage:
  node serve.mjs
  node serve.mjs --port 4174
  node serve.mjs --help
  node serve.mjs --version

Default address: http://127.0.0.1:4173
Stop the server with Ctrl+C.
`;

function write(stream, text) {
  stream?.write?.(text);
}

export async function main(
  argv = process.argv.slice(2),
  io = { stdout: process.stdout, stderr: process.stderr },
) {
  if (!supportsNodeVersion()) {
    write(io.stderr, "Node.js 22 or newer is required [node-version-unsupported].\n");
    return 1;
  }

  const parsed = parseCliArgs(argv);
  if (parsed.kind === "help") {
    write(io.stdout, HELP_TEXT);
    return 0;
  }
  if (parsed.kind === "version") {
    write(io.stdout, `fruitlab-static-server ${SERVER_VERSION}\n`);
    return 0;
  }
  if (parsed.kind === "invalid") {
    write(io.stderr, `${parsed.message} [cli-invalid-argument]\nRun node serve.mjs --help for usage.\n`);
    return 2;
  }

  try {
    const running = await startStaticServer({ port: parsed.port });
    write(io.stdout, `FruitLab ready at ${running.url}\n`);

    const shutdown = () => {
      running.close().finally(() => process.exit(0));
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
    return running;
  } catch (error) {
    if (error?.code === "EADDRINUSE") {
      const nextPort = parsed.port === 65_535 ? 4173 : parsed.port + 1;
      write(
        io.stderr,
        `Port ${parsed.port} is already in use [http-port-in-use].\n` +
        `Stop the other process or run: node serve.mjs --port ${nextPort}\n`,
      );
      return 1;
    }
    write(io.stderr, "Failed to start the static server [http-server-start-failed].\n");
    return 1;
  }
}

const isDirectRun = process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectRun) {
  const result = await main();
  if (typeof result === "number") {
    process.exitCode = result;
  }
}
