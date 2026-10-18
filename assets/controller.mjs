// FruitLab R2 控制器：纯 reducer 与纯派生函数，不依赖 DOM、fetch 或存储。
// R1 的 checkout/lookup reducer 语义保留（saving、not-written、save-unknown 冻结、
// 输入即清结果），并按 R2 增加登录态、商品目录、我的订单与管理端两面板状态。
import { lineTotalCents, parseQuantity, subtotalCents } from "./domain.mjs";

const QUANTITY_BOUND_MIN = 1;
const QUANTITY_BOUND_MAX = 99;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isQuantity(value) {
  return Number.isInteger(value) && value >= QUANTITY_BOUND_MIN && value <= QUANTITY_BOUND_MAX;
}

export function parseQuantityUpdate(raw, previousQuantity) {
  const parsed = parseQuantity(raw, previousQuantity);
  return {
    ...parsed,
    changed: parsed.quantity !== previousQuantity,
  };
}

// ---------------------------------------------------------------------------
// 商品目录与商品卡状态
// ---------------------------------------------------------------------------

// 商品卡六态：normal / sold-out / unlisted 由数据决定；
// loading / empty / error 由目录 reducer 决定，渲染层负责对应骨架与提示。
export function productCardState(product) {
  if (!product) return "unlisted";
  if (product.listed === 0 || product.listed === false) return "unlisted";
  if (product.soldOut === true) return "sold-out";
  const stock = Number(product.stock);
  if (Number.isFinite(stock) && stock <= 0) return "sold-out";
  return "normal";
}

export function isPurchasable(product) {
  return productCardState(product) === "normal";
}

export function createCatalogState() {
  return Object.freeze({
    status: "loading",
    products: Object.freeze([]),
    code: null,
  });
}

