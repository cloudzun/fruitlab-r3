import test from "node:test";
import assert from "node:assert/strict";

const QUANTITY_ERROR = "数量必须是 1-99 的整数";
const QUOTA_MESSAGE =
  "订单未保存，请重试。本地订单存储空间已满，请先导出并检查现有订单数据。";
const REQUIRED_IDS = [
  "boot-status",
  "catalog",
  "cart",
  "cart-lines",
  "cart-count",
  "cart-total",
  "cart-live",
  "checkout",
  "checkout-message",
  "unknown-actions",
  "storage-notice",
  "order-success",
  "lookup-form",
  "lookup-input",
  "lookup-submit",
  "lookup-message",
  "lookup-result",
  "mobile-cart-bar",
  "mobile-cart-count",
  "mobile-cart-total",
];
const SELECTOR_PATTERN = /^\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\]$/;

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    for (const name of names) this.values.add(name);
  }

  contains(name) {
    return this.values.has(name);
  }

  toggle(name, force) {
    const enabled = force === undefined ? !this.values.has(name) : Boolean(force);
    if (enabled) this.values.add(name);
    else this.values.delete(name);
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
    this.classList = new FakeClassList();
    this.className = "";
    this.id = "";
    this.textContent = "";
    this.hidden = false;
    this.disabled = false;
    this.focusCount = 0;
    this.selectCount = 0;
    this.replaceCount = 0;
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
    this.append(...nodes);
  }

  setAttribute(name, value) {
    const text = String(value);
    this.attributes.set(name, text);
    if (name === "id") this.id = text;
    if (name.startsWith("data-")) {
      const key = name
        .slice("data-".length)
        .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[key] = text;
    }
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name.startsWith("data-")) {
      const key = name
        .slice("data-".length)
        .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      delete this.dataset[key];
    }
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatchEvent(event) {
    const payload = {
      ...event,
      target: event.target ?? this,
      currentTarget: this,
    };
    for (const listener of this.listeners.get(payload.type) ?? []) {
      listener(payload);
    }
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
    return findDescendant(this.body, (node) => node.id === id);
  }

  querySelector(selector) {
    return this.body.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  }
}

class FakeStorage {
  constructor() {
    this.value = null;
    this.throwSet = false;
  }

  getItem() {
    return this.value;
  }

  setItem(_key, value) {
    if (this.throwSet) {
      const error = new Error("quota exceeded");
      error.name = "QuotaExceededError";
      throw error;
    }
    this.value = value;
  }
}

function matchesSelector(node, selector) {
  const match = SELECTOR_PATTERN.exec(selector);
  if (!match) throw new Error(`unsupported selector: ${selector}`);
  const [, name, expected] = match;
  if (!node.attributes.has(name)) return false;
  return expected === undefined || node.attributes.get(name) === expected;
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

function createEnvironment() {
  const document = new FakeDocument();
  const storage = new FakeStorage();
  const window = {
    localStorage: storage,
    matchMedia: () => ({ matches: false }),
    __fruitlabShowBootFailure() {},
  };

  for (const id of REQUIRED_IDS) {
    const node = document.createElement("div");
    node.id = id;
    document.body.append(node);
  }

  return { document, storage, window };
}

function installGlobals(environment) {
  const values = {
    document: environment.document,
    window: environment.window,
    requestAnimationFrame: (callback) => {
      callback();
      return 1;
    },
  };
  const previous = new Map();

  for (const [name, value] of Object.entries(values)) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  }

  return () => {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  };
}

async function bootApp(environment, caseId) {
  const restore = installGlobals(environment);
  await import(`../assets/app.mjs?coverage=${caseId}`);
  return restore;
}

