// FruitLab R2 前端入口：渲染、事件与异步编排。
// 约束：零构建、零依赖；不使用 HTML 注入 API；网络只经 api-client；
// 所有动态文本用 textContent/DOM 节点生成。
import {
  ApiError,
  UNKNOWN_RESULT_CODES,
  apiErrorMessage,
  createApiClient,
} from "./api-client.mjs";
import {
  adminProductsReducer,
  authReducer,
  cartSubtotalCents,
  catalogReducer,
  checkoutReducer,
  createAdminProductsState,
  createAuthState,
  createCatalogState,
  createCheckoutState,
  createLookupState,
  createOrderItems,
  createOrdersListState,
  findOrderByClientOrderId,
  isAuthenticated,
  isCartFrozen,
  isCheckoutBusy,
  isPurchasable,
  lookupReducer,
  ordersListReducer,
  parseQuantityUpdate,
  productCardState,
} from "./controller.mjs";
import { formatCny, isOrderNumberFormat, normalizeOrderNumber } from "./domain.mjs";

const COPY = Object.freeze({
  catalogLoading: "正在加载商品…",
  catalogEmpty: "暂无可售商品。",
  catalogErrorTitle: "商品没能加载",
  catalogRetry: "重新加载",
  bagEmpty: "购物袋是空的。",
  bagLocked: "提交结果未确认，暂时不能修改购物袋。",
  bagSaving: "正在提交订单，购物袋暂时锁定。",
  addSoldOut: "已售罄，无法加入购物袋。",
  addLimit: "已达到单件商品 99 件上限。",
  checkoutLoginRequired: "结账前请先登录。",
  checkoutEmpty: "购物袋是空的，无法结账。",
  checkoutInvalid: "购物袋数据不完整，请刷新页面后重试。",
  checkoutSaving: "正在提交订单…",
  checkoutSaved: "订单已提交。",
  unknownResult: "提交结果未确认。",
  unknownHint: "请先到「我的订单」核对本次订单；确认没有生成前不要重复结账。",
  unknownCheckedAbsent: "已核对「我的订单」：没有找到本次请求编号对应的订单。确认未生成后可解除锁定。",
  unknownReleased: "已解除锁定；再次结账会沿用同一请求编号。",
  lookupLoginRequired: "查订单需要登录。",
  lookupIdle: "登录后输入订单号查询自己的订单。",
  lookupIdleReady: "输入订单号查询自己的订单。",
  lookupEmpty: "请输入订单号。",
  lookupMalformed: "订单号格式不正确，应为 FL-YYYYMMDD-HHMMSS-XXXX。",
  lookupSubmitting: "正在查询…",
  lookupFound: "订单已找到。",
  lookupNotFound: "未找到该订单。",
  lookupResult: "查询结果",
  lookupResultTitle: "订单详情",
  myOrdersAnonymous: "登录后查看我的订单。",
  myOrdersLoading: "正在加载我的订单…",
  myOrdersEmpty: "还没有订单。",
  myOrdersErrorTitle: "我的订单加载失败",
  myOrdersIdle: "点「刷新」加载我的订单。",
  adminOrdersLoading: "正在加载全部订单…",
  adminOrdersEmpty: "暂无订单。",
  adminOrdersErrorTitle: "全部订单加载失败",
  adminProductsLoading: "正在加载商品…",
  adminProductsEmpty: "暂无商品。",
  adminProductsErrorTitle: "商品加载失败",
  adminProductsIdle: "点「刷新」加载全部商品（含已下架）。",
  adminIdle: "管理面板已就绪。",
  retry: "重试",
  refresh: "刷新",
  saved: "已保存。",
  noChanges: "没有需要保存的修改。",
  loginSubmitting: "正在登录…",
  registerSubmitting: "正在注册…",
  login: "登录",
  register: "注册",
  registerSaved: "注册成功，请用同一用户名登录。",
  loginMissing: "请输入用户名和口令。",
  logoutFailed: "退出请求未成功，本地登录状态已清除；刷新页面后可能仍为登录状态。",
  logoutSaved: "已退出登录。",
});

const state = {
  catalog: createCatalogState(),
  cart: new Map(),
  checkout: createCheckoutState(),
  auth: createAuthState(),
  lookup: createLookupState(),
  myOrders: createOrdersListState(),
  adminOrders: createOrdersListState(),
  adminProducts: createAdminProductsState(),
  formMessages: { login: "", register: "" },
  authNotice: "",
  unknownChecked: false,
  unknownMatchFound: false,
};

const api = createApiClient();
let refs = {};
let lineRefs = new Map();
let lastProductFeedbackId = "";

function byId(id) {
  return document.getElementById(id);
}

function el(tagName, options = {}, children = []) {
  const node = document.createElement(tagName);
  if (options.className) node.className = options.className;
  if (options.id) node.id = options.id;
  if (options.text !== undefined) node.textContent = String(options.text);
  if (options.attrs) {
    for (const [name, value] of Object.entries(options.attrs)) {
      if (value === false || value === null || value === undefined) continue;
      node.setAttribute(name, value === true ? "" : String(value));
    }
  }
  if (options.props) Object.assign(node, options.props);
  const usable = children.filter((child) => child !== null && child !== undefined && child !== false);
  if (usable.length > 0) node.append(...usable);
  return node;
}

function setStatusLine(node, text, { error = false, success = false } = {}) {
  node.textContent = text ?? "";
  node.classList.toggle("is-error", Boolean(error));
  node.classList.toggle("is-success", Boolean(success));
}

function setCartLive(text) {
  refs.cartLive.textContent = text;
}

function formatMoney(cents) {
  return Number.isSafeInteger(cents) && cents >= 0 ? formatCny(cents) : "—";
}

function formatTimestamp(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "时间未知";
  const pad = (value) => String(value).padStart(2, "0");
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}（本地时间）`,
  ].join(" ");
}

function codeOf(error) {
  return error instanceof ApiError ? error.code : "network-error";
}

function isUnknownResult(code) {
  return UNKNOWN_RESULT_CODES.includes(code);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function productMap() {
  return new Map(state.catalog.products.map((product) => [product.id, product]));
}

function findProduct(productId) {
  return state.catalog.products.find((product) => product.id === productId) ?? null;
}

function cartCount() {
  let count = 0;
  for (const quantity of state.cart.values()) count += quantity;
  return count;
}

function cartSubtotal() {
  if (state.cart.size === 0) return 0;
  try {
    return cartSubtotalCents(state.cart, productMap());
  } catch {
    return 0;
  }
}

const REF_IDS = Object.freeze({
  bootStatus: "boot-status",
  catalog: "catalog",
  catalogStatus: "catalog-status",
  cart: "cart",
  cartLines: "cart-lines",
  cartCount: "cart-count",
  cartTotal: "cart-total",
  checkout: "checkout",
  checkoutMessage: "checkout-message",
  unknownActions: "unknown-actions",
  cartLive: "cart-live",
  mobileBar: "mobile-cart-bar",
  mobileCartCount: "mobile-cart-count",
  mobileCartTotal: "mobile-cart-total",
  navCartCount: "nav-cart-count",
  navAdmin: "nav-admin",
  navMyOrders: "nav-my-orders",
  success: "order-success",
  lookupForm: "lookup-form",
  lookupInput: "lookup-input",
  lookupSubmit: "lookup-submit",
  lookupMessage: "lookup-message",
  lookupInputError: "lookup-input-error",
  lookupResult: "lookup-result",
  myOrders: "my-orders",
  myOrdersRefresh: "my-orders-refresh",
  myOrdersStatus: "my-orders-status",
  myOrdersList: "my-orders-list",
  auth: "auth",
  authStatus: "auth-status",
  authSession: "auth-session",
  sessionUser: "session-user",
  sessionRole: "session-role",
  authForms: "auth-forms",
  loginForm: "login-form",
  loginUsername: "login-username",
  loginPassword: "login-password",
  loginSubmit: "login-submit",
  loginMessage: "login-message",
  registerForm: "register-form",
  registerUsername: "register-username",
  registerPassword: "register-password",
  registerSubmit: "register-submit",
  registerMessage: "register-message",
  logoutButton: "logout-button",
  admin: "admin",
  adminStatus: "admin-status",
  adminOrdersRefresh: "admin-orders-refresh",
  adminOrdersStatus: "admin-orders-status",
  adminOrdersList: "admin-orders-list",
  adminProductsRefresh: "admin-products-refresh",
  adminProductsStatus: "admin-products-status",
  adminProductsList: "admin-products-list",
});

function cacheRefs() {
  const missing = [];
  const next = {};
  for (const [key, id] of Object.entries(REF_IDS)) {
    const node = byId(id);
    if (!node) missing.push(`${key} (#${id})`);
    else next[key] = node;
  }
  if (missing.length > 0) {
    throw new Error(`页面缺少必要节点：${missing.join(", ")}`);
  }
  refs = next;
}

