import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const HTML = await readFile(path.join(ROOT, "index.html"), "utf8");

// ---------------------------------------------------------------------------
// 最小 fake DOM：只实现 app.mjs 用到的能力，不引第三方依赖。
// ---------------------------------------------------------------------------

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

function toDatasetKey(name) {
  return name
    .slice("data-".length)
    .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

class FakeClassList {
  constructor(element) {
    this.element = element;
    this.values = new Set();
  }

  setFromString(text) {
    this.values = new Set(String(text).split(/\s+/).filter(Boolean));
  }

  sync() {
    this.element._className = [...this.values].join(" ");
  }

  add(...names) {
    for (const name of names) this.values.add(name);
    this.sync();
  }

  remove(...names) {
    for (const name of names) this.values.delete(name);
    this.sync();
  }

  contains(name) {
    return this.values.has(name);
  }

  toggle(name, force) {
    const enabled = force === undefined ? !this.values.has(name) : Boolean(force);
    if (enabled) this.values.add(name);
    else this.values.delete(name);
    this.sync();
    return enabled;
  }
}

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.dataset = {};
    this.listeners = new Map();
    this.classList = new FakeClassList(this);
    this._className = "";
    this.id = "";
    this._text = "";
    this.value = "";
    this.hidden = false;
    this.disabled = false;
    this.focusCount = 0;
    this.selectCount = 0;
    this.replaceCount = 0;
  }

  get className() {
    return this._className;
  }

  set className(value) {
    this._className = String(value);
    this.classList.setFromString(this._className);
    this.attributes.set("class", this._className);
  }

  get textContent() {
    if (this.children.length === 0) return this._text;
    return this.children.map((child) => child.textContent).join("");
  }

  set textContent(value) {
    this._text = String(value);
    for (const child of this.children) child.parentNode = null;
    this.children = [];
  }

  get isConnected() {
    let node = this;
    while (node) {
      if (node === this.ownerDocument.documentElement) return true;
      node = node.parentNode;
    }
    return false;
  }

  append(...nodes) {
    for (const node of nodes) {
      if (!node) continue;
      node.parentNode = this;
      this.children.push(node);
    }
  }

  replaceChildren(...nodes) {
    this.replaceCount += 1;
    for (const child of this.children) {
      if (child.parentNode === this) child.parentNode = null;
    }
    this.children = [];
    this._text = "";
    this.append(...nodes);
  }

  setAttribute(name, value) {
    const key = String(name);
    const text = String(value);
    this.attributes.set(key, text);
    if (key === "id") this.id = text;
    else if (key === "class") this.className = text;
    else if (key === "hidden") this.hidden = true;
    else if (key === "disabled") this.disabled = true;
    else if (key.startsWith("data-")) this.dataset[toDatasetKey(key)] = text;
  }

  getAttribute(name) {
    return this.attributes.get(String(name)) ?? null;
  }

  hasAttribute(name) {
    return this.attributes.has(String(name));
  }

  removeAttribute(name) {
    const key = String(name);
    this.attributes.delete(key);
    if (key === "hidden") this.hidden = false;
    else if (key === "disabled") this.disabled = false;
    else if (key.startsWith("data-")) delete this.dataset[toDatasetKey(key)];
  }

  addEventListener(type, listener) {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  dispatchEvent(event) {
    const payload = {
      preventDefault() {},
      stopPropagation() {},
      ...event,
      target: event.target ?? this,
      currentTarget: this,
    };
    for (const listener of this.listeners.get(payload.type) ?? []) listener(payload);
    return true;
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (matchesSelector(node, selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  querySelector(selector) {
    return findDescendant(this, (node) => matchesSelector(node, selector));
  }

  querySelectorAll(selector) {
    return findDescendants(this, (node) => matchesSelector(node, selector));
  }

  focus() {
    this.focusCount += 1;
  }

  select() {
    this.selectCount += 1;
  }

  scrollIntoView() {}
}

class FakeDocument {
  constructor() {
    this.documentElement = new FakeElement("html", this);
    this.body = new FakeElement("body", this);
    this.documentElement.append(this.body);
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  getElementById(id) {
    return findDescendant(this.body, (node) => node.id === id)
      ?? findDescendant(this.documentElement, (node) => node.id === id);
  }

  querySelector(selector) {
    return this.body.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  }
}

const ID_SELECTOR = /^#([A-Za-z0-9_-]+)$/;
const ATTR_SELECTOR = /^\[([A-Za-z0-9_:-]+)(?:=(?:"([^"]*)"|'([^']*)'))?\]$/;
const TAG_SELECTOR = /^[a-zA-Z][a-zA-Z0-9-]*$/;

function matchesSelector(node, selector) {
  if (ID_SELECTOR.test(selector)) {
    return node.id === ID_SELECTOR.exec(selector)[1];
  }
  if (ATTR_SELECTOR.test(selector)) {
    const match = ATTR_SELECTOR.exec(selector);
    const [, name, doubleQuoted, singleQuoted] = match;
    if (!node.attributes.has(name)) return false;
    const expected = doubleQuoted ?? singleQuoted;
    return expected === undefined || node.attributes.get(name) === expected;
  }
  if (TAG_SELECTOR.test(selector)) {
    return node.tagName === selector.toUpperCase();
  }
  throw new Error(`unsupported selector: ${selector}`);
}

function findDescendant(root, predicate) {
  for (const child of root.children) {
    if (predicate(child)) return child;
    const nested = findDescendant(child, predicate);
    if (nested) return nested;
  }
  return null;
}

function findDescendants(root, predicate) {
  const matches = [];
  for (const child of root.children) {
    if (predicate(child)) matches.push(child);
    matches.push(...findDescendants(child, predicate));
  }
  return matches;
}

function parseAttributes(text) {
  const attributes = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*"([^"]*)")?/g;
  let match = pattern.exec(text ?? "");
  while (match) {
    attributes[match[1].toLowerCase()] = match[2] ?? "";
    match = pattern.exec(text ?? "");
  }
  return attributes;
}

function buildDocument() {
  const document = new FakeDocument();
  const bodyHtml = /<body[^>]*>([\s\S]*)<\/body>/i.exec(HTML)?.[1] ?? "";
  const stack = [document.body];
  const token = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-zA-Z0-9-]+)\s*>|<([a-zA-Z0-9-]+)((?:\s+[^>]*?)?)(\/?)>/gi;
  let match = token.exec(bodyHtml);

  while (match) {
    const [, closeTag, openTag, rawAttributes, selfClosing] = match;
    if (!openTag) {
      if (closeTag) {
        const tag = closeTag.toUpperCase();
        for (let index = stack.length - 1; index > 0; index -= 1) {
          if (stack[index].tagName === tag) {
            stack.length = index;
            break;
          }
        }
      }
      match = token.exec(bodyHtml);
      continue;
    }

    const tag = openTag.toLowerCase();
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(parseAttributes(rawAttributes))) {
      node.setAttribute(name, value);
    }
    stack[stack.length - 1].append(node);
    if (tag !== "script" && !VOID_TAGS.has(tag) && selfClosing !== "/") {
      stack.push(node);
    }
    match = token.exec(bodyHtml);
  }

  return document;
}