test("quantity blur preserves the cart DOM until the quantity actually changes", { concurrency: false }, async () => {
  // Value: protects=quantity blur with the same value skips redraw so the next quantity click survives; fails_when=the unchanged early return is removed or commitQuantity calls renderCart; why_new=existing tests cover parsing and source text, not the app event boundary; seam=none; no_claim=browser-native focus/select or actual click ordering (minimal DOM fake)
  const environment = createEnvironment();
  const restore = installGlobals(environment);

  try {
    await import("../assets/app.mjs?coverage=d2");
    const { document } = environment;
    const catalog = document.getElementById("catalog");
    const cartLines = document.getElementById("cart-lines");
    const cartCount = document.getElementById("cart-count");
    const cartLive = document.getElementById("cart-live");

    const addButton = document.querySelectorAll("[data-add]")[0];
    assert.ok(addButton);
    catalog.dispatchEvent({ type: "click", target: addButton });

    const firstInput = document.querySelector('[data-quantity="fuji-apple"]');
    assert.ok(firstInput);
    assert.equal(firstInput.id, "quantity-fuji-apple");
    assert.equal(firstInput.getAttribute("name"), "quantity-fuji-apple");
    const afterAddRedraws = cartLines.replaceCount;

    firstInput.value = "1";
    firstInput.dispatchEvent({ type: "change" });
    firstInput.dispatchEvent({ type: "blur" });

    assert.equal(cartLines.replaceCount, afterAddRedraws);
    assert.equal(firstInput.isConnected, true);
    assert.strictEqual(document.querySelector('[data-quantity="fuji-apple"]'), firstInput);
    assert.equal(firstInput.getAttribute("aria-invalid"), "false");
    assert.equal(document.getElementById("quantity-error-fuji-apple").textContent, "");
    assert.match(cartLive.textContent, /数量已更新为 1/);

    const plusButton = findDescendant(
      cartLines,
      (node) => node.dataset.step === "1" && node.dataset.fruitId === "fuji-apple",
    );
    assert.ok(plusButton);
    assert.equal(plusButton.isConnected, true);
    cartLines.dispatchEvent({ type: "click", target: plusButton });
    assert.equal(cartCount.textContent, "2 件");

    const secondInput = document.querySelector('[data-quantity="fuji-apple"]');
    assert.ok(secondInput);
    const afterStepRedraws = cartLines.replaceCount;
    secondInput.value = "3";
    secondInput.dispatchEvent({ type: "change" });

    assert.equal(cartLines.replaceCount, afterStepRedraws + 1);
    assert.equal(secondInput.isConnected, false);
    const thirdInput = document.querySelector('[data-quantity="fuji-apple"]');
    assert.notStrictEqual(thirdInput, secondInput);
    assert.equal(thirdInput.value, "3");
    assert.equal(thirdInput.getAttribute("aria-invalid"), null);

    const afterChangeRedraws = cartLines.replaceCount;
    thirdInput.value = "100";
    thirdInput.dispatchEvent({ type: "change" });

    assert.equal(cartLines.replaceCount, afterChangeRedraws + 1);
    assert.equal(thirdInput.isConnected, false);
    const clampedInput = document.querySelector('[data-quantity="fuji-apple"]');
    assert.ok(clampedInput);
    assert.equal(clampedInput.value, "99");
    assert.equal(clampedInput.getAttribute("aria-invalid"), "true");
    assert.equal(clampedInput.focusCount, 1);
    assert.equal(clampedInput.selectCount, 1);
    const errorNode = document.getElementById("quantity-error-fuji-apple");
    assert.equal(errorNode.textContent, QUANTITY_ERROR);
    assert.equal(errorNode.getAttribute("role"), "alert");

    const beforeUnchangedErrorRedraws = cartLines.replaceCount;
    clampedInput.value = "0";
    clampedInput.dispatchEvent({ type: "change" });

    assert.equal(cartLines.replaceCount, beforeUnchangedErrorRedraws);
    assert.equal(clampedInput.isConnected, true);
    assert.strictEqual(document.querySelector('[data-quantity="fuji-apple"]'), clampedInput);
    assert.equal(clampedInput.value, "99");
    assert.equal(clampedInput.focusCount, 2);
    assert.equal(clampedInput.selectCount, 2);
    assert.equal(cartCount.textContent, "99 件");
    assert.equal(cartLive.textContent, QUANTITY_ERROR);
  } finally {
    restore();
  }
});

test("quota checkout failure shows code-specific copy without clearing the cart", { concurrency: false }, async () => {
  // Value: protects=quota checkout failure shows exact recovery copy and keeps cart/success state; fails_when=the code wiring or quota copy regresses, or a failed save clears the cart; why_new=only the message mapper is unit-tested, not the app checkout event flow; seam=none; no_claim=real browser localStorage quota behavior (fake storage, module integration only)
  const environment = createEnvironment();
  const restore = installGlobals(environment);

  try {
    await import("../assets/app.mjs?coverage=d3");
    const { document, storage } = environment;
    const catalog = document.getElementById("catalog");
    const checkout = document.getElementById("checkout");
    const checkoutMessage = document.getElementById("checkout-message");
    const success = document.getElementById("order-success");
    const cartCount = document.getElementById("cart-count");
    const cartLive = document.getElementById("cart-live");

    const addButton = document.querySelectorAll("[data-add]")[0];
    assert.ok(addButton);
    catalog.dispatchEvent({ type: "click", target: addButton });
    assert.equal(cartCount.textContent, "1 件");

    storage.throwSet = true;
    checkout.dispatchEvent({ type: "click" });
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.equal(checkoutMessage.textContent, QUOTA_MESSAGE);
    assert.equal(checkoutMessage.classList.contains("is-error"), true);
    assert.equal(cartLive.textContent, QUOTA_MESSAGE);
    assert.equal(success.hidden, true);
    assert.equal(cartCount.textContent, "1 件");
    assert.equal(checkout.disabled, false);
    assert.equal(document.querySelector('[data-quantity="fuji-apple"]').isConnected, true);
  } finally {
    restore();
  }
});