// ---------------------------------------------------------------------------
// 商品目录（六态：加载 / 空 / 错误 / 正常 / 售罄 / 下架）
// ---------------------------------------------------------------------------

function skeletonCard(index) {
  return el("article", {
    className: "product-card is-skeleton",
    attrs: { "aria-hidden": "true", "data-skeleton": String(index) },
  }, [
    el("div", { className: "product-photo" }),
    el("div", { className: "product-body" }, [
      el("p", { className: "product-name", text: "正在加载" }),
      el("p", { className: "product-unit", text: " " }),
      el("p", { className: "product-price", text: " " }),
    ]),
  ]);
}

function productCard(product) {
  const cardState = productCardState(product);
  const soldOut = cardState === "sold-out";
  const unlisted = cardState === "unlisted";
  const disabled = soldOut || unlisted;
  const feedbackId = `product-feedback-${product.id}`;
  const image = el("img", {
    attrs: {
      src: `./assets/images/products/${product.id}.jpg`,
      alt: typeof product.alt === "string" && product.alt.trim() !== ""
        ? product.alt
        : `${product.name} ${product.unit}`,
      width: "800",
      height: "800",
      loading: "lazy",
      decoding: "async",
    },
  });

  const nodes = [
    el("div", { className: "product-photo" }, [image]),
    el("div", { className: "product-body" }, [
      el("h3", { className: "product-name", text: product.name }),
      el("p", { className: "product-unit", text: product.unit }),
      el("p", { className: "product-price", text: formatMoney(product.unitPriceCents) }),
      soldOut ? el("p", { className: "product-state", text: "已售罄" }) : null,
      unlisted ? el("p", { className: "product-state", text: "已下架" }) : null,
      el("button", {
        className: "button button-primary product-add",
        text: soldOut ? "已售罄" : "加入购物袋",
        attrs: {
          type: "button",
          "data-add": product.id,
          "aria-describedby": feedbackId,
          "aria-label": disabled ? `${product.name} ${soldOut ? "已售罄" : "已下架"}` : `将${product.name}加入购物袋`,
        },
        props: { disabled },
      }),
      el("p", {
        id: feedbackId,
        className: "product-feedback",
        attrs: { "aria-live": "polite" },
      }),
    ]),
  ];

  return el("article", {
    className: `product-card is-${cardState}`,
    attrs: { "data-product": product.id, "data-state": cardState },
  }, nodes);
}

function renderCatalog() {
  const current = state.catalog;
  refs.catalog.setAttribute("aria-busy", current.status === "loading" ? "true" : "false");

  if (current.status === "loading") {
    refs.catalog.replaceChildren(...Array.from({ length: 8 }, (_, index) => skeletonCard(index)));
    setStatusLine(refs.catalogStatus, COPY.catalogLoading);
    return;
  }

  if (current.status === "empty") {
    refs.catalog.replaceChildren(el("p", { className: "empty-state", text: COPY.catalogEmpty }));
    setStatusLine(refs.catalogStatus, COPY.catalogEmpty);
    return;
  }

  if (current.status === "error") {
    const retry = el("button", {
      className: "button button-secondary",
      text: COPY.catalogRetry,
      attrs: { type: "button", "data-retry": "catalog" },
    });
    refs.catalog.replaceChildren(el("div", { className: "empty-state" }, [
      el("p", { text: COPY.catalogErrorTitle }),
      el("p", { className: "field-error", text: apiErrorMessage(current.code) }),
      retry,
    ]));
    setStatusLine(refs.catalogStatus, `${COPY.catalogErrorTitle}：${apiErrorMessage(current.code)}`, { error: true });
    return;
  }

  const visible = current.products.filter((product) => productCardState(product) !== "unlisted");
  refs.catalog.replaceChildren(...visible.map(productCard));
  setStatusLine(refs.catalogStatus, visible.length === 0 ? COPY.catalogEmpty : `共 ${visible.length} 种商品。`);
}

async function loadProducts() {
  state.catalog = catalogReducer(state.catalog, { type: "CATALOG_LOADING" });
  renderCatalog();
  try {
    const payload = await api.products();
    const products = Array.isArray(payload.products) ? payload.products.filter(isObject) : [];
    state.catalog = catalogReducer(state.catalog, { type: "CATALOG_LOADED", products });
    reconcileCartWithCatalog();
  } catch (error) {
    state.catalog = catalogReducer(state.catalog, { type: "CATALOG_FAILED", code: codeOf(error) });
  }
  renderCatalog();
  syncAddButtons();
  renderBootStatus();
}

function renderBootStatus() {
  const current = state.catalog;
  if (current.status === "ready") {
    setStatusLine(refs.bootStatus, `商品已就绪：${current.products.length} 种。`);
  } else if (current.status === "empty") {
    setStatusLine(refs.bootStatus, COPY.catalogEmpty);
  } else if (current.status === "error") {
    setStatusLine(refs.bootStatus, `商品加载失败：${apiErrorMessage(current.code)}`, { error: true });
  } else {
    setStatusLine(refs.bootStatus, COPY.catalogLoading);
  }
}

function syncAddButtons() {
  const busy = isCheckoutBusy(state.checkout);
  for (const button of document.querySelectorAll("[data-add]")) {
    const product = findProduct(button.dataset.add);
    button.disabled = busy || !product || !isPurchasable(product);
  }
}

function reconcileCartWithCatalog() {
  const products = productMap();
  let removed = 0;
  for (const productId of [...state.cart.keys()]) {
    if (!products.has(productId)) {
      state.cart.delete(productId);
      removed += 1;
    }
  }
  if (removed === 0) return;
  state.checkout = checkoutReducer(state.checkout, { type: "CART_CHANGED" });
  renderCart();
  renderCheckoutMessage();
  renderSuccess();
  setCartLive(`有 ${removed} 种商品已下架，已从购物袋移除。`);
}

// ---------------------------------------------------------------------------
// 购物袋
// ---------------------------------------------------------------------------