// ---------------------------------------------------------------------------
// 最小 fake 服务端：按 SPEC §5.2 契约响应，可注入失败与延迟。
// ---------------------------------------------------------------------------

const PRODUCT_SEEDS = [
  ["fuji-apple", "红富士苹果", "500g", 1299],
  ["banana", "海南香蕉", "1kg", 899],
  ["navel-orange", "赣南脐橙", "1kg", 1599],
  ["shine-muscat", "阳光玫瑰葡萄", "500g", 2999],
  ["golden-pineapple", "海南金钻凤梨", "1个", 1999],
  ["durian", "泰国金枕榴莲", "1kg", 4999],
  ["hami-melon", "新疆哈密瓜", "1个", 2599],
  ["peach", "山东水蜜桃", "500g", 1899],
  ["blueberry", "智利蓝莓", "125g", 2199],
  ["red-dragon-fruit", "云南红心火龙果", "1个", 1399],
  ["cherry", "智利车厘子", "500g", 3999],
  ["mango", "海南贵妃芒", "1kg", 2399],
  ["kiwi", "陕西徐香猕猴桃", "500g", 1699],
  ["strawberry", "辽宁丹东红颜草莓", "500g", 2899],
];

function defaultProducts() {
  return PRODUCT_SEEDS.map(([id, name, unit, unitPriceCents], index) => {
    const stock = id === "navel-orange" ? 0 : 20 + index;
    return {
      id,
      name,
      unit,
      unitPriceCents,
      stock,
      soldOut: stock === 0,
      listed: 1,
      image: `./assets/images/products/${id}.jpg`,
      alt: `${name} ${unit}`,
      description: `${name}，本地演示商品。`,
    };
  });
}

function makeOrderFixture(overrides = {}) {
  return {
    orderNumber: "FL-20261018-120000-A7K2",
    username: "userA",
    createdAt: "2026-10-18T04:00:00.000Z",
    currency: "CNY",
    subtotalCents: 1299,
    clientOrderId: "11111111-1111-4111-8111-111111111111",
    items: [
      {
        productId: "fuji-apple",
        name: "红富士苹果",
        unit: "500g",
        unitPriceCents: 1299,
        quantity: 1,
        lineTotalCents: 1299,
      },
    ],
    ...overrides,
  };
}

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  };
}

function emptyResponse(status) {
  return { ok: status >= 200 && status < 300, status, text: async () => "" };
}

function apiFailure(status, code) {
  return jsonResponse(status, { ok: false, code, message: code });
}

