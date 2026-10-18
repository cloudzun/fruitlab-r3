import test from "node:test";
import assert from "node:assert/strict";

import {
  adminProductsReducer,
  authReducer,
  cartSubtotalCents,
  catalogReducer,
  checkoutReducer,
  createAdminProductsState,
  createAuthState,
  createCatalogState,
  createCartItems,
  createCheckoutState,
  createLookupState,
  createOrderItems,
  createOrdersListState,
  findOrderByClientOrderId,
  isAdmin,
  isAuthenticated,
  isCartFrozen,
  isCheckoutBusy,
  isPurchasable,
  lookupReducer,
  ordersListReducer,
  parseQuantityUpdate,
  productCardState,
} from "../assets/controller.mjs";

const QUANTITY_ERROR = "数量必须是 1-99 的整数";

function productsById() {
  return new Map([
    ["fuji-apple", { id: "fuji-apple", name: "红富士苹果", unit: "500g", unitPriceCents: 1299, stock: 5 }],
    ["banana", { id: "banana", name: "海南香蕉", unit: "1kg", unitPriceCents: 899, stock: 0 }],
  ]);
}

test("parseQuantityUpdate keeps R1 semantics: unchanged values do not redraw", () => {
  assert.deepEqual(parseQuantityUpdate("2", 2), { quantity: 2, error: "", changed: false });
  assert.deepEqual(parseQuantityUpdate("02", 2), { quantity: 2, error: "", changed: false });
  assert.deepEqual(parseQuantityUpdate("3", 2), { quantity: 3, error: "", changed: true });
  assert.deepEqual(parseQuantityUpdate("100", 99), {
    quantity: 99,
    error: QUANTITY_ERROR,
    changed: false,
  });
  assert.deepEqual(parseQuantityUpdate("abc", 2), {
    quantity: 2,
    error: QUANTITY_ERROR,
    changed: false,
  });
});

test("productCardState covers normal, sold-out, and unlisted cards", () => {
  assert.equal(productCardState({ id: "a", stock: 3, listed: 1 }), "normal");
  assert.equal(productCardState({ id: "a", stock: 0, listed: 1 }), "sold-out");
  assert.equal(productCardState({ id: "a", stock: 3, soldOut: true, listed: 1 }), "sold-out");
  assert.equal(productCardState({ id: "a", stock: 3, listed: 0 }), "unlisted");
  assert.equal(productCardState({ id: "a", stock: 3, listed: false }), "unlisted");
  assert.equal(productCardState(null), "unlisted");
  assert.equal(isPurchasable({ id: "a", stock: 1, listed: 1 }), true);
  assert.equal(isPurchasable({ id: "a", stock: 0, listed: 1 }), false);
});

test("catalogReducer exposes loading, ready, empty, and error states", () => {
  assert.deepEqual(createCatalogState(), { status: "loading", products: [], code: null });

  const ready = catalogReducer(createCatalogState(), {
    type: "CATALOG_LOADED",
    products: [{ id: "fuji-apple" }],
  });
  assert.equal(ready.status, "ready");
  assert.equal(ready.products.length, 1);

  const empty = catalogReducer(ready, { type: "CATALOG_LOADED", products: [] });
  assert.equal(empty.status, "empty");

  const failed = catalogReducer(createCatalogState(), {
    type: "CATALOG_FAILED",
    code: "server-busy",
  });
  assert.equal(failed.status, "error");
  assert.equal(failed.code, "server-busy");
});

test("cart items use integer cents, product snapshots, and reject invalid carts", () => {
  const cart = new Map([
    ["fuji-apple", 2],
    ["banana", 1],
  ]);
  const items = createCartItems(cart, productsById());
  assert.deepEqual(
    items.map(({ productId, quantity, lineTotalCents }) => [productId, quantity, lineTotalCents]),
    [["fuji-apple", 2, 2598], ["banana", 1, 899]],
  );
  assert.equal(Object.isFrozen(items), true);
  assert.equal(Object.isFrozen(items[0]), true);
  assert.equal(cartSubtotalCents(cart, productsById()), 3497);

  const orderItems = createOrderItems(cart, productsById());
  assert.deepEqual(orderItems.map((item) => ({ ...item })), [
    { productId: "fuji-apple", quantity: 2 },
    { productId: "banana", quantity: 1 },
  ]);

  assert.throws(() => createCartItems(new Map([["missing", 1]]), productsById()), TypeError);
  assert.throws(() => createCartItems(new Map([["fuji-apple", 100]]), productsById()), TypeError);
});