function createBagLine(product, quantity) {
  const busy = isCheckoutBusy(state.checkout);
  const errorId = `quantity-error-${product.id}`;
  const lineTotal = product.unitPriceCents * quantity;

  const minus = el("button", {
    className: "step-button",
    text: "−",
    attrs: {
      type: "button",
      "aria-label": `减少${product.name}数量`,
      "data-step": "-1",
      "data-step-product": product.id,
    },
    props: { disabled: busy || quantity <= 1 },
  });

  const input = el("input", {
    id: `quantity-${product.id}`,
    className: "quantity-input",
    attrs: {
      type: "number",
      name: `quantity-${product.id}`,
      min: "1",
      max: "99",
      step: "1",
      inputmode: "numeric",
      "aria-label": `${product.name}数量`,
      "aria-describedby": errorId,
      "data-quantity": product.id,
    },
    props: { value: String(quantity), disabled: busy },
  });

  const plus = el("button", {
    className: "step-button",
    text: "+",
    attrs: {
      type: "button",
      "aria-label": `增加${product.name}数量`,
      "data-step": "1",
      "data-step-product": product.id,
    },
    props: { disabled: busy || quantity >= 99 },
  });

  const remove = el("button", {
    className: "remove-button",
    text: "移除",
    attrs: {
      type: "button",
      "aria-label": `从购物袋移除${product.name}`,
      "data-remove": product.id,
    },
    props: { disabled: busy },
  });

  const equation = el("p", {
    className: "line-equation",
    text: `${formatMoney(product.unitPriceCents)} × ${quantity} = ${formatMoney(lineTotal)}`,
  });

  const error = el("p", { id: errorId, className: "field-error", text: "" });

  const root = el("article", {
    className: "bag-line",
    attrs: { "data-cart-line": product.id },
  }, [
    el("div", { className: "bag-line-heading" }, [
      el("h3", { text: product.name }),
      remove,
    ]),
    equation,
    el("div", { className: "quantity-row" }, [
      minus,
      input,
      plus,
      el("span", { className: "quantity-unit", text: product.unit }),
    ]),
    error,
  ]);

  const commit = (options) => commitQuantity(product.id, input, options);
  input.addEventListener("change", () => commit({ refocus: false }));
  input.addEventListener("blur", () => commit({ refocus: false }));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit({ refocus: true });
    }
  });

  lineRefs.set(product.id, { root, equation, input, minus, plus, remove, error });
  return root;
}

function renderCart() {
  lineRefs = new Map();

  if (state.cart.size === 0) {
    refs.cartLines.replaceChildren(el("p", { className: "empty-state", text: COPY.bagEmpty }));
  } else {
    const lines = [];
    for (const [productId, quantity] of state.cart) {
      const product = findProduct(productId);
      if (!product) continue;
      const line = createBagLine(product, quantity);
      if (line) lines.push(line);
    }
    refs.cartLines.replaceChildren(
      ...(lines.length === 0 ? [el("p", { className: "empty-state", text: COPY.bagEmpty })] : lines),
    );
  }

  renderCartSummary();
  renderCheckoutButton();
  syncAddButtons();
}

function renderCartSummary() {
  const count = cartCount();
  const total = formatMoney(cartSubtotal());
  refs.cartCount.textContent = `${count} 件`;
  refs.cartTotal.textContent = `合计 ${total}`;
  refs.mobileCartCount.textContent = `${count} 件`;
  refs.mobileCartTotal.textContent = total;
  refs.navCartCount.textContent = String(count);
  refs.mobileBar.hidden = count === 0;
  document.body.classList.toggle("has-cart", count > 0);
}

function renderCheckoutButton() {
  const frozen = isCartFrozen(state.checkout);
  const saving = state.checkout.status === "saving";
  refs.checkout.disabled = state.cart.size === 0 || frozen || saving;
  refs.checkout.textContent = saving ? COPY.checkoutSaving : frozen ? "等待核对" : "去结账";
  refs.checkout.setAttribute("aria-busy", saving ? "true" : "false");
}

function patchBagLine(productId) {
  const line = lineRefs.get(productId);
  const product = findProduct(productId);
  const quantity = state.cart.get(productId);
  if (!line || !product || !quantity) return;
  const busy = isCheckoutBusy(state.checkout);
  line.equation.textContent =
    `${formatMoney(product.unitPriceCents)} × ${quantity} = ${formatMoney(product.unitPriceCents * quantity)}`;
  if (line.input.value !== String(quantity)) line.input.value = String(quantity);
  line.input.disabled = busy;
  line.minus.disabled = busy || quantity <= 1;
  line.plus.disabled = busy || quantity >= 99;
  line.remove.disabled = busy;
  line.root.setAttribute("aria-disabled", busy ? "true" : "false");
}

function setQuantityError(line, message) {
  if (!line) return;
  line.error.textContent = message ?? "";
  if (message) line.error.setAttribute("role", "alert");
  else line.error.removeAttribute("role");
  line.input.setAttribute("aria-invalid", message ? "true" : "false");
}

function commitQuantity(productId, input, { refocus = false } = {}) {
  if (!input.isConnected) return;
  if (isCheckoutBusy(state.checkout)) return;
  const previous = state.cart.get(productId);
  const product = findProduct(productId);
  if (!previous || !product) return;

  const parsed = parseQuantityUpdate(input.value, previous);
  const line = lineRefs.get(productId);

  // R1 契约：值没变时不重绘购物袋，紧随其后的点击不会被吞掉。
  if (!parsed.changed) {
    if (line) {
      line.input.value = String(parsed.quantity);
      setQuantityError(line, parsed.error);
    }
    if (parsed.error && refocus) {
      input.focus();
      input.select();
    }
    setCartLive(parsed.error || `${product.name}数量为 ${parsed.quantity} 件。`);
    return;
  }

  state.cart.set(productId, parsed.quantity);
  state.checkout = checkoutReducer(state.checkout, { type: "CART_CHANGED" });
  if (line) {
    line.input.value = String(parsed.quantity);
    setQuantityError(line, parsed.error);
    patchBagLine(productId);
  }
  renderCartSummary();
  renderCheckoutButton();
  renderCheckoutMessage();
  renderSuccess();
  renderUnknownActions();

  if (parsed.error && refocus) {
    const fresh = document.querySelector(`[data-quantity="${productId}"]`);
    if (fresh) {
      fresh.focus();
      fresh.select();
    }
  }
  setCartLive(parsed.error || `${product.name}数量为 ${parsed.quantity} 件。`);
}

function addToBag(productId) {
  if (isCheckoutBusy(state.checkout)) {
    setCartLive(state.checkout.status === "saving" ? COPY.bagSaving : COPY.bagLocked);
    return;
  }
  const product = findProduct(productId);
  if (!product) return;
  if (!isPurchasable(product)) {
    setProductFeedback(productId, COPY.addSoldOut);
    setCartLive(COPY.addSoldOut);
    return;
  }
  const previous = state.cart.get(productId) ?? 0;
  if (previous >= 99) {
    setProductFeedback(productId, COPY.addLimit);
    setCartLive(COPY.addLimit);
    return;
  }

  state.cart.set(productId, previous + 1);
  state.checkout = checkoutReducer(state.checkout, { type: "CART_CHANGED" });
  renderCart();
  renderCheckoutMessage();
  renderSuccess();
  const count = cartCount();
  setProductFeedback(productId, `已加入 · 购物袋共 ${count} 件`);
  setCartLive(`已加入${product.name} · 购物袋共 ${count} 件。`);
}