function createFakeServer(options = {}) {
  const server = {
    products: (options.products ?? defaultProducts()).map((product) => ({ ...product })),
    users: new Map(Object.entries(options.users ?? {
      userA: "password1",
      userB: "password2",
      admin: "adminpass",
    })),
    roles: new Map(Object.entries(options.roles ?? { admin: "admin" })),
    session: options.session ?? null,
    orders: (options.orders ?? []).map((order) => ({ ...order })),
    calls: [],
    errorFor: options.errorFor ?? null,
    before: null,
    throwOrderOnce: false,
    failOrderOnce: false,
    orderSeq: 0,
  };

  function orderNumber() {
    server.orderSeq += 1;
    return `FL-20261018-120000-A${String(server.orderSeq).padStart(3, "0")}`;
  }

  function buildOrder(body, session) {
    const items = body.items.map(({ productId, quantity }) => {
      const product = server.products.find((candidate) => candidate.id === productId);
      return {
        productId,
        name: product?.name ?? productId,
        unit: product?.unit ?? "",
        unitPriceCents: product?.unitPriceCents ?? 0,
        quantity,
        lineTotalCents: (product?.unitPriceCents ?? 0) * quantity,
      };
    });
    const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
    return {
      orderNumber: orderNumber(),
      clientOrderId: body.clientOrderId,
      username: session?.username ?? "",
      createdAt: `2026-10-18T04:00:0${server.orderSeq % 10}.000Z`,
      currency: "CNY",
      subtotalCents,
      items,
    };
  }

  function adminOnly() {
    return server.session?.role === "admin";
  }

  async function fetchImpl(url, init = {}) {
    const method = init.method ?? "GET";
    let body = null;
    if (typeof init.body === "string") body = JSON.parse(init.body);
    server.calls.push({
      url,
      method,
      body,
      credentials: init.credentials,
      headers: init.headers,
    });

    if (server.before) await server.before(url, method);
    if (server.errorFor) {
      const injected = server.errorFor(url, method);
      if (injected) return injected;
    }

    if (url === "/api/products" && method === "GET") {
      return jsonResponse(200, {
        ok: true,
        products: server.products
          .filter((product) => product.listed !== 0)
          .map((product) => ({ ...product })),
      });
    }

    if (url === "/api/auth/me" && method === "GET") {
      if (!server.session) return apiFailure(401, "auth-required");
      return jsonResponse(200, { ok: true, user: { ...server.session } });
    }

    if (url === "/api/auth/login" && method === "POST") {
      const { username, password } = body ?? {};
      if (server.users.get(username) === password) {
        server.session = { username, role: server.roles.get(username) ?? "user" };
        return jsonResponse(200, { ok: true, user: { ...server.session } });
      }
      return apiFailure(401, "auth-invalid-credentials");
    }

    if (url === "/api/auth/register" && method === "POST") {
      const { username, password } = body ?? {};
      if (server.users.has(username)) return apiFailure(409, "auth-username-taken");
      if (typeof password !== "string" || password.length < 8) {
        return apiFailure(400, "invalid-password");
      }
      server.users.set(username, password);
      return jsonResponse(201, { ok: true, user: { username, role: "user" } });
    }

    if (url === "/api/auth/logout" && method === "POST") {
      server.session = null;
      return emptyResponse(204);
    }

    if (url === "/api/orders" && method === "POST") {
      if (!server.session) return apiFailure(401, "auth-required");
      if (server.throwOrderOnce) {
        server.throwOrderOnce = false;
        throw new TypeError("fetch failed");
      }
      if (server.failOrderOnce) {
        server.failOrderOnce = false;
        server.orders.push(buildOrder(body, server.session));
        throw new TypeError("fetch failed");
      }
      if (server.errorForOrder) {
        const injected = server.errorForOrder(body);
        if (injected) return injected;
      }
      const order = buildOrder(body, server.session);
      server.orders.push(order);
      return jsonResponse(201, { ok: true, order });
    }

    if (url === "/api/orders/mine" && method === "GET") {
      if (!server.session) return apiFailure(401, "auth-required");
      return jsonResponse(200, {
        ok: true,
        orders: server.orders
          .filter((order) => order.username === server.session.username)
          .map((order) => ({ ...order })),
      });
    }

    const orderMatch = /^\/api\/orders\/([^/]+)$/.exec(url);
    if (orderMatch && method === "GET") {
      if (!server.session) return apiFailure(401, "auth-required");
      const target = decodeURIComponent(orderMatch[1]);
      const order = server.orders.find((candidate) => candidate.orderNumber === target);
      if (!order) return apiFailure(404, "order-not-found");
      if (order.username !== server.session.username && !adminOnly()) {
        return apiFailure(404, "order-not-found");
      }
      return jsonResponse(200, { ok: true, order: { ...order } });
    }

    if (url === "/api/admin/orders" && method === "GET") {
      if (!server.session) return apiFailure(401, "auth-required");
      if (!adminOnly()) return apiFailure(403, "auth-forbidden");
      return jsonResponse(200, {
        ok: true,
        orders: server.orders.map((order) => ({
          orderNumber: order.orderNumber,
          username: order.username,
          createdAt: order.createdAt,
          itemCount: Array.isArray(order.items) ? order.items.length : 0,
          subtotalCents: order.subtotalCents,
        })),
      });
    }

    if (url === "/api/admin/products" && method === "GET") {
      if (!server.session) return apiFailure(401, "auth-required");
      if (!adminOnly()) return apiFailure(403, "auth-forbidden");
      return jsonResponse(200, {
        ok: true,
        products: server.products.map((product) => ({ ...product })),
      });
    }

    const productMatch = /^\/api\/admin\/products\/([^/]+)$/.exec(url);
    if (productMatch && method === "PATCH") {
      if (!server.session) return apiFailure(401, "auth-required");
      if (!adminOnly()) return apiFailure(403, "auth-forbidden");
      const productId = decodeURIComponent(productMatch[1]);
      const product = server.products.find((candidate) => candidate.id === productId);
      if (!product) return apiFailure(404, "product-not-found");
      if (body && Object.hasOwn(body, "unitPriceCents")) {
        if (!Number.isInteger(body.unitPriceCents) || body.unitPriceCents < 0 || body.unitPriceCents > 9_999_999) {
          return apiFailure(400, "invalid-price");
        }
        product.unitPriceCents = body.unitPriceCents;
      }
      if (body && Object.hasOwn(body, "stock")) {
        if (!Number.isInteger(body.stock) || body.stock < 0 || body.stock > 99_999) {
          return apiFailure(400, "invalid-stock");
        }
        product.stock = body.stock;
        product.soldOut = body.stock === 0;
      }
      if (body && Object.hasOwn(body, "listed")) {
        if (body.listed !== 0 && body.listed !== 1) return apiFailure(400, "invalid-listed");
        product.listed = body.listed;
      }
      return jsonResponse(200, { ok: true, product: { ...product } });
    }

    return apiFailure(404, "not-found");
  }

  server.fetch = fetchImpl;
  return server;
}

function createDeferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function flush(times = 3) {
  let chain = Promise.resolve();
  for (let index = 0; index < times; index += 1) {
    chain = chain.then(() => new Promise((resolve) => setTimeout(resolve, 0)));
  }
  return chain;
}

let caseId = 0;

async function boot(options = {}) {
  const document = buildDocument();
  const server = createFakeServer(options);
  if (typeof options.prepare === "function") options.prepare(server);
  const window = {
    __fruitlabBooted: false,
    __fruitlabShowBootFailure() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
  const previous = new Map();
  const values = {
    document,
    window,
    fetch: server.fetch,
    requestAnimationFrame: (callback) => {
      callback();
      return 1;
    },
  };
  for (const [name, value] of Object.entries(values)) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  }

  caseId += 1;
  await import(`../assets/app.mjs?case=${caseId}`);
  if (options.settle !== false) await flush(3);

  const restore = () => {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  };
  return { document, server, restore, window };
}

function clicks(document, container, target) {
  container.dispatchEvent({ type: "click", target });
}

function orderPosts(server) {
  return server.calls.filter((call) => call.method === "POST" && call.url === "/api/orders");
}

// ---------------------------------------------------------------------------
// 商城与商品卡
// ---------------------------------------------------------------------------

test("catalog renders 14 local-photo cards, alt text, sold-out state, and status", async () => {
  const { document, restore } = await boot();
  try {
    const cards = document.querySelectorAll("[data-product]");
    assert.equal(cards.length, 14);
    assert.equal(document.getElementById("catalog").getAttribute("aria-busy"), "false");
    assert.match(document.getElementById("catalog-status").textContent, /14 种商品/);

    for (const card of cards) {
      const image = card.querySelector("img");
      assert.match(image.getAttribute("src"), /^\.\/assets\/images\/products\/[a-z0-9-]+\.jpg$/);
      assert.ok(image.getAttribute("alt").trim().length > 0);
      assert.ok(card.querySelector("[data-add]"));
    }

    const first = cards[0];
    assert.match(first.textContent, /红富士苹果/);
    assert.match(first.textContent, /500g/);
    assert.match(first.textContent, /¥12\.99/);
    assert.equal(first.querySelector("[data-add]").disabled, false);

    const soldOut = cards.find((card) => card.getAttribute("data-state") === "sold-out");
    assert.ok(soldOut);
    assert.match(soldOut.textContent, /已售罄/);
    assert.equal(soldOut.querySelector("[data-add]").disabled, true);
  } finally {
    restore();
  }
});

test("catalog shows loading skeletons, empty state, and a code-specific error with retry", async () => {
  const gate = createDeferred();
  const loading = await boot({
    settle: false,
    prepare(server) {
      server.before = async (url) => {
        if (url === "/api/products") await gate.promise;
      };
    },
  });
  try {
    assert.equal(loading.document.getElementById("catalog").getAttribute("aria-busy"), "true");
    assert.equal(loading.document.querySelectorAll("[data-skeleton]").length, 8);
    gate.resolve();
    await flush(3);
    assert.equal(loading.document.querySelectorAll("[data-product]").length, 14);
  } finally {
    loading.restore();
  }

  const empty = await boot({ products: [] });
  try {
    assert.equal(empty.document.querySelectorAll("[data-product]").length, 0);
    assert.match(empty.document.getElementById("catalog").textContent, /暂无可售商品/);
  } finally {
    empty.restore();
  }

  const failing = await boot({
    errorFor(url) {
      if (url === "/api/products") return apiFailure(503, "server-busy");
      return null;
    },
  });
  try {
    assert.match(failing.document.getElementById("catalog").textContent, /服务繁忙/);
    const retry = failing.document.querySelector("[data-retry='catalog']");
    assert.ok(retry);

    failing.server.errorFor = null;
    clicks(failing.document, failing.document.getElementById("catalog"), retry);
    await flush(3);
    assert.equal(failing.document.querySelectorAll("[data-product]").length, 14);
  } finally {
    failing.restore();
  }
});

