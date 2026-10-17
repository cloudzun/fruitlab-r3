import test from "node:test";
import assert from "node:assert/strict";

import {
  checkoutNotWrittenMessage,
  checkoutReducer,
  createCheckoutState,
  createCartItems,
  createLookupState,
  isCartFrozen,
  lookupReducer,
  parseQuantityUpdate,
  performLookup,
  resolveUnknownCheckout,
  runCheckout,
} from "../assets/controller.mjs";
import { ORDER_KEY } from "../assets/order-store.mjs";
import { catalogById } from "../assets/catalog.mjs";

const NOW = new Date("2026-10-17T05:15:00.000Z");
const ORDER_NUMBER = "FL-20261017-131500-A7K2";

function makeCart() {
  return new Map([
    ["fuji-apple", 2],
    ["banana", 1],
  ]);
}

function makeOrder(overrides = {}) {
  return {
    orderNumber: ORDER_NUMBER,
    createdAt: NOW.toISOString(),
    currency: "CNY",
    subtotalCents: 3497,
    items: [
      {
        fruitId: "fuji-apple",
        name: "红富士苹果",
        unit: "500g",
        unitPriceCents: 1299,
        quantity: 2,
        lineTotalCents: 2598,
      },
      {
        fruitId: "banana",
        name: "海南香蕉",
        unit: "1kg",
        unitPriceCents: 899,
        quantity: 1,
        lineTotalCents: 899,
      },
    ],
    ...overrides,
  };
}

class FakeStorage {
  constructor(value = null) {
    this.value = value;
    this.getCount = 0;
    this.writeCount = 0;
    this.throwGet = false;
    this.throwSet = false;
    this.throwReadback = false;
    this.staleReadback = false;
  }

  getItem(key) {
    assert.equal(key, ORDER_KEY);
    this.getCount += 1;
    if (this.throwGet) throw new Error("blocked");
    if (this.throwReadback && this.writeCount > 0) throw new Error("readback blocked");
    if (this.staleReadback && this.writeCount > 0) return this.staleValue;
    return this.value;
  }

  setItem(key, value) {
    assert.equal(key, ORDER_KEY);
    if (this.throwSet) throw new Error("quota");
    if (this.staleReadback) this.staleValue = this.value;
    this.value = value;
    this.writeCount += 1;
  }
}

test("createCartItems builds frozen catalog snapshots in insertion order", () => {
  const items = createCartItems(makeCart(), catalogById);
  assert.deepEqual(items.map(({ fruitId, quantity, lineTotalCents }) => [fruitId, quantity, lineTotalCents]), [
    ["fuji-apple", 2, 2598],
    ["banana", 1, 899],
  ]);
  assert.equal(Object.isFrozen(items), true);
  assert.equal(Object.isFrozen(items[0]), true);
});

test("parseQuantityUpdate marks only actual quantity changes for redraw", () => {
  assert.deepEqual(parseQuantityUpdate("2", 2), { quantity: 2, error: "", changed: false });
  assert.deepEqual(parseQuantityUpdate("02", 2), { quantity: 2, error: "", changed: false });
  assert.deepEqual(parseQuantityUpdate("3", 2), { quantity: 3, error: "", changed: true });
  assert.deepEqual(parseQuantityUpdate("100", 99), {
    quantity: 99,
    error: "数量必须是 1-99 的整数",
    changed: false,
  });
  assert.deepEqual(parseQuantityUpdate("abc", 2), {
    quantity: 2,
    error: "数量必须是 1-99 的整数",
    changed: false,
  });
});

test("checkoutNotWrittenMessage maps storage failures to specific recovery copy", () => {
  // Value: protects=checkout not-written copy is exact for every storage failure code; fails_when=a recovery sentence or code mapping changes; why_new=the existing test only matched fragments, so partial copy regressions passed; seam=none; no_claim=none beyond protects
  const messages = {
    "storage-unavailable": "订单未保存，请重试。本地订单存储不可用，请检查站点数据权限后重试。",
    "storage-security-blocked": "订单未保存，请重试。浏览器阻止了本地订单存储，请允许本站使用站点数据后刷新。",
    "storage-quota-exceeded": "订单未保存，请重试。本地订单存储空间已满，请先导出并检查现有订单数据。",
    "storage-read-failed": "订单未保存，请重试。本地订单数据不是文本，无法读取，原始值未被修改。",
    "storage-write-failed": "订单未保存，请重试。请检查浏览器存储权限和可用空间后重试。",
  };

  for (const [code, message] of Object.entries(messages)) {
    assert.equal(checkoutNotWrittenMessage(code), message);
  }
  assert.equal(checkoutNotWrittenMessage("unexpected-code"), "订单未保存，请重试");
});