function setProductFeedback(productId, text) {
  const nextId = `product-feedback-${productId}`;
  if (lastProductFeedbackId !== "" && lastProductFeedbackId !== nextId) {
    const previous = byId(lastProductFeedbackId);
    if (previous) previous.textContent = "";
  }
  const node = byId(nextId);
  if (node) {
    node.textContent = text;
    lastProductFeedbackId = nextId;
  }
}

function stepQuantity(productId, delta) {
  if (isCheckoutBusy(state.checkout)) {
    setCartLive(state.checkout.status === "saving" ? COPY.bagSaving : COPY.bagLocked);
    return;
  }
  const previous = state.cart.get(productId);
  const product = findProduct(productId);
  if (!previous || !product) return;
  const next = Math.min(99, Math.max(1, previous + delta));
  if (next === previous) {
    setCartLive(delta > 0 ? `${product.name}已达到 99 件上限。` : `${product.name}已达到 1 件下限。`);
    return;
  }
  state.cart.set(productId, next);
  state.checkout = checkoutReducer(state.checkout, { type: "CART_CHANGED" });
  renderCart();
  renderCheckoutMessage();
  renderSuccess();
  renderUnknownActions();
  setCartLive(`${product.name}数量为 ${next} 件。`);
}

function removeFromBag(productId) {
  if (isCheckoutBusy(state.checkout)) {
    setCartLive(state.checkout.status === "saving" ? COPY.bagSaving : COPY.bagLocked);
    return;
  }
  const product = findProduct(productId);
  if (!state.cart.has(productId)) return;
  state.cart.delete(productId);
  state.checkout = checkoutReducer(state.checkout, { type: "CART_CHANGED" });
  renderCart();
  renderCheckoutMessage();
  renderSuccess();
  renderUnknownActions();
  setCartLive(`已从购物袋移除${product?.name ?? "商品"}。`);
}

// ---------------------------------------------------------------------------
// 结账
// ---------------------------------------------------------------------------

function checkoutMessageText() {
  const current = state.checkout;
  if (current.status === "saving") return COPY.checkoutSaving;
  if (current.status === "not-written") {
    return `订单未提交：${apiErrorMessage(current.code)}`;
  }
  if (current.status === "save-unknown") {
    return `${COPY.unknownResult}${apiErrorMessage(current.code)}${COPY.unknownHint}`;
  }
  if (current.code === "save-unknown-absent") return COPY.unknownReleased;
  return "";
}

function renderCheckoutMessage() {
  const text = checkoutMessageText();
  const error = state.checkout.status === "not-written"
    || state.checkout.status === "save-unknown"
    || state.checkout.code === "save-unknown-absent";
  setStatusLine(refs.checkoutMessage, text, { error });
  renderUnknownActions();
}

function renderUnknownActions() {
  const current = state.checkout;
  if (current.status !== "save-unknown") {
    refs.unknownActions.hidden = true;
    refs.unknownActions.replaceChildren();
    return;
  }

  const checkButton = el("button", {
    className: "button button-secondary",
    text: "核对我的订单",
    attrs: { type: "button", "data-unknown-action": "check" },
  });
  checkButton.addEventListener("click", () => {
    void checkUnknownCheckout();
  });

  const children = [
    el("p", { text: COPY.unknownHint }),
    el("div", { className: "button-row" }, [checkButton]),
  ];

  if (state.unknownChecked) {
    children.push(el("p", { text: state.unknownMatchFound ? "已找到对应订单。" : COPY.unknownCheckedAbsent }));
    const release = el("button", {
      className: "button button-quiet",
      text: "未生成，允许重新结账",
      attrs: { type: "button", "data-unknown-action": "release" },
    });
    release.addEventListener("click", () => {
      releaseUnknown();
    });
    children.push(release);
  }

  refs.unknownActions.replaceChildren(...children);
  refs.unknownActions.hidden = false;
}

async function checkout() {
  if (state.cart.size === 0) {
    setStatusLine(refs.checkoutMessage, COPY.checkoutEmpty, { error: true });
    setCartLive(COPY.checkoutEmpty);
    return;
  }
  if (isCartFrozen(state.checkout)) {
    setCartLive(COPY.bagLocked);
    return;
  }
  if (!isAuthenticated(state.auth)) {
    setStatusLine(refs.checkoutMessage, COPY.checkoutLoginRequired, { error: true });
    setCartLive(COPY.checkoutLoginRequired);
    refs.auth.scrollIntoView?.({ block: "start" });
    refs.loginUsername.focus?.();
    return;
  }

  let items;
  try {
    items = createOrderItems(state.cart, productMap());
  } catch {
    setStatusLine(refs.checkoutMessage, COPY.checkoutInvalid, { error: true });
    setCartLive(COPY.checkoutInvalid);
    return;
  }
  if (items.length === 0) {
    setStatusLine(refs.checkoutMessage, COPY.checkoutEmpty, { error: true });
    return;
  }

  const clientOrderId = state.checkout.clientOrderId ?? globalThis.crypto.randomUUID();
  state.checkout = checkoutReducer(state.checkout, {
    type: "CHECKOUT_STARTED",
    clientOrderId,
    items,
  });
  renderCart();
  renderCheckoutMessage();
  renderSuccess();
  setCartLive(COPY.checkoutSaving);

  try {
    const payload = await api.createOrder({ items, clientOrderId });
    const order = isObject(payload.order) ? payload.order : payload;
    if (!isObject(order) || typeof order.orderNumber !== "string") {
      throw new ApiError({ code: "invalid-response" });
    }
    state.checkout = checkoutReducer(state.checkout, { type: "CHECKOUT_SAVED", order });
    state.unknownChecked = false;
    state.unknownMatchFound = false;
    state.cart.clear();
    renderCart();
    renderCheckoutMessage();
    renderSuccess();
    setCartLive(`订单 ${order.orderNumber} 已提交。`);
    void loadMyOrders();
  } catch (error) {
    const code = codeOf(error);
    if (isUnknownResult(code)) {
      state.checkout = checkoutReducer(state.checkout, { type: "CHECKOUT_SAVE_UNKNOWN", code });
      state.unknownChecked = false;
      state.unknownMatchFound = false;
      renderCart();
      renderCheckoutMessage();
      renderUnknownActions();
      renderSuccess();
      setCartLive(`提交结果未确认：${apiErrorMessage(code)}请到「我的订单」核对。`);
    } else {
      state.checkout = checkoutReducer(state.checkout, { type: "CHECKOUT_FAILED", code });
      renderCart();
      renderCheckoutMessage();
      renderSuccess();
      setCartLive(`订单未提交：${apiErrorMessage(code)}`);
    }
  }
}

async function checkUnknownCheckout() {
  if (state.checkout.status !== "save-unknown") return;
  const clientOrderId = state.checkout.clientOrderId;
  const result = await loadMyOrders();
  if (result.status === "error") {
    setCartLive(`核对失败：${apiErrorMessage(result.code)}`);
    return;
  }
  state.unknownChecked = true;
  const match = findOrderByClientOrderId(result.orders, clientOrderId);
  state.unknownMatchFound = Boolean(match);

  if (match) {
    state.checkout = checkoutReducer(state.checkout, {
      type: "SAVE_UNKNOWN_RESOLVED_SAVED",
      order: match,
    });
    state.cart.clear();
    state.unknownChecked = false;
    state.unknownMatchFound = false;
    renderCart();
    renderCheckoutMessage();
    renderSuccess();
    setCartLive(`已确认订单 ${match.orderNumber} 已生成，购物袋已清空。`);
    refs.myOrders.scrollIntoView?.({ block: "start" });
    return;
  }

  renderUnknownActions();
  setCartLive(COPY.unknownCheckedAbsent);
}