// ---------------------------------------------------------------------------
// 购物袋与 R1 交互契约
// ---------------------------------------------------------------------------

test("adding to the bag renders line math, totals, and 1/99 boundary disabling", async () => {
  const { document, restore } = await boot();
  try {
    const addButton = document.querySelector("[data-add]");
    clicks(document, document.getElementById("catalog"), addButton);
    await flush(1);

    const line = document.querySelector('[data-cart-line="fuji-apple"]');
    assert.ok(line);
    assert.match(line.textContent, /¥12\.99 × 1 = ¥12\.99/);
    assert.equal(document.getElementById("cart-count").textContent, "1 件");
    assert.equal(document.getElementById("cart-total").textContent, "合计 ¥12.99");
    assert.equal(document.getElementById("mobile-cart-bar").hidden, false);
    assert.equal(document.getElementById("nav-cart-count").textContent, "1");

    const input = document.querySelector('[data-quantity="fuji-apple"]');
    input.value = "99";
    input.dispatchEvent({ type: "change" });
    assert.equal(document.getElementById("cart-count").textContent, "99 件");
    assert.equal(document.getElementById("cart-total").textContent, "合计 ¥1286.01");
    assert.equal(document.querySelector('[data-step="1"]').disabled, true);
    assert.equal(document.querySelector('[data-step="-1"]').disabled, false);

    input.value = "1";
    input.dispatchEvent({ type: "change" });
    assert.equal(document.getElementById("cart-count").textContent, "1 件");
    assert.equal(document.querySelector('[data-step="-1"]').disabled, true);
    assert.equal(document.querySelector('[data-step="1"]').disabled, false);
  } finally {
    restore();
  }
});

test("quantity change keeps the bag line node and reflects the new count", async () => {
  const { document, restore } = await boot();
  try {
    clicks(document, document.getElementById("catalog"), document.querySelector("[data-add]"));
    await flush(1);

    const line = document.querySelector('[data-cart-line="fuji-apple"]');
    const input = document.querySelector('[data-quantity="fuji-apple"]');
    input.value = "3";
    input.dispatchEvent({ type: "change" });
    input.dispatchEvent({ type: "blur" });

    assert.strictEqual(document.querySelector('[data-cart-line="fuji-apple"]'), line);
    assert.equal(document.getElementById("cart-count").textContent, "3 件");
    assert.equal(input.isConnected, true);

    input.value = "100";
    input.dispatchEvent({ type: "change" });
    const liveInput = document.querySelector('[data-quantity="fuji-apple"]');
    assert.ok(liveInput);
    assert.equal(liveInput.value, "99");
    assert.equal(liveInput.getAttribute("aria-invalid"), "true");
  } finally {
    restore();
  }
});