export function catalogReducer(state, event) {
  switch (event.type) {
    case "CATALOG_LOADING":
      return createCatalogState();
    case "CATALOG_LOADED": {
      const products = Object.freeze(
        Array.isArray(event.products) ? event.products.filter(isPlainObject) : [],
      );
      return Object.freeze({
        status: products.length === 0 ? "empty" : "ready",
        products,
        code: null,
      });
    }
    case "CATALOG_FAILED":
      return Object.freeze({
        status: "error",
        products: Object.freeze([]),
        code: event.code ?? "internal-error",
      });
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// 购物袋与结账
// ---------------------------------------------------------------------------

export function createCartItems(cart, productsById) {
  if (!(cart instanceof Map)) {
    throw new TypeError("createCartItems requires a Map");
  }
  if (!(productsById instanceof Map)) {
    throw new TypeError("createCartItems requires a product Map");
  }

  const items = [];
  for (const [productId, quantity] of cart) {
    const product = productsById.get(productId);
    if (!isPlainObject(product)) {
      throw new TypeError(`unknown product: ${productId}`);
    }
    if (!isQuantity(quantity)) {
      throw new TypeError(`invalid quantity for ${productId}`);
    }
    if (!Number.isSafeInteger(product.unitPriceCents) || product.unitPriceCents <= 0) {
      throw new TypeError(`invalid price for ${productId}`);
    }
    items.push(Object.freeze({
      productId,
      name: typeof product.name === "string" ? product.name : productId,
      unit: typeof product.unit === "string" ? product.unit : "",
      unitPriceCents: product.unitPriceCents,
      quantity,
      lineTotalCents: lineTotalCents(product.unitPriceCents, quantity),
    }));
  }
  return Object.freeze(items);
}

export function createOrderItems(cart, productsById) {
  return Object.freeze(
    createCartItems(cart, productsById).map(({ productId, quantity }) =>
      Object.freeze({ productId, quantity })),
  );
}

export function cartSubtotalCents(cart, productsById) {
  if (!(cart instanceof Map) || cart.size === 0) return 0;
  return subtotalCents(createCartItems(cart, productsById));
}

export function createCheckoutState() {
  return Object.freeze({
    status: "idle", // idle | saving | not-written | save-unknown | saved
    frozen: false,
    code: null,
    clientOrderId: null,
    attemptedItems: null,
    receipt: null,
    orderNumber: null,
  });
}

export function isCartFrozen(state) {
  return Boolean(state?.frozen || state?.status === "save-unknown");
}

export function isCheckoutBusy(state) {
  return Boolean(state && (state.status === "saving" || isCartFrozen(state)));
}

export function checkoutReducer(state, event) {
  switch (event.type) {
    case "CART_CHANGED":
      if (state.status === "saving" || isCartFrozen(state)) return state;
      return createCheckoutState();
    case "CHECKOUT_STARTED":
      if (state.status === "saving" || isCartFrozen(state)) return state;
      return Object.freeze({
        ...createCheckoutState(),
        status: "saving",
        clientOrderId: event.clientOrderId ?? state.clientOrderId ?? null,
        attemptedItems: Object.freeze(
          Array.isArray(event.items) ? event.items.map((item) => Object.freeze({ ...item })) : [],
        ),
      });
    case "CHECKOUT_SAVED":
      if (state.status !== "saving") return state;
      return Object.freeze({
        ...createCheckoutState(),
        status: "saved",
        code: "order-saved",
        receipt: event.order ?? null,
        orderNumber: event.order?.orderNumber ?? null,
      });
    case "CHECKOUT_FAILED":
      if (state.status !== "saving") return state;
      return Object.freeze({
        ...createCheckoutState(),
        status: "not-written",
        code: event.code ?? "internal-error",
        clientOrderId: state.clientOrderId,
        attemptedItems: state.attemptedItems,
      });
    case "CHECKOUT_SAVE_UNKNOWN":
      if (state.status !== "saving") return state;
      return Object.freeze({
        ...createCheckoutState(),
        status: "save-unknown",
        frozen: true,
        code: event.code ?? "network-error",
        clientOrderId: state.clientOrderId,
        attemptedItems: state.attemptedItems,
      });
    case "SAVE_UNKNOWN_RESOLVED_SAVED":
      if (state.status !== "save-unknown") return state;
      return Object.freeze({
        ...createCheckoutState(),
        status: "saved",
        code: "order-saved",
        receipt: event.order ?? null,
        orderNumber: event.order?.orderNumber ?? null,
      });
    case "SAVE_UNKNOWN_RESOLVED_ABSENT":
      if (state.status !== "save-unknown") return state;
      return Object.freeze({
        ...createCheckoutState(),
        status: "idle",
        code: "save-unknown-absent",
        clientOrderId: state.clientOrderId,
        attemptedItems: state.attemptedItems,
      });
    default:
      return state;
  }
}

// save-unknown 的人工核对只认同一个 clientOrderId；服务端订单摘要若不含该字段，
// 返回 null，调用方只能提示人工核对，不得自动判定为未生成。
export function findOrderByClientOrderId(orders, clientOrderId) {
  if (!Array.isArray(orders) || typeof clientOrderId !== "string" || clientOrderId === "") {
    return null;
  }
  return orders.find((order) => isPlainObject(order) && order.clientOrderId === clientOrderId) ?? null;
}

// ---------------------------------------------------------------------------
// 登录态
// ---------------------------------------------------------------------------

export function createAuthState() {
  return Object.freeze({
    status: "anonymous", // anonymous | submitting | error | authenticated
    mode: null, // login | register
    user: null,
    code: null,
  });
}

export function authReducer(state, event) {
  switch (event.type) {
    case "SESSION_LOADED":
      if (!event.user) return createAuthState();
      return Object.freeze({
        status: "authenticated",
        mode: null,
        user: event.user,
        code: null,
      });
    case "AUTH_SUBMITTED":
      if (state.status === "submitting") return state;
      return Object.freeze({
        ...createAuthState(),
        status: "submitting",
        mode: event.mode ?? "login",
      });
    case "AUTH_FAILED":
      if (state.status !== "submitting") return state;
      return Object.freeze({
        status: "error",
        mode: event.mode ?? state.mode,
        user: null,
        code: event.code ?? "internal-error",
      });
    case "AUTH_LOGGED_IN":
      if (!event.user) return state;
      return Object.freeze({
        status: "authenticated",
        mode: null,
        user: event.user,
        code: null,
      });
    case "AUTH_LOGGED_OUT":
      return createAuthState();
    case "AUTH_CLEAR_ERROR":
      if (state.status !== "error") return state;
      return createAuthState();
    default:
      return state;
  }
}

export function isAuthenticated(state) {
  return state?.status === "authenticated" && isPlainObject(state.user);
}

export function isAdmin(state) {
  return isAuthenticated(state) && state.user.role === "admin";
}

// ---------------------------------------------------------------------------
// 查订单
// ---------------------------------------------------------------------------

export function createLookupState() {
  return Object.freeze({
    status: "idle", // idle | submitting | found | not-found | error
    code: null,
    order: null,
    orderNumber: null,
  });
}

export function lookupReducer(state, event) {
  switch (event.type) {
    case "INPUT_CHANGED":
      return createLookupState();
    case "LOOKUP_STARTED":
      return Object.freeze({
        status: "submitting",
        code: null,
        order: null,
        orderNumber: event.orderNumber ?? null,
      });
    case "LOOKUP_FOUND":
      return Object.freeze({
        status: "found",
        code: "order-found",
        order: event.order ?? null,
        orderNumber: event.order?.orderNumber ?? event.orderNumber ?? null,
      });
    case "LOOKUP_FAILED":
      return Object.freeze({
        status: event.code === "order-not-found" ? "not-found" : "error",
        code: event.code ?? "internal-error",
        order: null,
        orderNumber: event.orderNumber ?? null,
      });
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// 订单列表（我的订单 / 管理端全部订单）
// ---------------------------------------------------------------------------

export function createOrdersListState() {
  return Object.freeze({
    status: "idle", // idle | loading | ready | empty | error
    orders: Object.freeze([]),
    code: null,
  });
}

export function ordersListReducer(state, event) {
  switch (event.type) {
    case "ORDERS_LOADING":
      return Object.freeze({ status: "loading", orders: Object.freeze([]), code: null });
    case "ORDERS_LOADED": {
      const orders = Object.freeze(
        Array.isArray(event.orders) ? event.orders.filter(isPlainObject) : [],
      );
      return Object.freeze({
        status: orders.length === 0 ? "empty" : "ready",
        orders,
        code: null,
      });
    }
    case "ORDERS_FAILED":
      return Object.freeze({
        status: "error",
        orders: Object.freeze([]),
        code: event.code ?? "internal-error",
      });
    case "ORDERS_RESET":
      return createOrdersListState();
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// 管理端商品面板
// ---------------------------------------------------------------------------

export function createAdminProductsState() {
  return Object.freeze({
    status: "idle", // idle | loading | ready | empty | error
    products: Object.freeze([]),
    code: null,
    savingId: null,
    rowCode: null,
  });
}

export function adminProductsReducer(state, event) {
  switch (event.type) {
    case "ADMIN_PRODUCTS_LOADING":
      return Object.freeze({
        status: "loading",
        products: Object.freeze([]),
        code: null,
        savingId: null,
        rowCode: null,
      });
    case "ADMIN_PRODUCTS_LOADED": {
      const products = Object.freeze(
        Array.isArray(event.products) ? event.products.filter(isPlainObject) : [],
      );
      return Object.freeze({
        status: products.length === 0 ? "empty" : "ready",
        products,
        code: null,
        savingId: null,
        rowCode: null,
      });
    }
    case "ADMIN_PRODUCTS_FAILED":
      return Object.freeze({
        status: "error",
        products: Object.freeze([]),
        code: event.code ?? "internal-error",
        savingId: null,
        rowCode: null,
      });
    case "PRODUCT_SAVING":
      return Object.freeze({
        ...state,
        savingId: event.productId ?? null,
        rowCode: null,
      });
    case "PRODUCT_SAVED": {
      const product = isPlainObject(event.product) ? event.product : null;
      if (!product) return Object.freeze({ ...state, savingId: null });
      const next = state.products.map((item) => (item.id === product.id ? product : item));
      return Object.freeze({
        status: next.length === 0 ? "empty" : "ready",
        products: Object.freeze(next),
        code: null,
        savingId: null,
        rowCode: null,
      });
    }
    case "PRODUCT_SAVE_FAILED":
      return Object.freeze({
        ...state,
        savingId: null,
        rowCode: event.code ?? "internal-error",
      });
    case "ADMIN_PRODUCTS_RESET":
      return createAdminProductsState();
    default:
      return state;
  }
}