function releaseUnknown() {
  if (state.checkout.status !== "save-unknown") return;
  state.checkout = checkoutReducer(state.checkout, { type: "SAVE_UNKNOWN_RESOLVED_ABSENT" });
  state.unknownChecked = false;
  state.unknownMatchFound = false;
  renderCart();
  renderCheckoutMessage();
  renderUnknownActions();
  renderSuccess();
  setCartLive(COPY.unknownReleased);
}

// ---------------------------------------------------------------------------
// 订单详情与收据
// ---------------------------------------------------------------------------

function orderItems(order) {
  return Array.isArray(order?.items) ? order.items.filter(isObject) : [];
}

function orderTotalCents(order) {
  if (Number.isSafeInteger(order?.subtotalCents) && order.subtotalCents >= 0) {
    return order.subtotalCents;
  }
  let total = 0;
  for (const item of orderItems(order)) {
    if (Number.isSafeInteger(item.lineTotalCents)) {
      total += item.lineTotalCents;
    } else if (Number.isSafeInteger(item.unitPriceCents) && Number.isInteger(item.quantity)) {
      total += item.unitPriceCents * item.quantity;
    }
  }
  return total;
}

function renderOrderDetail(order, { showNumber = true } = {}) {
  const items = orderItems(order);
  const meta = [];

  if (showNumber) {
    meta.push(el("dt", { text: "订单号" }));
    meta.push(el("dd", {}, [
      el("span", { className: "order-number", text: String(order.orderNumber ?? "未知") }),
    ]));
  }
  meta.push(el("dt", { text: "下单时间" }));
  meta.push(el("dd", { text: formatTimestamp(order.createdAt) }));
  if (typeof order.username === "string" && order.username !== "") {
    meta.push(el("dt", { text: "账号" }));
    meta.push(el("dd", { text: order.username }));
  }

  const children = [el("dl", { className: "order-meta" }, meta)];

  if (items.length > 0) {
    children.push(el("ul", { className: "order-items" }, items.map((item) => {
      const quantity = Number.isInteger(item.quantity) ? item.quantity : 0;
      const unitPriceCents = Number.isSafeInteger(item.unitPriceCents) ? item.unitPriceCents : 0;
      const lineTotalCents = Number.isSafeInteger(item.lineTotalCents)
        ? item.lineTotalCents
        : unitPriceCents * quantity;
      return el("li", { className: "order-item" }, [
        el("span", { className: "order-item-name", text: String(item.name ?? item.productId ?? "商品") }),
        el("span", {
          className: "order-item-note",
          text: `${item.unit ?? ""} · ${formatMoney(unitPriceCents)} × ${quantity} = ${formatMoney(lineTotalCents)}`,
        }),
      ]);
    })));
  } else {
    children.push(el("p", {
      className: "order-item-note",
      text: `订单包含 ${Number.isInteger(order.itemCount) ? order.itemCount : 0} 行明细。`,
    }));
  }

  children.push(el("p", { className: "order-total" }, [
    el("span", { text: "合计" }),
    el("strong", { text: formatMoney(orderTotalCents(order)) }),
  ]));

  return el("div", {}, children);
}

function renderSuccess() {
  const receipt = state.checkout.receipt;
  if (!isObject(receipt)) {
    refs.success.hidden = true;
    refs.success.replaceChildren();
    return;
  }
  refs.success.replaceChildren(
    el("p", { className: "eyebrow", text: "订单已提交" }),
    el("h2", { id: "success-title", text: `订单 ${receipt.orderNumber ?? ""}` }),
    el("p", { className: "section-note", text: "已写入服务端数据库；可在「我的订单」再次查看。" }),
    renderOrderDetail(receipt, { showNumber: false }),
  );
  refs.success.hidden = false;
}

// ---------------------------------------------------------------------------
// 登录 / 注册
// ---------------------------------------------------------------------------

function authStatusText() {
  const current = state.auth;
  if (current.status === "authenticated") return `已登录：${current.user.username}。`;
  if (current.status === "submitting") {
    return current.mode === "register" ? COPY.registerSubmitting : COPY.loginSubmitting;
  }
  if (current.status === "error") return `登录未完成：${apiErrorMessage(current.code)}`;
  if (state.authNotice !== "") return state.authNotice;
  return "当前未登录。";
}

function renderAuth() {
  const authenticated = isAuthenticated(state.auth);
  const submitting = state.auth.status === "submitting";
  const loginBusy = submitting && state.auth.mode !== "register";
  const registerBusy = submitting && state.auth.mode === "register";

  refs.authSession.hidden = !authenticated;
  refs.authForms.hidden = authenticated;
  refs.loginSubmit.disabled = submitting;
  refs.registerSubmit.disabled = submitting;
  refs.loginSubmit.textContent = loginBusy ? COPY.loginSubmitting : COPY.login;
  refs.registerSubmit.textContent = registerBusy ? COPY.registerSubmitting : COPY.register;
  refs.loginSubmit.setAttribute("aria-busy", loginBusy ? "true" : "false");
  refs.registerSubmit.setAttribute("aria-busy", registerBusy ? "true" : "false");

  if (authenticated) {
    refs.sessionUser.textContent = String(state.auth.user.username ?? "");
    refs.sessionRole.textContent = state.auth.user.role === "admin" ? "管理员" : "普通用户";
  } else {
    refs.sessionUser.textContent = "";
    refs.sessionRole.textContent = "";
  }

  refs.loginMessage.textContent = state.formMessages.login;
  refs.registerMessage.textContent = state.formMessages.register;
  setStatusLine(refs.authStatus, authStatusText());
}

function syncAdminVisibility() {
  const admin = isAuthenticated(state.auth) && state.auth.user.role === "admin";
  refs.navAdmin.hidden = !admin;
  refs.admin.hidden = !admin;
  if (!admin) {
    state.adminOrders = ordersListReducer(state.adminOrders, { type: "ORDERS_RESET" });
    state.adminProducts = adminProductsReducer(state.adminProducts, { type: "ADMIN_PRODUCTS_RESET" });
    setStatusLine(refs.adminStatus, "");
  } else {
    setStatusLine(refs.adminStatus, COPY.adminIdle);
  }
  renderAdminOrders();
  renderAdminProducts();
}

function applyUser(user, { load = true } = {}) {
  state.auth = authReducer(state.auth, { type: "SESSION_LOADED", user });
  if (isAuthenticated(state.auth)) state.authNotice = "";
  syncAdminVisibility();
  renderAuth();
  renderLookup();
  if (!isAuthenticated(state.auth)) {
    state.myOrders = ordersListReducer(state.myOrders, { type: "ORDERS_RESET" });
    renderMyOrders();
    return;
  }
  if (load) {
    void loadMyOrders();
    if (state.auth.user.role === "admin") {
      void loadAdminOrders();
      void loadAdminProducts();
    }
  }
}

async function restoreSession() {
  try {
    const payload = await api.me();
    const user = isObject(payload.user) ? payload.user : null;
    applyUser(user, { load: true });
  } catch (error) {
    const code = codeOf(error);
    if (code === "auth-required") {
      applyUser(null, { load: false });
    } else {
      applyUser(null, { load: false });
      setStatusLine(refs.authStatus, `无法确认登录状态：${apiErrorMessage(code)}`, { error: true });
      setCartLive(`无法确认登录状态：${apiErrorMessage(code)}`);
    }
  }
}