test("cart changes and new checkouts hide the previous receipt", async () => {
  const { document, restore } = await boot({ session: { username: "userA", role: "user" } });
  try {
    clicks(document, document.getElementById("catalog"), document.querySelector("[data-add]"));
    clicks(document, document.getElementById("checkout"));
    await flush(6);

    const success = document.getElementById("order-success");
    assert.equal(success.hidden, false);
    const receiptText = success.textContent;

    clicks(document, document.getElementById("catalog"), document.querySelector("[data-add]"));
    assert.equal(success.hidden, true);
    assert.equal(document.getElementById("cart-count").textContent, "1 件");

    clicks(document, document.getElementById("checkout"));
    assert.equal(success.hidden, true);

    await flush(6);
    assert.equal(success.hidden, false);
    assert.notEqual(success.textContent, receiptText);
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------------
// 结账
// ---------------------------------------------------------------------------

test("checkout without a session asks for login and never posts an order", async () => {
  const { document, server, restore } = await boot();
  try {
    clicks(document, document.getElementById("catalog"), document.querySelector("[data-add]"));
    clicks(document, document.getElementById("checkout"));
    await flush(2);

    assert.match(document.getElementById("checkout-message").textContent, /请先登录/);
    assert.equal(orderPosts(server).length, 0);
    assert.ok(document.getElementById("login-username").focusCount >= 1);
  } finally {
    restore();
  }
});

test("checkout posts items with a clientOrderId, disables the button while saving, and clears the bag", async () => {
  const gate = createDeferred();
  const { document, server, restore } = await boot({
    session: { username: "userA", role: "user" },
    prepare(fake) {
      fake.before = async (url, method) => {
        if (url === "/api/orders" && method === "POST") await gate.promise;
      };
    },
  });
  try {
    clicks(document, document.getElementById("catalog"), document.querySelector("[data-add]"));
    const checkout = document.getElementById("checkout");
    clicks(document, checkout);
    await flush(1);

    const posts = orderPosts(server);
    assert.equal(posts.length, 1);
    assert.equal(posts[0].credentials, "same-origin");
    assert.deepEqual(posts[0].body.items, [{ productId: "fuji-apple", quantity: 1 }]);
    assert.match(
      posts[0].body.clientOrderId,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    assert.equal(checkout.disabled, true);
    assert.match(checkout.textContent, /正在提交订单/);
    assert.equal(checkout.getAttribute("aria-busy"), "true");
    assert.match(document.getElementById("checkout-message").textContent, /正在提交订单/);

    gate.resolve();
    await flush(6);

    const success = document.getElementById("order-success");
    assert.equal(success.hidden, false);
    assert.match(success.textContent, /FL-20261018-120000-A001/);
    assert.match(success.textContent, /¥12\.99/);
    assert.equal(document.getElementById("cart-count").textContent, "0 件");
    assert.equal(document.getElementById("mobile-cart-bar").hidden, true);
    assert.equal(checkout.disabled, true);
  } finally {
    restore();
  }
});

test("checkout maps server error codes to specific copy and keeps the bag", async () => {
  const { document, server, restore } = await boot({
    session: { username: "userA", role: "user" },
    prepare(fake) {
      fake.errorForOrder = () => apiFailure(409, "insufficient-stock");
    },
  });
  try {
    clicks(document, document.getElementById("catalog"), document.querySelector("[data-add]"));
    clicks(document, document.getElementById("checkout"));
    await flush(4);

    const message = document.getElementById("checkout-message").textContent;
    assert.match(message, /库存不足，请减少数量后重试/);
    assert.equal(document.getElementById("cart-count").textContent, "1 件");
    assert.equal(document.getElementById("checkout").disabled, false);
    assert.equal(document.getElementById("order-success").hidden, true);

    await flush(4);
    assert.equal(orderPosts(server).length, 1, "a known failure must not retry automatically");
  } finally {
    restore();
  }
});

test("network failure freezes the bag as save-unknown and never retries automatically", async () => {
  const { document, server, restore } = await boot({
    session: { username: "userA", role: "user" },
    prepare(fake) {
      fake.throwOrderOnce = true;
    },
  });
  try {
    clicks(document, document.getElementById("catalog"), document.querySelector("[data-add]"));
    clicks(document, document.getElementById("checkout"));
    await flush(4);

    const message = document.getElementById("checkout-message").textContent;
    assert.match(message, /网络请求失败/);
    assert.match(message, /我的订单/);
    assert.equal(document.getElementById("checkout").disabled, true);
    assert.equal(document.querySelector("[data-add]").disabled, true);
    assert.equal(document.getElementById("unknown-actions").hidden, false);

    await flush(6);
    assert.equal(orderPosts(server).length, 1, "save-unknown must not retry automatically");

    const checkButton = document.querySelector("[data-unknown-action='check']");
    assert.ok(checkButton);
    checkButton.dispatchEvent({ type: "click" });
    await flush(3);

    const release = document.querySelector("[data-unknown-action='release']");
    assert.ok(release, "manual check must unlock an explicit release action");
    release.dispatchEvent({ type: "click" });
    assert.equal(document.getElementById("checkout").disabled, false);
    assert.match(document.getElementById("checkout-message").textContent, /已解除锁定/);
    assert.equal(document.querySelector("[data-add]").disabled, false);

    clicks(document, document.getElementById("checkout"));
    await flush(6);
    const posts = orderPosts(server);
    assert.equal(posts.length, 2);
    assert.equal(posts[1].body.clientOrderId, posts[0].body.clientOrderId);
    assert.equal(document.getElementById("order-success").hidden, false);
  } finally {
    restore();
  }
});

test("save-unknown resolves to saved when my orders contains the same clientOrderId", async () => {
  const { document, server, restore } = await boot({
    session: { username: "userA", role: "user" },
    prepare(fake) {
      fake.failOrderOnce = true;
    },
  });
  try {
    clicks(document, document.getElementById("catalog"), document.querySelector("[data-add]"));
    clicks(document, document.getElementById("checkout"));
    await flush(4);
    assert.equal(document.getElementById("unknown-actions").hidden, false);

    document
      .querySelector("[data-unknown-action='check']")
      .dispatchEvent({ type: "click" });
    await flush(4);

    assert.equal(document.getElementById("unknown-actions").hidden, true);
    assert.equal(document.getElementById("order-success").hidden, false);
    assert.equal(document.getElementById("cart-count").textContent, "0 件");
    assert.match(document.getElementById("order-success").textContent, /FL-20261018-120000-A001/);
    assert.equal(orderPosts(server).length, 1);
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------------
// 查订单
// ---------------------------------------------------------------------------

test("lookup requires a session", async () => {
  const { document, server, restore } = await boot();
  try {
    const input = document.getElementById("lookup-input");
    input.value = "FL-20261018-120000-A7K2";
    document.getElementById("lookup-form").dispatchEvent({ type: "submit" });
    await flush(2);

    assert.match(document.getElementById("lookup-message").textContent, /查订单需要登录/);
    assert.equal(
      server.calls.some((call) => call.url.startsWith("/api/orders/")),
      false,
    );
  } finally {
    restore();
  }
});

test("lookup rejects malformed order numbers with aria-invalid and no request", async () => {
  const { document, server, restore } = await boot({
    session: { username: "userA", role: "user" },
    orders: [makeOrderFixture()],
  });
  try {
    const form = document.getElementById("lookup-form");
    const input = document.getElementById("lookup-input");

    input.value = "FL-2026-A7K2";
    form.dispatchEvent({ type: "submit" });
    await flush(2);

    assert.equal(input.getAttribute("aria-invalid"), "true");
    assert.match(document.getElementById("lookup-input-error").textContent, /FL-YYYYMMDD-HHMMSS-XXXX/);
    assert.ok(input.getAttribute("aria-describedby").split(" ").includes("lookup-input-error"));
    assert.equal(document.getElementById("lookup-result").hidden, true);
    const orderLookups = () => server.calls.filter((call) => /^\/api\/orders\/[^/]+$/.test(call.url) && !call.url.endsWith("/mine")).length;
    assert.equal(orderLookups(), 0);
  } finally {
    restore();
  }
});

test("lookup finds an order, focuses the heading and clears stale results on input", async () => {
  const { document, server, restore } = await boot({
    session: { username: "userA", role: "user" },
    orders: [makeOrderFixture()],
  });
  try {
    const form = document.getElementById("lookup-form");
    const input = document.getElementById("lookup-input");

    input.value = "  fl-20261018-120000-a7k2  ";
    form.dispatchEvent({ type: "submit" });
    await flush(3);

    assert.equal(document.getElementById("lookup-result").hidden, false);
    assert.match(document.getElementById("lookup-message").textContent, /订单已找到/);
    assert.match(document.getElementById("lookup-result").textContent, /FL-20261018-120000-A7K2/);
    const heading = document.getElementById("lookup-result-title");
    assert.ok(heading);
    assert.equal(heading.focusCount, 1);

    const requested = server.calls.filter((call) => call.url === "/api/orders/FL-20261018-120000-A7K2");
    assert.equal(requested.length, 1);

    input.dispatchEvent({ type: "input" });
    assert.equal(document.getElementById("lookup-result").hidden, true);
    assert.equal(input.getAttribute("aria-invalid"), null);
  } finally {
    restore();
  }
});

test("lookup hides other users' orders with not-found copy", async () => {
  const { document, restore } = await boot({
    session: { username: "userA", role: "user" },
    orders: [makeOrderFixture({ orderNumber: "FL-20261018-120000-B7K2", username: "userB" })],
  });
  try {
    const input = document.getElementById("lookup-input");
    input.value = "FL-20261018-120000-B7K2";
    document.getElementById("lookup-form").dispatchEvent({ type: "submit" });
    await flush(3);

    assert.match(
      document.getElementById("lookup-message").textContent,
      /未找到该订单/,
    );
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------------
// 登录 / 注册
// ---------------------------------------------------------------------------

test("login shows submitting, maps bad credentials, and renders the authenticated session", async () => {
  const gate = createDeferred();
  const { document, server, restore } = await boot({
    prepare(fake) {
      fake.before = async (url, method) => {
        if (url === "/api/auth/login" && method === "POST") await gate.promise;
      };
    },
  });
  try {
    const submit = document.getElementById("login-submit");
    document.getElementById("login-username").value = "userA";
    document.getElementById("login-password").value = "wrong-pass";
    document.getElementById("login-form").dispatchEvent({ type: "submit" });
    await flush(1);

    assert.equal(submit.disabled, true);
    assert.match(submit.textContent, /正在登录/);
    assert.equal(submit.getAttribute("aria-busy"), "true");

    gate.resolve();
    await flush(4);
    assert.match(document.getElementById("login-message").textContent, /用户名或口令不正确/);
    assert.equal(submit.disabled, false);
    assert.equal(document.getElementById("auth-session").hidden, true);

    document.getElementById("login-password").value = "password1";
    document.getElementById("login-form").dispatchEvent({ type: "submit" });
    await flush(5);

    assert.equal(document.getElementById("auth-session").hidden, false);
    assert.equal(document.getElementById("session-user").textContent, "userA");
    assert.equal(document.getElementById("auth-forms").hidden, true);
    assert.equal(document.getElementById("nav-admin").hidden, true);
    assert.ok(server.calls.some((call) => call.url === "/api/orders/mine"));

    document.getElementById("logout-button").dispatchEvent({ type: "click" });
    await flush(3);
    assert.equal(document.getElementById("auth-session").hidden, true);
    assert.equal(document.getElementById("auth-forms").hidden, false);
  } finally {
    restore();
  }
});

test("register maps username conflicts and returns to login with guidance", async () => {
  const { document, restore } = await boot();
  try {
    const form = document.getElementById("register-form");
    document.getElementById("register-username").value = "userA";
    document.getElementById("register-password").value = "password1";
    form.dispatchEvent({ type: "submit" });
    await flush(3);
    assert.match(document.getElementById("register-message").textContent, /用户名已被占用/);

    document.getElementById("register-username").value = "newcomer";
    document.getElementById("register-password").value = "password123";
    form.dispatchEvent({ type: "submit" });
    await flush(4);

    assert.match(document.getElementById("auth-status").textContent, /注册成功/);
    assert.equal(document.getElementById("login-username").value, "newcomer");
    assert.equal(document.getElementById("auth-session").hidden, true);
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------------
// 我的订单与管理面板
// ---------------------------------------------------------------------------

test("my orders renders empty, list, and error states with retry", async () => {
  const empty = await boot({ session: { username: "userA", role: "user" }, orders: [] });
  try {
    assert.match(empty.document.getElementById("my-orders-status").textContent, /还没有订单/);
  } finally {
    empty.restore();
  }

  const listed = await boot({
    session: { username: "userA", role: "user" },
    orders: [makeOrderFixture(), makeOrderFixture({ orderNumber: "FL-20261018-120000-A003" })],
  });
  try {
    assert.equal(listed.document.querySelectorAll("[data-order-number]").length, 2);
    assert.match(listed.document.getElementById("my-orders-list").textContent, /FL-20261018-120000-A7K2/);
  } finally {
    listed.restore();
  }

  const failing = await boot({
    session: { username: "userA", role: "user" },
    errorFor(url) {
      if (url === "/api/orders/mine") return apiFailure(500, "internal-error");
      return null;
    },
  });
  try {
    assert.match(
      failing.document.getElementById("my-orders-status").textContent,
      /服务端内部错误/,
    );
    const retry = failing.document.querySelector("[data-retry='my-orders']");
    assert.ok(retry);

    failing.server.errorFor = null;
    clicks(failing.document, failing.document.getElementById("my-orders-list"), retry);
    await flush(4);
    assert.match(failing.document.getElementById("my-orders-status").textContent, /共 0 笔订单|还没有订单/);
  } finally {
    failing.restore();
  }
});

test("admin panels render orders and products including unlisted rows, and inline edits patch", async () => {
  const products = defaultProducts().map((product) => (
    product.id === "golden-pineapple" ? { ...product, listed: 0 } : product
  ));
  const { document, server, restore } = await boot({
    session: { username: "admin", role: "admin" },
    products,
    orders: [makeOrderFixture()],
  });
  try {
    assert.equal(document.getElementById("nav-admin").hidden, false);
    assert.equal(document.getElementById("admin").hidden, false);
    assert.equal(document.querySelectorAll("[data-admin-product]").length, 14);
    assert.match(document.getElementById("admin-orders-list").textContent, /userA/);

    const unlistedRow = document.querySelector('[data-admin-product="golden-pineapple"]');
    assert.equal(unlistedRow.getAttribute("data-state"), "unlisted");
    assert.match(unlistedRow.textContent, /已下架/);
    assert.match(unlistedRow.querySelector("[data-admin-toggle]").textContent, /上架/);

    const priceInput = document.querySelector('[data-admin-price="fuji-apple"]');
    priceInput.value = "1599";
    document
      .querySelector('[data-admin-save="fuji-apple"]')
      .dispatchEvent({ type: "click" });
    await flush(5);

    const patch = server.calls.find(
      (call) => call.method === "PATCH" && call.url === "/api/admin/products/fuji-apple",
    );
    assert.deepEqual(patch.body, { unitPriceCents: 1599 });
    assert.match(document.getElementById("admin-product-status-fuji-apple").textContent, /已保存/);
    assert.match(document.getElementById("catalog").textContent, /¥15\.99/);

    const beforeInvalid = server.calls.filter((call) => call.method === "PATCH").length;
    const freshPrice = document.querySelector('[data-admin-price="fuji-apple"]');
    freshPrice.value = "-1";
    document
      .querySelector('[data-admin-save="fuji-apple"]')
      .dispatchEvent({ type: "click" });
    await flush(2);
    assert.equal(freshPrice.getAttribute("aria-invalid"), "true");
    assert.match(
      document.getElementById("admin-product-status-fuji-apple").textContent,
      /价格需为 0 到 9999999 的整数/,
    );
    assert.equal(server.calls.filter((call) => call.method === "PATCH").length, beforeInvalid);

    document
      .querySelector('[data-admin-toggle="golden-pineapple"]')
      .dispatchEvent({ type: "click" });
    await flush(5);
    const togglePatch = server.calls.find(
      (call) => call.method === "PATCH" && call.url === "/api/admin/products/golden-pineapple",
    );
    assert.deepEqual(togglePatch.body, { listed: 1 });
    assert.equal(
      document.querySelector('[data-admin-product="golden-pineapple"]').getAttribute("data-state"),
      "normal",
    );
    assert.match(document.getElementById("catalog").textContent, /海南金钻凤梨/);
  } finally {
    restore();
  }
});

test("admin panel surfaces load errors with the mapped copy and a retry action", async () => {
  const { document, restore } = await boot({
    session: { username: "admin", role: "admin" },
    errorFor(url) {
      if (url === "/api/admin/orders") return apiFailure(403, "auth-forbidden");
      return null;
    },
  });
  try {
    assert.match(
      document.getElementById("admin-orders-status").textContent,
      /当前账号没有该操作权限/,
    );
    assert.ok(document.querySelector("[data-retry='admin-orders']"));
    assert.equal(document.getElementById("admin-products-status").textContent.includes("共 14 种"), true);
  } finally {
    restore();
  }
});
