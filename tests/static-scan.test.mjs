import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const RUNTIME_FILES = [
  "index.html",
  "assets/boot-guard.js",
  "assets/app.mjs",
  "assets/api-client.mjs",
  "assets/controller.mjs",
  "assets/domain.mjs",
  "assets/styles.css",
];

async function readRuntime() {
  const sources = new Map();
  for (const file of RUNTIME_FILES) {
    sources.set(file, await readFile(path.join(ROOT, file), "utf8"));
  }
  return sources;
}

test("runtime source avoids HTML injection sinks", async () => {
  const forbidden = ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write"];
  for (const [file, source] of await readRuntime()) {
    for (const needle of forbidden) {
      assert.equal(source.includes(needle), false, `${file} contains ${needle}`);
    }
  }
});

test("only api-client talks to the network, and it uses same-origin cookies", async () => {
  const sources = await readRuntime();
  const api = sources.get("assets/api-client.mjs");

  assert.match(api, /credentials:\s*"same-origin"/);
  assert.match(api, /"\/api\/auth\/register"/);
  assert.match(api, /"\/api\/auth\/login"/);
  assert.match(api, /"\/api\/auth\/logout"/);
  assert.match(api, /"\/api\/auth\/me"/);
  assert.match(api, /"\/api\/products"/);
  assert.match(api, /"\/api\/orders"/);
  assert.match(api, /"\/api\/orders\/mine"/);
  assert.match(api, /\/api\/orders\/\$\{encodeURIComponent\(orderNumber\)\}/);
  assert.match(api, /"\/api\/admin\/orders"/);
  assert.match(api, /"\/api\/admin\/products"/);
  assert.match(api, /\/api\/admin\/products\/\$\{encodeURIComponent\(productId\)\}/);
  assert.match(api, /method:\s*"PATCH"/);
  assert.match(api, /clientOrderId/);

  for (const file of ["assets/app.mjs", "assets/controller.mjs", "assets/domain.mjs"]) {
    const source = sources.get(file);
    for (const needle of ["fetch(", "XMLHttpRequest", "WebSocket", "EventSource"]) {
      assert.equal(source.includes(needle), false, `${file} must not call ${needle}`);
    }
  }
});

test("runtime has no remote assets, fonts, or imports", async () => {
  const forbidden = [
    "http://",
    "https://",
    "//cdn",
    "@import",
    "@font-face",
    "fonts.googleapis",
    "fonts.gstatic",
    "url(",
  ];
  for (const [file, source] of await readRuntime()) {
    for (const needle of forbidden) {
      assert.equal(source.includes(needle), false, `${file} contains ${needle}`);
    }
  }
});

test("HTML has no inline script, style, or event-handler sinks", async () => {
  const html = await readFile(path.join(ROOT, "index.html"), "utf8");
  assert.equal(/<script(?![^>]*\bsrc=)/i.test(html), false);
  assert.equal(/\sstyle\s*=/i.test(html), false);
  assert.equal(/\son[a-z]+\s*=/i.test(html), false);
  assert.equal(html.includes("javascript:"), false);
});

test("HTML CSP meta is compatibility-only: self scripts/styles, self connect", async () => {
  const html = await readFile(path.join(ROOT, "index.html"), "utf8");
  const match = /http-equiv="Content-Security-Policy"[\s\S]*?content="([^"]+)"/i.exec(html);
  assert.ok(match, "CSP meta tag must exist");
  const policy = match[1];
  for (const directive of [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ]) {
    assert.ok(policy.includes(directive), `CSP is missing ${directive}`);
  }
  // frame-ancestors 在 <meta> 中被浏览器忽略，必须由 HTTP 头下发，不能写在 meta 里（qa 环修复）。
  assert.equal(policy.includes("frame-ancestors"), false, "frame-ancestors must be delivered by HTTP header, not meta");
  const serve = await readFile(path.join(ROOT, "serve.mjs"), "utf8");
  assert.ok(serve.includes("frame-ancestors 'none'"), "HTTP header CSP must include frame-ancestors 'none'");
  assert.equal(policy.includes("unsafe-inline"), false);
  assert.equal(policy.includes("http://"), false);
  assert.equal(policy.includes("https://"), false);
});