async function submitLogin(event) {
  event.preventDefault?.();
  if (state.auth.status === "submitting") return;
  const username = refs.loginUsername.value.trim();
  const password = refs.loginPassword.value;

  if (username === "" || password === "") {
    state.formMessages.login = COPY.loginMissing;
    renderAuth();
    refs.loginUsername.focus?.();
    return;
  }

  state.formMessages.login = "";
  state.authNotice = "";
  state.auth = authReducer(state.auth, { type: "AUTH_SUBMITTED", mode: "login" });
  renderAuth();

  try {
    const payload = await api.login(username, password);
    const user = isObject(payload.user) ? payload.user : null;
    if (!user || typeof user.username !== "string") {
      throw new ApiError({ code: "invalid-response" });
    }
    refs.loginPassword.value = "";
    state.formMessages.login = "";
    state.formMessages.register = "";
    state.authNotice = "";
    applyUser(user, { load: true });
    setCartLive(`已登录：${user.username}。`);
  } catch (error) {
    const code = codeOf(error);
    state.auth = authReducer(state.auth, { type: "AUTH_FAILED", code, mode: "login" });
    state.formMessages.login = apiErrorMessage(code);
    renderAuth();
    setCartLive(`登录失败：${apiErrorMessage(code)}`);
  }
}

async function submitRegister(event) {
  event.preventDefault?.();
  if (state.auth.status === "submitting") return;
  const username = refs.registerUsername.value.trim();
  const password = refs.registerPassword.value;

  if (username === "" || password === "") {
    state.formMessages.register = COPY.loginMissing;
    renderAuth();
    refs.registerUsername.focus?.();
    return;
  }

  state.formMessages.register = "";
  state.auth = authReducer(state.auth, { type: "AUTH_SUBMITTED", mode: "register" });
  renderAuth();

  try {
    await api.register(username, password);
    state.auth = authReducer(state.auth, { type: "AUTH_LOGGED_OUT" });
    state.formMessages.register = "";
    state.formMessages.login = "";
    state.authNotice = COPY.registerSaved;
    refs.registerPassword.value = "";
    refs.loginUsername.value = username;
    renderAuth();
    refs.loginPassword.focus?.();
    setCartLive(COPY.registerSaved);
  } catch (error) {
    const code = codeOf(error);
    state.auth = authReducer(state.auth, { type: "AUTH_FAILED", code, mode: "register" });
    state.formMessages.register = apiErrorMessage(code);
    renderAuth();
    setCartLive(`注册失败：${apiErrorMessage(code)}`);
  }
}

async function logout() {
  if (state.auth.status === "submitting") return;
  let failure = null;
  try {
    await api.logout();
  } catch (error) {
    failure = codeOf(error);
  }
  state.formMessages.login = "";
  state.formMessages.register = "";
  state.authNotice = "";
  state.lookup = createLookupState();
  renderLookup();
  applyUser(null, { load: false });
  setCartLive(failure ? COPY.logoutFailed : COPY.logoutSaved);
  if (failure) setStatusLine(refs.authStatus, COPY.logoutFailed, { error: true });
}

// ---------------------------------------------------------------------------
// 查订单
// ---------------------------------------------------------------------------

function showLookupInputError(message) {
  refs.lookupInput.setAttribute("aria-invalid", "true");
  refs.lookupInputError.textContent = message;
}

function clearLookupInputError() {
  refs.lookupInput.removeAttribute("aria-invalid");
  refs.lookupInputError.textContent = "";
}

function renderLookup() {
  const current = state.lookup;

  if (current.status === "idle") {
    setStatusLine(
      refs.lookupMessage,
      isAuthenticated(state.auth) ? COPY.lookupIdleReady : COPY.lookupIdle,
    );
    refs.lookupResult.hidden = true;
    refs.lookupResult.replaceChildren();
    return;
  }

  if (current.status === "submitting") {
    setStatusLine(refs.lookupMessage, COPY.lookupSubmitting);
    refs.lookupResult.hidden = true;
    refs.lookupResult.replaceChildren();
    return;
  }

  const nodes = [el("h3", {
    id: "lookup-result-title",
    text: current.status === "found" ? COPY.lookupResultTitle : COPY.lookupResult,
    attrs: { tabindex: "-1" },
  })];

  if (current.status === "found" && isObject(current.order)) {
    setStatusLine(refs.lookupMessage, COPY.lookupFound);
    nodes.push(renderOrderDetail(current.order));
  } else if (current.status === "not-found") {
    setStatusLine(refs.lookupMessage, COPY.lookupNotFound, { error: true });
    nodes.push(el("p", { text: COPY.lookupNotFound }));
  } else {
    const message = apiErrorMessage(current.code);
    setStatusLine(refs.lookupMessage, message, { error: true });
    nodes.push(el("p", { text: message }));
  }

  refs.lookupResult.replaceChildren(...nodes);
  refs.lookupResult.hidden = false;
}

function focusLookupResult() {
  const heading = byId("lookup-result-title");
  if (!heading) return;
  heading.focus?.({ preventScroll: true });
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  heading.scrollIntoView?.({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start",
  });
}

async function submitLookup(event) {
  event.preventDefault?.();

  if (!isAuthenticated(state.auth)) {
    clearLookupInputError();
    state.lookup = createLookupState();
    renderLookup();
    setStatusLine(refs.lookupMessage, COPY.lookupLoginRequired, { error: true });
    refs.auth.scrollIntoView?.({ block: "start" });
    refs.loginUsername.focus?.();
    return;
  }

  const trimmed = refs.lookupInput.value.trim();
  if (trimmed === "") {
    showLookupInputError(COPY.lookupEmpty);
    state.lookup = createLookupState();
    renderLookup();
    refs.lookupInput.focus?.();
    return;
  }

  const orderNumber = normalizeOrderNumber(trimmed);
  if (!isOrderNumberFormat(orderNumber)) {
    showLookupInputError(COPY.lookupMalformed);
    state.lookup = createLookupState();
    renderLookup();
    refs.lookupInput.focus?.();
    return;
  }

  clearLookupInputError();
  state.lookup = lookupReducer(state.lookup, { type: "LOOKUP_STARTED", orderNumber });
  renderLookup();

  try {
    const payload = await api.order(orderNumber);
    const order = isObject(payload.order) ? payload.order : payload;
    if (!isObject(order) || typeof order.orderNumber !== "string") {
      throw new ApiError({ code: "invalid-response" });
    }
    state.lookup = lookupReducer(state.lookup, { type: "LOOKUP_FOUND", order });
  } catch (error) {
    state.lookup = lookupReducer(state.lookup, {
      type: "LOOKUP_FAILED",
      code: codeOf(error),
      orderNumber,
    });
  }

  renderLookup();
  focusLookupResult();
}

// ---------------------------------------------------------------------------
// 我的订单
// ---------------------------------------------------------------------------

function orderCard(order, { showNumber = true } = {}) {
  return el("article", {
    className: "order-card",
    attrs: { "data-order-number": String(order.orderNumber ?? "") },
  }, [
    el("h3", { text: `订单 ${order.orderNumber ?? "未知"}` }),
    renderOrderDetail(order, { showNumber: false }),
  ]);
}

function retryButton(name, label = COPY.retry) {
  return el("button", {
    className: "button button-secondary",
    text: label,
    attrs: { type: "button", "data-retry": name },
  });
}