test("checkout and lookup factories expose the frozen initial state", () => {
  assert.deepEqual(createCheckoutState(), {
    status: "idle",
    frozen: false,
    code: null,
    orderNumber: null,
    attemptedOrder: null,
    receipt: null,
  });
  assert.deepEqual(createLookupState(), {
    status: "idle",
    code: null,
    order: null,
    orderNumber: null,
    invalidCount: 0,
    duplicateNumbers: [],
  });
});

test("lookupReducer replaces results and clears stale results on input", () => {
  const found = lookupReducer(createLookupState(), {
    type: "LOOKUP_RESULT",
    status: "found",
    code: "lookup-found",
    order: makeOrder(),
    orderNumber: ORDER_NUMBER,
  });
  assert.equal(found.status, "found");
  assert.equal(found.order.orderNumber, ORDER_NUMBER);
  assert.deepEqual(lookupReducer(found, { type: "INPUT_CHANGED" }), createLookupState());
});

test("checkout reducer freezes save-unknown and ignores cart mutation while frozen", () => {
  const unknown = checkoutReducer(
    createCheckoutState(),
    { type: "CHECKOUT_SAVE_UNKNOWN", order: makeOrder(), code: "storage-readback-mismatch" },
  );
  assert.equal(unknown.status, "save-unknown");
  assert.equal(isCartFrozen(unknown), true);

  const afterMutation = checkoutReducer(unknown, { type: "CART_CHANGED" });
  assert.equal(afterMutation, unknown);
});

test("checkout reducer invalidates a saved receipt on cart mutation", () => {
  const saved = checkoutReducer(
    createCheckoutState(),
    { type: "CHECKOUT_SAVED", order: makeOrder() },
  );
  assert.equal(saved.status, "saved");
  const changed = checkoutReducer(saved, { type: "CART_CHANGED" });
  assert.equal(changed.status, "idle");
  assert.equal(changed.receipt, null);
});

test("runCheckout saves a valid order and returns the exact saved snapshot", () => {
  const storage = new FakeStorage(null);
  const result = runCheckout({
    cart: makeCart(),
    catalogById,
    storage,
    now: NOW,
    suffixFactory: () => "A7K2",
  });

  assert.equal(result.status, "saved");
  assert.deepEqual(result.order, makeOrder());
  assert.equal(result.state.status, "saved");
  assert.equal(storage.value.endsWith(`${JSON.stringify(makeOrder())}\n`), true);
});

test("runCheckout refuses an empty cart before touching storage", () => {
  const storage = new FakeStorage(null);
  const result = runCheckout({
    cart: new Map(),
    catalogById,
    storage,
    now: NOW,
    suffixFactory: () => "A7K2",
  });

  assert.equal(result.status, "empty-cart");
  assert.equal(storage.getCount, 0);
  assert.equal(storage.writeCount, 0);
});

test("runCheckout maps setItem failure to not-written and keeps cart state editable", () => {
  const storage = new FakeStorage(null);
  storage.throwSet = true;
  const result = runCheckout({
    cart: makeCart(),
    catalogById,
    storage,
    now: NOW,
    suffixFactory: () => "A7K2",
  });

  assert.equal(result.status, "not-written");
  assert.equal(result.code, "storage-write-failed");
  assert.equal(isCartFrozen(result.state), false);
});

test("runCheckout freezes a save-unknown attempt with its order number", () => {
  const storage = new FakeStorage(null);
  storage.staleReadback = true;
  const result = runCheckout({
    cart: makeCart(),
    catalogById,
    storage,
    now: NOW,
    suffixFactory: () => "A7K2",
  });

  assert.equal(result.status, "save-unknown");
  assert.equal(result.state.orderNumber, ORDER_NUMBER);
  assert.deepEqual(result.state.attemptedOrder, makeOrder());
  assert.equal(isCartFrozen(result.state), true);
});

test("runCheckout reports number exhaustion without writing", () => {
  const taken = Array.from({ length: 10 }, (_, index) => ({
    ...makeOrder(),
    orderNumber: `FL-20261017-131500-A00${index}`,
  }));
  const storage = new FakeStorage(taken.map((order) => JSON.stringify(order)).join("\n"));
  let calls = 0;
  const result = runCheckout({
    cart: makeCart(),
    catalogById,
    storage,
    now: NOW,
    suffixFactory: () => `A00${calls++}`,
  });

  assert.equal(result.status, "number-generation-failed");
  assert.equal(calls, 10);
  assert.equal(storage.writeCount, 0);
});