test("checkout reducer freezes save-unknown and never retries automatically", () => {
  assert.deepEqual(createCheckoutState(), {
    status: "idle",
    frozen: false,
    code: null,
    clientOrderId: null,
    attemptedItems: null,
    receipt: null,
    orderNumber: null,
  });

  const saving = checkoutReducer(createCheckoutState(), {
    type: "CHECKOUT_STARTED",
    clientOrderId: "11111111-1111-4111-8111-111111111111",
    items: [{ productId: "fuji-apple", quantity: 1 }],
  });
  assert.equal(saving.status, "saving");
  assert.equal(isCheckoutBusy(saving), true);
  assert.equal(isCartFrozen(saving), false);

  const unknown = checkoutReducer(saving, {
    type: "CHECKOUT_SAVE_UNKNOWN",
    code: "network-error",
  });
  assert.equal(unknown.status, "save-unknown");
  assert.equal(unknown.frozen, true);
  assert.equal(unknown.clientOrderId, saving.clientOrderId);
  assert.equal(isCartFrozen(unknown), true);
  assert.equal(isCheckoutBusy(unknown), true);

  const afterCartChange = checkoutReducer(unknown, { type: "CART_CHANGED" });
  assert.equal(afterCartChange, unknown, "frozen state must survive cart edits");

  const released = checkoutReducer(unknown, { type: "SAVE_UNKNOWN_RESOLVED_ABSENT" });
  assert.equal(released.status, "idle");
  assert.equal(released.code, "save-unknown-absent");
  assert.equal(released.clientOrderId, saving.clientOrderId);
  assert.equal(isCartFrozen(released), false);
  assert.equal(isCheckoutBusy(released), false);
});

test("checkout reducer drops stale receipts on cart changes and saves receipts on success", () => {
  const order = { orderNumber: "FL-20261018-120000-A7K2", items: [] };
  const saved = checkoutReducer(
    checkoutReducer(createCheckoutState(), { type: "CHECKOUT_STARTED", clientOrderId: "id" }),
    { type: "CHECKOUT_SAVED", order },
  );
  assert.equal(saved.status, "saved");
  assert.equal(saved.receipt, order);

  const changed = checkoutReducer(saved, { type: "CART_CHANGED" });
  assert.equal(changed.status, "idle");
  assert.equal(changed.receipt, null);
});

test("findOrderByClientOrderId only matches an explicit clientOrderId", () => {
  const orders = [
    { orderNumber: "FL-20261018-120000-AAAA", clientOrderId: "abc" },
    { orderNumber: "FL-20261018-120000-BBBB" },
  ];
  assert.equal(findOrderByClientOrderId(orders, "abc")?.orderNumber, "FL-20261018-120000-AAAA");
  assert.equal(findOrderByClientOrderId(orders, "zzz"), null);
  assert.equal(findOrderByClientOrderId(orders, ""), null);
  assert.equal(findOrderByClientOrderId(null, "abc"), null);
});

test("auth reducer covers anonymous, submitting, failure, and authenticated states", () => {
  assert.deepEqual(createAuthState(), {
    status: "anonymous",
    mode: null,
    user: null,
    code: null,
  });

  const submitting = authReducer(createAuthState(), { type: "AUTH_SUBMITTED", mode: "login" });
  assert.equal(submitting.status, "submitting");
  assert.equal(submitting.mode, "login");

  const failed = authReducer(submitting, {
    type: "AUTH_FAILED",
    code: "auth-invalid-credentials",
    mode: "login",
  });
  assert.equal(failed.status, "error");
  assert.equal(failed.code, "auth-invalid-credentials");

  const user = { username: "admin", role: "admin" };
  const loggedIn = authReducer(failed, { type: "AUTH_LOGGED_IN", user });
  assert.equal(loggedIn.status, "authenticated");
  assert.equal(isAuthenticated(loggedIn), true);
  assert.equal(isAdmin(loggedIn), true);

  assert.equal(authReducer(loggedIn, { type: "AUTH_LOGGED_OUT" }).status, "anonymous");
  assert.equal(authReducer(loggedIn, { type: "SESSION_LOADED", user: null }).status, "anonymous");
});