function renderMyOrders() {
  const current = state.myOrders;

  if (!isAuthenticated(state.auth)) {
    setStatusLine(refs.myOrdersStatus, COPY.myOrdersAnonymous);
    refs.myOrdersList.replaceChildren();
    return;
  }
  if (current.status === "idle") {
    setStatusLine(refs.myOrdersStatus, COPY.myOrdersIdle);
    refs.myOrdersList.replaceChildren();
    return;
  }
  if (current.status === "loading") {
    setStatusLine(refs.myOrdersStatus, COPY.myOrdersLoading);
    refs.myOrdersList.replaceChildren();
    return;
  }
  if (current.status === "error") {
    setStatusLine(
      refs.myOrdersStatus,
      `${COPY.myOrdersErrorTitle}：${apiErrorMessage(current.code)}`,
      { error: true },
    );
    refs.myOrdersList.replaceChildren(retryButton("my-orders"));
    return;
  }
  if (current.status === "empty") {
    setStatusLine(refs.myOrdersStatus, COPY.myOrdersEmpty);
    refs.myOrdersList.replaceChildren();
    return;
  }

  setStatusLine(refs.myOrdersStatus, `共 ${current.orders.length} 笔订单。`);
  refs.myOrdersList.replaceChildren(...current.orders.map((order) => orderCard(order)));
}

async function loadMyOrders() {
  if (!isAuthenticated(state.auth)) {
    state.myOrders = ordersListReducer(state.myOrders, { type: "ORDERS_RESET" });
    renderMyOrders();
    return state.myOrders;
  }
  state.myOrders = ordersListReducer(state.myOrders, { type: "ORDERS_LOADING" });
  renderMyOrders();
  try {
    const payload = await api.myOrders();
    state.myOrders = ordersListReducer(state.myOrders, {
      type: "ORDERS_LOADED",
      orders: Array.isArray(payload.orders) ? payload.orders : [],
    });
  } catch (error) {
    state.myOrders = ordersListReducer(state.myOrders, {
      type: "ORDERS_FAILED",
      code: codeOf(error),
    });
  }
  renderMyOrders();
  return state.myOrders;
}

// ---------------------------------------------------------------------------
// 管理面板
// ---------------------------------------------------------------------------

function renderAdminOrders() {
  const current = state.adminOrders;

  if (current.status === "idle") {
    setStatusLine(refs.adminOrdersStatus, "");
    refs.adminOrdersList.replaceChildren();
    return;
  }
  if (current.status === "loading") {
    setStatusLine(refs.adminOrdersStatus, COPY.adminOrdersLoading);
    refs.adminOrdersList.replaceChildren();
    return;
  }
  if (current.status === "error") {
    setStatusLine(
      refs.adminOrdersStatus,
      `${COPY.adminOrdersErrorTitle}：${apiErrorMessage(current.code)}`,
      { error: true },
    );
    refs.adminOrdersList.replaceChildren(retryButton("admin-orders"));
    return;
  }
  if (current.status === "empty") {
    setStatusLine(refs.adminOrdersStatus, COPY.adminOrdersEmpty);
    refs.adminOrdersList.replaceChildren();
    return;
  }

  setStatusLine(refs.adminOrdersStatus, `共 ${current.orders.length} 笔订单。`);
  refs.adminOrdersList.replaceChildren(...current.orders.map((order) => orderCard(order)));
}

async function loadAdminOrders() {
  if (!isAuthenticated(state.auth) || state.auth.user.role !== "admin") {
    state.adminOrders = ordersListReducer(state.adminOrders, { type: "ORDERS_RESET" });
    renderAdminOrders();
    return state.adminOrders;
  }
  state.adminOrders = ordersListReducer(state.adminOrders, { type: "ORDERS_LOADING" });
  renderAdminOrders();
  try {
    const payload = await api.adminOrders();
    state.adminOrders = ordersListReducer(state.adminOrders, {
      type: "ORDERS_LOADED",
      orders: Array.isArray(payload.orders) ? payload.orders : [],
    });
  } catch (error) {
    state.adminOrders = ordersListReducer(state.adminOrders, {
      type: "ORDERS_FAILED",
      code: codeOf(error),
    });
  }
  renderAdminOrders();
  return state.adminOrders;
}

function adminProductStatusLabel(product) {
  const cardState = productCardState(product);
  if (cardState === "unlisted") return "已下架";
  if (cardState === "sold-out") return "已售罄";
  return "在售";
}

function adminProductRow(product) {
  const cardState = productCardState(product);
  const saving = state.adminProducts.savingId === product.id;
  const statusId = `admin-product-status-${product.id}`;

  const priceInput = el("input", {
    id: `admin-price-${product.id}`,
    attrs: {
      type: "number",
      min: "0",
      max: "9999999",
      step: "1",
      "data-admin-price": product.id,
      "aria-label": `${product.name}价格（分）`,
    },
    props: { value: String(product.unitPriceCents ?? 0), disabled: saving },
  });

  const stockInput = el("input", {
    id: `admin-stock-${product.id}`,
    attrs: {
      type: "number",
      min: "0",
      max: "99999",
      step: "1",
      "data-admin-stock": product.id,
      "aria-label": `${product.name}库存`,
    },
    props: { value: String(product.stock ?? 0), disabled: saving },
  });

  const saveButton = el("button", {
    className: "button button-secondary",
    text: saving ? "保存中…" : "保存",
    attrs: { type: "button", "data-admin-save": product.id },
    props: { disabled: saving },
  });
  saveButton.addEventListener("click", () => {
    void saveAdminProduct(product, priceInput, stockInput);
  });

  const toggleButton = el("button", {
    className: "button button-quiet",
    text: cardState === "unlisted" ? "上架" : "下架",
    attrs: { type: "button", "data-admin-toggle": product.id },
    props: { disabled: saving },
  });
  toggleButton.addEventListener("click", () => {
    void toggleAdminProduct(product);
  });

  return el("article", {
    className: "admin-product",
    attrs: {
      "data-admin-product": product.id,
      "data-state": cardState,
    },
  }, [
    el("div", { className: "admin-product-head" }, [
      el("h4", { className: "admin-product-name", text: product.name }),
      el("p", { className: "admin-product-unit", text: `${product.unit} · ${formatMoney(product.unitPriceCents)}` }),
      el("p", { className: "admin-product-state", text: adminProductStatusLabel(product) }),
    ]),
    el("div", { className: "admin-product-fields" }, [
      el("div", { className: "admin-field" }, [
        el("label", { text: "价格（分）", attrs: { for: `admin-price-${product.id}` } }),
        priceInput,
      ]),
      el("div", { className: "admin-field" }, [
        el("label", { text: "库存", attrs: { for: `admin-stock-${product.id}` } }),
        stockInput,
      ]),
      saveButton,
      toggleButton,
    ]),
    el("p", {
      id: statusId,
      className: "admin-row-status",
      attrs: { "aria-live": "polite" },
    }),
  ]);
}