test("resolveUnknownCheckout finds an exact saved order and clears the frozen state", () => {
  const storage = new FakeStorage(null);
  storage.staleReadback = true;
  const unknownResult = runCheckout({
    cart: makeCart(),
    catalogById,
    storage,
    now: NOW,
    suffixFactory: () => "A7K2",
  });
  storage.staleReadback = false;

  const resolved = resolveUnknownCheckout({ state: unknownResult.state, storage });
  assert.equal(resolved.status, "saved");
  assert.equal(resolved.state.status, "saved");
  assert.equal(isCartFrozen(resolved.state), false);
});

test("resolveUnknownCheckout permits retry only after clean absence is proven", () => {
  const storage = new FakeStorage(null);
  storage.staleReadback = true;
  const unknownResult = runCheckout({
    cart: makeCart(),
    catalogById,
    storage,
    now: NOW,
    suffixFactory: () => "A7K2",
  });
  storage.staleReadback = false;
  storage.value = "";

  const resolved = resolveUnknownCheckout({ state: unknownResult.state, storage });
  assert.equal(resolved.status, "absent");
  assert.equal(resolved.state.status, "idle");
  assert.equal(isCartFrozen(resolved.state), false);
});

test("resolveUnknownCheckout stays frozen for corrupt, duplicate, unavailable, and mismatched data", () => {
  const initial = checkoutReducer(
    createCheckoutState(),
    { type: "CHECKOUT_SAVE_UNKNOWN", order: makeOrder(), code: "storage-readback-mismatch" },
  );

  const corruptStorage = new FakeStorage("{bad line");
  assert.equal(resolveUnknownCheckout({ state: initial, storage: corruptStorage }).status, "inconclusive");
  assert.equal(isCartFrozen(resolveUnknownCheckout({ state: initial, storage: corruptStorage }).state), true);

  const duplicateStorage = new FakeStorage(
    [JSON.stringify(makeOrder()), JSON.stringify(makeOrder())].join("\n"),
  );
  assert.equal(resolveUnknownCheckout({ state: initial, storage: duplicateStorage }).status, "duplicate");
  assert.equal(isCartFrozen(resolveUnknownCheckout({ state: initial, storage: duplicateStorage }).state), true);

  const unavailableStorage = new FakeStorage(null);
  unavailableStorage.throwGet = true;
  assert.equal(resolveUnknownCheckout({ state: initial, storage: unavailableStorage }).status, "unavailable");

  const different = makeOrder({ subtotalCents: 1299, items: [makeOrder().items[0]] });
  const mismatchStorage = new FakeStorage(JSON.stringify(different));
  assert.equal(resolveUnknownCheckout({ state: initial, storage: mismatchStorage }).status, "inconclusive");
});

test("performLookup returns malformed and empty states before storage access", () => {
  const storage = new FakeStorage(null);
  assert.equal(performLookup({ input: "", storage }).status, "empty");
  assert.equal(performLookup({ input: "FL-2026-A7K2", storage }).status, "malformed");
  assert.equal(storage.getCount, 0);
});

test("performLookup covers found, not-found, corrupt, duplicate, and unavailable states", () => {
  const order = makeOrder();
  const foundStorage = new FakeStorage(`${JSON.stringify(order)}\n{bad`);
  const found = performLookup({ input: `  ${ORDER_NUMBER.toLowerCase()}  `, storage: foundStorage });
  assert.equal(found.status, "found");
  assert.equal(found.invalidCount, 1);
  assert.equal(found.order.orderNumber, ORDER_NUMBER);

  const missing = performLookup({
    input: "FL-20261017-131500-ZZZZ",
    storage: new FakeStorage(JSON.stringify(order)),
  });
  assert.equal(missing.status, "not-found");

  const duplicateStorage = new FakeStorage(
    [JSON.stringify(order), JSON.stringify(order)].join("\n"),
  );
  assert.equal(performLookup({ input: ORDER_NUMBER, storage: duplicateStorage }).status, "duplicate");

  const unavailable = new FakeStorage(null);
  unavailable.throwGet = true;
  assert.equal(performLookup({ input: ORDER_NUMBER, storage: unavailable }).status, "unavailable");
});