test("index.html contains every node the app caches", async () => {
  const app = await readFile(path.join(ROOT, "assets/app.mjs"), "utf8");
  const html = await readFile(path.join(ROOT, "index.html"), "utf8");
  const block = /const REF_IDS = Object\.freeze\(\{([\s\S]*?)\}\);/m.exec(app);
  assert.ok(block, "REF_IDS mapping must exist");
  const ids = [...block[1].matchAll(/:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.ok(ids.length >= 40, "expected the full page ref inventory");
  const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  for (const id of ids) {
    assert.ok(htmlIds.has(id), `index.html is missing #${id}`);
  }
});

test("page keeps the R1 navigation entries and a skip link", async () => {
  const html = await readFile(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /class="skip-link"[^>]*href="#main"/);
  for (const href of ["#catalog-section", "#lookup", "#my-orders", "#auth", "#cart"]) {
    assert.ok(html.includes(`href="${href}"`), `navigation is missing ${href}`);
  }
  assert.match(html, /id="nav-admin"[^>]*hidden/);
  assert.match(html, /id="lookup-input"[\s\S]*?aria-describedby="lookup-input-help lookup-input-error"/);
});

test("design tokens are the Apple palette, radii, container, and type scale", async () => {
  const css = await readFile(path.join(ROOT, "assets/styles.css"), "utf8");
  for (const token of [
    "--color-bg: #ffffff",
    "--color-surface: #f5f5f7",
    "--color-text: #1d1d1f",
    "--color-text-secondary: #6e6e73",
    "--color-accent: #0071e3",
    "--color-danger: #b3261e",
    "--radius-tile: 18px",
    "--radius-pill: 980px",
    "--container: 1280px",
    "--text-xs: 12px",
    "--text-sm: 14px",
    "--text-base: 17px",
    "--text-lg: 21px",
    "--text-xl: 28px",
    "--text-2xl: 40px",
    "--text-display: clamp(40px, 6vw, 56px)",
    "--focus-ring-width: 3px",
    "--duration: 220ms",
    "--ease: cubic-bezier(0.25, 0.1, 0.25, 1)",
  ]) {
    assert.ok(css.includes(token), `styles.css is missing token ${token}`);
  }
  assert.match(css, /-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue"/);
});

test("layout uses 4/3/2/1 product columns and respects reduced motion", async () => {
  const css = await readFile(path.join(ROOT, "assets/styles.css"), "utf8");
  assert.match(css, /@media \(min-width: 600px\)[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(min-width: 834px\)[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(min-width: 1068px\)[\s\S]*?repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 719\.98px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /aspect-ratio: 1 \/ 1/);
  assert.match(css, /object-fit: contain/);
});

test("visual language forbids gradients, shadows on cards, remote images, emoji, and promo copy", async () => {
  const css = await readFile(path.join(ROOT, "assets/styles.css"), "utf8");
  const html = await readFile(path.join(ROOT, "index.html"), "utf8");

  assert.equal(css.includes("linear-gradient"), false);
  assert.equal(css.includes("radial-gradient"), false);
  assert.equal(css.includes("conic-gradient"), false);
  assert.match(css, /\.product-card \{[\s\S]*?box-shadow: none;/);

  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
  assert.equal(emoji.test(html), false, "index.html must not use emoji");
  assert.equal(emoji.test(css), false, "styles.css must not use emoji");

  assert.equal(html.includes("！"), false, "copy must not use exclamation marks");
  for (const promo of ["限时", "抢购", "秒杀", "爆款", "特惠", "促销", "包邮", "立减"]) {
    assert.equal(html.includes(promo), false, `copy must not use promo wording: ${promo}`);
  }
});

test("product cards use local photos, alt text, and stable quantity controls", async () => {
  const app = await readFile(path.join(ROOT, "assets/app.mjs"), "utf8");
  assert.match(app, /src: `\.\/assets\/images\/products\/\$\{product\.id\}\.jpg`/);
  assert.match(app, /alt: typeof product\.alt === "string"/);
  assert.match(app, /id: `quantity-\$\{product\.id\}`/);
  assert.match(app, /name: `quantity-\$\{product\.id\}`/);
  assert.match(app, /crypto\.randomUUID\(\)/);
});

test("retired frontend modules are gone and no file imports them", async () => {
  for (const retired of ["assets/catalog.mjs", "assets/order-store.mjs"]) {
    await assert.rejects(access(path.join(ROOT, retired)), `${retired} should be deleted`);
  }
  for (const file of ["assets/app.mjs", "assets/controller.mjs"]) {
    const source = await readFile(path.join(ROOT, file), "utf8");
    assert.equal(source.includes("catalog.mjs"), false, `${file} still imports catalog.mjs`);
    assert.equal(source.includes("order-store.mjs"), false, `${file} still imports order-store.mjs`);
  }
});

test("runtime dependency set is exactly pg and no generated build directory exists", async () => {
  const pkg = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
  assert.deepEqual(Object.keys(pkg.dependencies ?? {}).sort(), ["pg"]);
  assert.deepEqual(Object.keys(pkg.devDependencies ?? {}), []);
  assert.equal(pkg.engines.node, ">=22.0.0");
  const rootEntries = await readdir(ROOT);
  assert.equal(rootEntries.includes("dist"), false);
});