function renderAdminProducts() {
  const current = state.adminProducts;

  if (current.status === "idle") {
    setStatusLine(refs.adminProductsStatus, COPY.adminProductsIdle);
    refs.adminProductsList.replaceChildren();
    return;
  }
  if (current.status === "loading") {
    setStatusLine(refs.adminProductsStatus, COPY.adminProductsLoading);
    refs.adminProductsList.replaceChildren();
    return;
  }
  if (current.status === "error") {
    setStatusLine(
      refs.adminProductsStatus,
      `${COPY.adminProductsErrorTitle}：${apiErrorMessage(current.code)}`,
      { error: true },
    );
    refs.adminProductsList.replaceChildren(retryButton("admin-products"));
    return;
  }
  if (current.status === "empty") {
    setStatusLine(refs.adminProductsStatus, COPY.adminProductsEmpty);
    refs.adminProductsList.replaceChildren();
    return;
  }

  setStatusLine(refs.adminProductsStatus, `共 ${current.products.length} 种商品（含已下架）。`);
  refs.adminProductsList.replaceChildren(...current.products.map(adminProductRow));
}

function setAdminRowStatus(productId, message, { error = false } = {}) {
  const node = byId(`admin-product-status-${productId}`);
  if (!node) return;
  node.textContent = message;
  node.classList.toggle("is-error", Boolean(error));
}

async function loadAdminProducts() {
  if (!isAuthenticated(state.auth) || state.auth.user.role !== "admin") {
    state.adminProducts = adminProductsReducer(state.adminProducts, { type: "ADMIN_PRODUCTS_RESET" });
    renderAdminProducts();
    return state.adminProducts;
  }
  state.adminProducts = adminProductsReducer(state.adminProducts, { type: "ADMIN_PRODUCTS_LOADING" });
  renderAdminProducts();
  try {
    const payload = await api.adminProducts();
    state.adminProducts = adminProductsReducer(state.adminProducts, {
      type: "ADMIN_PRODUCTS_LOADED",
      products: Array.isArray(payload.products) ? payload.products : [],
    });
  } catch (error) {
    state.adminProducts = adminProductsReducer(state.adminProducts, {
      type: "ADMIN_PRODUCTS_FAILED",
      code: codeOf(error),
    });
  }
  renderAdminProducts();
  return state.adminProducts;
}

function parseAdminInteger(input, { min, max, label }) {
  const text = typeof input.value === "string" ? input.value.trim() : "";
  if (!/^\d+$/.test(text)) {
    return { error: `${label}需为 ${min} 到 ${max} 的整数。` };
  }
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    return { error: `${label}需为 ${min} 到 ${max} 的整数。` };
  }
  return { value };
}

async function patchAdminProduct(product, patch, inputs) {
  state.adminProducts = adminProductsReducer(state.adminProducts, {
    type: "PRODUCT_SAVING",
    productId: product.id,
  });
  renderAdminProducts();

  try {
    const payload = await api.updateProduct(product.id, patch);
    const updated = isObject(payload.product) ? payload.product : { ...product, ...patch };
    state.adminProducts = adminProductsReducer(state.adminProducts, {
      type: "PRODUCT_SAVED",
      product: updated,
    });
    renderAdminProducts();
    void loadProducts();
    return { ok: true, product: updated };
  } catch (error) {
    const code = codeOf(error);
    state.adminProducts = adminProductsReducer(state.adminProducts, {
      type: "PRODUCT_SAVE_FAILED",
      productId: product.id,
      code,
    });
    renderAdminProducts();
    return { ok: false, code };
  }
}

async function saveAdminProduct(product, priceInput, stockInput) {
  const price = parseAdminInteger(priceInput, { min: 0, max: 9_999_999, label: "价格" });
  const stock = parseAdminInteger(stockInput, { min: 0, max: 99_999, label: "库存" });

  priceInput.setAttribute("aria-invalid", price.error ? "true" : "false");
  stockInput.setAttribute("aria-invalid", stock.error ? "true" : "false");
  if (price.error) {
    setAdminRowStatus(product.id, price.error, { error: true });
    return;
  }
  if (stock.error) {
    setAdminRowStatus(product.id, stock.error, { error: true });
    return;
  }

  const patch = {};
  if (price.value !== product.unitPriceCents) patch.unitPriceCents = price.value;
  if (stock.value !== product.stock) patch.stock = stock.value;
  if (Object.keys(patch).length === 0) {
    setAdminRowStatus(product.id, COPY.noChanges);
    return;
  }

  const result = await patchAdminProduct(product, patch, { priceInput, stockInput });
  setAdminRowStatus(
    product.id,
    result.ok ? COPY.saved : apiErrorMessage(result.code),
    { error: !result.ok },
  );
}

async function toggleAdminProduct(product) {
  const unlisted = productCardState(product) === "unlisted";
  const patch = { listed: unlisted ? 1 : 0 };
  const result = await patchAdminProduct(product, patch, {});
  setAdminRowStatus(
    product.id,
    result.ok ? (unlisted ? "已上架。" : "已下架。") : apiErrorMessage(result.code),
    { error: !result.ok },
  );
}

// ---------------------------------------------------------------------------
// 事件绑定与启动
// ---------------------------------------------------------------------------

function bindEvents() {
  refs.catalog.addEventListener("click", (event) => {
    const addButton = event.target.closest?.("[data-add]");
    if (addButton) {
      addToBag(addButton.dataset.add);
      return;
    }
    const retry = event.target.closest?.("[data-retry='catalog']");
    if (retry) void loadProducts();
  });

  refs.cartLines.addEventListener("click", (event) => {
    const removeButton = event.target.closest?.("[data-remove]");
    if (removeButton) {
      removeFromBag(removeButton.dataset.remove);
      return;
    }
    const stepButton = event.target.closest?.("[data-step]");
    if (stepButton) {
      stepQuantity(stepButton.dataset.stepProduct, Number(stepButton.dataset.step));
    }
  });

  refs.checkout.addEventListener("click", () => {
    void checkout();
  });

  refs.lookupForm.addEventListener("submit", (event) => {
    void submitLookup(event);
  });
  refs.lookupInput.addEventListener("input", () => {
    clearLookupInputError();
    state.lookup = lookupReducer(state.lookup, { type: "INPUT_CHANGED" });
    renderLookup();
  });

  refs.loginForm.addEventListener("submit", (event) => {
    void submitLogin(event);
  });
  refs.registerForm.addEventListener("submit", (event) => {
    void submitRegister(event);
  });
  refs.logoutButton.addEventListener("click", () => {
    void logout();
  });

  refs.myOrdersRefresh.addEventListener("click", () => {
    void loadMyOrders();
  });
  refs.navMyOrders.addEventListener("click", () => {
    if (isAuthenticated(state.auth) && state.myOrders.status === "idle") {
      void loadMyOrders();
    }
  });

  refs.adminOrdersRefresh.addEventListener("click", () => {
    void loadAdminOrders();
  });
  refs.adminProductsRefresh.addEventListener("click", () => {
    void loadAdminProducts();
  });

  refs.myOrdersList.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-retry='my-orders']")) void loadMyOrders();
  });
  refs.adminOrdersList.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-retry='admin-orders']")) void loadAdminOrders();
  });
  refs.adminProductsList.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-retry='admin-products']")) void loadAdminProducts();
  });
}

function init() {
  cacheRefs();
  bindEvents();
  renderAuth();
  renderCatalog();
  renderCart();
  renderCheckoutMessage();
  renderSuccess();
  renderLookup();
  renderMyOrders();
  renderAdminOrders();
  renderAdminProducts();
  syncAdminVisibility();
  renderUnknownActions();
  renderBootStatus();

  void loadProducts();
  void restoreSession();

  window.__fruitlabBooted = true;
  document.body.classList.add("is-ready");
}

try {
  init();
} catch (error) {
  window.__fruitlabShowBootFailure?.();
  console.error("FruitLab 初始化失败", error);
}