test("lookup reducer clears stale results on input and distinguishes not-found", () => {
  const found = lookupReducer(createLookupState(), {
    type: "LOOKUP_FOUND",
    order: { orderNumber: "FL-20261018-120000-A7K2" },
  });
  assert.equal(found.status, "found");
  assert.equal(found.orderNumber, "FL-20261018-120000-A7K2");

  assert.deepEqual(lookupReducer(found, { type: "INPUT_CHANGED" }), createLookupState());

  const notFound = lookupReducer(found, {
    type: "LOOKUP_FAILED",
    code: "order-not-found",
    orderNumber: "FL-20261018-120000-ZZZZ",
  });
  assert.equal(notFound.status, "not-found");
  assert.equal(notFound.order, null);

  const forbidden = lookupReducer(found, { type: "LOOKUP_FAILED", code: "order-not-owned" });
  assert.equal(forbidden.status, "error");
  assert.equal(forbidden.code, "order-not-owned");

  const submitting = lookupReducer(createLookupState(), { type: "LOOKUP_STARTED", orderNumber: "x" });
  assert.equal(submitting.status, "submitting");
});

test("orders list reducer models loading, ready, empty, and error states", () => {
  assert.deepEqual(createOrdersListState(), { status: "idle", orders: [], code: null });

  const loading = ordersListReducer(createOrdersListState(), { type: "ORDERS_LOADING" });
  assert.equal(loading.status, "loading");

  const ready = ordersListReducer(loading, {
    type: "ORDERS_LOADED",
    orders: [{ orderNumber: "FL-20261018-120000-A7K2" }],
  });
  assert.equal(ready.status, "ready");
  assert.equal(ready.orders.length, 1);

  const empty = ordersListReducer(ready, { type: "ORDERS_LOADED", orders: [] });
  assert.equal(empty.status, "empty");

  const failed = ordersListReducer(loading, { type: "ORDERS_FAILED", code: "server-busy" });
  assert.equal(failed.status, "error");
  assert.equal(failed.code, "server-busy");
});

test("admin products reducer replaces rows, tracks saving, and exposes row errors", () => {
  assert.deepEqual(createAdminProductsState(), {
    status: "idle",
    products: [],
    code: null,
    savingId: null,
    rowCode: null,
  });

  const loaded = adminProductsReducer(createAdminProductsState(), {
    type: "ADMIN_PRODUCTS_LOADED",
    products: [
      { id: "fuji-apple", unitPriceCents: 1299, stock: 3, listed: 1 },
      { id: "durian", unitPriceCents: 4999, stock: 0, listed: 0 },
    ],
  });
  assert.equal(loaded.status, "ready");
  assert.equal(loaded.products.length, 2);

  const saving = adminProductsReducer(loaded, { type: "PRODUCT_SAVING", productId: "fuji-apple" });
  assert.equal(saving.savingId, "fuji-apple");

  const saved = adminProductsReducer(saving, {
    type: "PRODUCT_SAVED",
    product: { id: "fuji-apple", unitPriceCents: 1399, stock: 3, listed: 1 },
  });
  assert.equal(saved.savingId, null);
  assert.equal(saved.products.find((product) => product.id === "fuji-apple").unitPriceCents, 1399);
  assert.equal(saved.products.find((product) => product.id === "durian").listed, 0);

  const failed = adminProductsReducer(saving, {
    type: "PRODUCT_SAVE_FAILED",
    productId: "fuji-apple",
    code: "invalid-price",
  });
  assert.equal(failed.savingId, null);
  assert.equal(failed.rowCode, "invalid-price");

  assert.equal(
    adminProductsReducer(loaded, { type: "ADMIN_PRODUCTS_LOADED", products: [] }).status,
    "empty",
  );
  assert.equal(
    adminProductsReducer(loaded, { type: "ADMIN_PRODUCTS_FAILED", code: "server-busy" }).status,
    "error",
  );
});
