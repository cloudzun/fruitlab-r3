import { FRUITS, catalogById } from "./catalog.mjs";
import {
  checkoutReducer,
  createCheckoutState,
  createLookupState,
  isCartFrozen,
  lookupReducer,
  performLookup,
  resolveUnknownCheckout,
  runCheckout,
} from "./controller.mjs";
import {
  formatCny,
  normalizeOrderNumber,
  parseQuantity,
  subtotalCents,
} from "./domain.mjs";
import { readOrders } from "./order-store.mjs";

const MARKS = new Map([
  ["fuji-apple", "苹"],
  ["banana", "蕉"],
  ["navel-orange", "橙"],
  ["shine-muscat", "葡"],
  ["golden-pineapple", "凤"],
  ["durian", "榴"],
  ["hami-melon", "蜜"],
  ["peach", "桃"],
  ["blueberry", "莓"],
  ["red-dragon-fruit", "龙"],
]);

const MESSAGES = Object.freeze({
  idle: "",
  saving: "正在保存订单...",
  emptyCart: "购物车为空",
  notWritten: "订单未保存，请重试",
  numberFailed: "订单号生成失败，请重试",
  saveUnknown: "订单可能已保存，请先查询订单号，不要重复提交",
  unknownAbsent: "已确认本次订单未保存，购物车已保留，可以重新结账",
  saveUnknownUnavailable: "本地订单存储不可用，暂时无法确认保存状态",
  saveUnknownDuplicate: "本地订单数据存在重复订单号，请人工核对后再操作",
  saveUnknownMismatch: "订单号已存在，但内容与本次快照不一致，请人工核对",
  saveUnknownUnhealthy: "本地订单数据有损坏或重复，无法确认保存状态，请先备份并检查原始存储",
  lookupEmpty: "请输入订单号",
  lookupMalformed: "订单号格式不正确，应为 FL-YYYYMMDD-HHMMSS-XXXX，例如 FL-20261017-131500-A7K2",
  lookupNotFound: "未找到该订单",
  lookupUnavailable: "本地订单存储不可用",
  lookupDuplicate: "本地订单数据存在重复订单号",
  lookupIdle: "输入订单号查询已保存订单",
  copySuccess: "订单号已复制",
  copyFailure: "复制失败，请手动选择订单号",
  cartFrozen: "保存状态未确认，暂时不能修改果篮",
});

const refs = {
  bootStatus: document.getElementById("boot-status"),
  catalog: document.getElementById("catalog"),
  cart: document.getElementById("cart"),
  cartLines: document.getElementById("cart-lines"),
  cartCount: document.getElementById("cart-count"),
  cartTotal: document.getElementById("cart-total"),
  cartLive: document.getElementById("cart-live"),
  checkout: document.getElementById("checkout"),
  checkoutMessage: document.getElementById("checkout-message"),
  unknownActions: document.getElementById("unknown-actions"),
  storageNotice: document.getElementById("storage-notice"),
  success: document.getElementById("order-success"),
  lookupForm: document.getElementById("lookup-form"),
  lookupInput: document.getElementById("lookup-input"),
  lookupSubmit: document.getElementById("lookup-submit"),
  lookupMessage: document.getElementById("lookup-message"),
  lookupResult: document.getElementById("lookup-result"),
  mobileBar: document.getElementById("mobile-cart-bar"),
  mobileCount: document.getElementById("mobile-cart-count"),
  mobileTotal: document.getElementById("mobile-cart-total"),
};

const cart = new Map();
const quantityErrors = new Map();
let checkoutState = createCheckoutState();
let lookupState = createLookupState();

function element(tagName, options = {}, children = []) {
  const node = document.createElement(tagName);
  if (options.id) node.id = options.id;
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.attrs) {
    for (const [name, value] of Object.entries(options.attrs)) {
      if (value === false || value === null || value === undefined) continue;
      node.setAttribute(name, value === true ? "" : String(value));
    }
  }
  if (options.props) Object.assign(node, options.props);
  node.append(...children);
  return node;
}

function byId(id) {
  return document.getElementById(id);
}

function setCartLive(text) {
  refs.cartLive.textContent = "";
  requestAnimationFrame(() => {
    refs.cartLive.textContent = text;
  });
}

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function cartItemCount() {
  return [...cart.values()].reduce((sum, quantity) => sum + quantity, 0);
}

function cartSubtotal() {
  if (cart.size === 0) return 0;
  const items = [];
  for (const [fruitId, quantity] of cart) {
    const fruit = catalogById.get(fruitId);
    if (fruit) items.push({ unitPriceCents: fruit.unitPriceCents, quantity });
  }
  return subtotalCents(items);
}

function renderCatalog() {
  const cards = FRUITS.map((fruit, index) => {
    const feedbackId = `feedback-${fruit.id}`;
    const mark = element("span", {
      className: "fruit-mark-letter",
      text: MARKS.get(fruit.id) ?? fruit.name.slice(0, 1),
      attrs: { "aria-hidden": "true" },
    });
    const emblem = element("div", {
      className: "fruit-emblem",
      attrs: { "aria-hidden": "true" },
    }, [
      mark,
      element("span", { className: "fruit-leaf" }),
    ]);

    const addButton = element("button", {
      className: "add-button",
      text: "加入购物车",
      attrs: {
        type: "button",
        "data-add": fruit.id,
        "aria-describedby": feedbackId,
      },
    });

    const price = element("div", { className: "price-tag" }, [
      element("span", { className: "price-value", text: formatCny(fruit.unitPriceCents) }),
      element("span", { className: "price-unit", text: `/ ${fruit.unit}` }),
    ]);

    return element("article", {
      className: "catalog-card",
      attrs: {
        "data-fruit": fruit.id,
      },
    }, [
      element("div", { className: "card-topline" }, [
        element("span", { className: "card-number", text: `NO.${String(index + 1).padStart(2, "0")}` }),
        element("span", { className: "card-origin", text: "今日到货" }),
      ]),
      emblem,
      element("h3", { text: fruit.name }),
      element("p", { className: "fruit-description", text: fruit.description }),
      element("div", { className: "card-footer" }, [price, addButton]),
      element("p", {
        id: feedbackId,
        className: "item-feedback",
        text: "",
        attrs: { "aria-live": "polite" },
      }),
    ]);
  });

  refs.catalog.replaceChildren(...cards);
  refs.catalog.setAttribute("aria-busy", "false");
}

function clearItemFeedback() {
  for (const fruit of FRUITS) {
    const feedback = byId(`feedback-${fruit.id}`);
    if (feedback) feedback.textContent = "";
  }
}

function showItemFeedback(fruitId, text) {
  clearItemFeedback();
  const feedback = byId(`feedback-${fruitId}`);
  if (feedback) feedback.textContent = text;
}

function markCartChanged() {
  checkoutState = checkoutReducer(checkoutState, { type: "CART_CHANGED" });
  quantityErrors.clear();
  clearItemFeedback();
  renderCart();
  renderCheckoutMessage();
  renderSuccess();
}

function addFruit(fruitId) {
  if (isCartFrozen(checkoutState)) {
    setCartLive(MESSAGES.cartFrozen);
    return;
  }

  const fruit = catalogById.get(fruitId);
  if (!fruit) return;

  const previous = cart.get(fruitId) ?? 0;
  if (previous >= 99) {
    showItemFeedback(fruitId, "已到 99 件上限");
    setCartLive("已到 99 件上限");
    return;
  }

  cart.set(fruitId, previous + 1);
  checkoutState = checkoutReducer(checkoutState, { type: "CART_CHANGED" });
  renderCart();
  renderCheckoutMessage();
  renderSuccess();

  const count = cartItemCount();
  showItemFeedback(fruitId, `已加入 · 购物车共 ${count} 件`);
  setCartLive(`已加入 ${fruit.name} · 购物车共 ${count} 件`);
}

function commitQuantity(fruitId, input) {
  if (!input.isConnected || isCartFrozen(checkoutState)) return;
  const previous = cart.get(fruitId);
  if (!previous) return;

  const parsed = parseQuantity(input.value, previous);
  cart.set(fruitId, parsed.quantity);
  if (parsed.error) {
    quantityErrors.set(fruitId, parsed.error);
  } else {
    quantityErrors.delete(fruitId);
  }

  checkoutState = checkoutReducer(checkoutState, { type: "CART_CHANGED" });
  clearItemFeedback();
  renderCart();
  renderCheckoutMessage();
  renderSuccess();

  const nextInput = document.querySelector(`[data-quantity="${fruitId}"]`);
  if (nextInput && parsed.error) {
    nextInput.focus();
    nextInput.select();
  }
  setCartLive(parsed.error || `${catalogById.get(fruitId)?.name ?? "商品"}数量已更新为 ${parsed.quantity}`);
}

function stepQuantity(fruitId, delta) {
  if (isCartFrozen(checkoutState)) return;
  const previous = cart.get(fruitId);
  if (!previous) return;
  const next = Math.min(99, Math.max(1, previous + delta));
  cart.set(fruitId, next);
  quantityErrors.delete(fruitId);
  checkoutState = checkoutReducer(checkoutState, { type: "CART_CHANGED" });
  clearItemFeedback();
  renderCart();
  renderCheckoutMessage();
  renderSuccess();
  setCartLive(`${catalogById.get(fruitId)?.name ?? "商品"}数量已更新为 ${next}`);
}

function removeFruit(fruitId) {
  if (isCartFrozen(checkoutState)) return;
  cart.delete(fruitId);
  quantityErrors.delete(fruitId);
  checkoutState = checkoutReducer(checkoutState, { type: "CART_CHANGED" });
  clearItemFeedback();
  renderCart();
  renderCheckoutMessage();
  renderSuccess();
  setCartLive(`已移除 ${catalogById.get(fruitId)?.name ?? "商品"}`);
}

function createCartLine(fruitId, quantity) {
  const fruit = catalogById.get(fruitId);
  if (!fruit) return null;

  const frozen = isCartFrozen(checkoutState);
  const lineTotal = fruit.unitPriceCents * quantity;
  const error = quantityErrors.get(fruitId) ?? "";
  const errorId = `quantity-error-${fruitId}`;

  const minusButton = element("button", {
    className: "step-button",
    text: "−",
    attrs: {
      type: "button",
      "aria-label": `减少 ${fruit.name} 数量`,
      "data-step": "-1",
      "data-fruit-id": fruitId,
      disabled: quantity <= 1 || frozen,
    },
  });

  const quantityInput = element("input", {
    id: `quantity-${fruitId}`,
    className: "quantity-input",
    attrs: {
      type: "number",
      name: `quantity-${fruitId}`,
      min: "1",
      max: "99",
      step: "1",
      inputmode: "numeric",
      "aria-label": `${fruit.name} 数量`,
      "aria-describedby": errorId,
      "aria-invalid": error ? "true" : false,
      "data-quantity": fruitId,
      disabled: frozen,
    },
    props: { value: String(quantity) },
  });

  const commit = () => commitQuantity(fruitId, quantityInput);
  quantityInput.addEventListener("change", commit);
  quantityInput.addEventListener("blur", commit);
  quantityInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  });

  const plusButton = element("button", {
    className: "step-button",
    text: "+",
    attrs: {
      type: "button",
      "aria-label": `增加 ${fruit.name} 数量`,
      "data-step": "1",
      "data-fruit-id": fruitId,
      disabled: quantity >= 99 || frozen,
    },
  });

  const removeButton = element("button", {
    className: "remove-button",
    text: "移除",
    attrs: {
      type: "button",
      "aria-label": `从购物车移除 ${fruit.name}`,
      "data-remove": fruitId,
      disabled: frozen,
    },
  });

  return element("article", {
    className: "cart-line",
    attrs: { "data-cart-line": fruitId, "aria-disabled": frozen ? "true" : false },
  }, [
    element("div", { className: "cart-line-heading" }, [
      element("h3", { text: fruit.name }),
      removeButton,
    ]),
    element("p", {
      className: "line-equation",
      text: `${formatCny(fruit.unitPriceCents)} × ${quantity} = ${formatCny(lineTotal)}`,
    }),
    element("div", { className: "quantity-row" }, [
      minusButton,
      quantityInput,
      plusButton,
      element("span", { className: "quantity-unit", text: fruit.unit }),
    ]),
    element("p", {
      id: errorId,
      className: "quantity-error",
      text: error,
      attrs: { role: error ? "alert" : false },
    }),
  ]);
}

function renderCart() {
  const frozen = isCartFrozen(checkoutState);
  if (cart.size === 0) {
    refs.cartLines.replaceChildren(
      element("p", { className: "empty-cart", text: "购物车为空" }),
      element("p", { className: "empty-hint", text: "从上方挑一颗水果，果篮就会亮起来。" }),
    );
  } else {
    const lines = [];
    for (const [fruitId, quantity] of cart) {
      const line = createCartLine(fruitId, quantity);
      if (line) lines.push(line);
    }
    refs.cartLines.replaceChildren(...lines);
  }

  const count = cartItemCount();
  const total = formatCny(cartSubtotal());
  refs.cartCount.textContent = `${count} 件`;
  refs.cartTotal.textContent = `合计 ${total}`;
  refs.mobileCount.textContent = `${count} 件`;
  refs.mobileTotal.textContent = total;
  refs.mobileBar.hidden = count === 0;
  document.body.classList.toggle("has-mobile-cart", count > 0);

  for (const button of document.querySelectorAll("[data-add]")) {
    button.disabled = frozen;
  }

  renderCheckoutButton();
}

function handleCartClick(event) {
  const removeButton = event.target.closest("[data-remove]");
  if (removeButton) {
    removeFruit(removeButton.dataset.remove);
    return;
  }
  const stepButton = event.target.closest("[data-step]");
  if (stepButton) {
    stepQuantity(stepButton.dataset.fruitId, Number(stepButton.dataset.step));
  }
}

function renderCheckoutButton() {
  const frozen = isCartFrozen(checkoutState);
  refs.checkout.disabled = cart.size === 0 || frozen || checkoutState.status === "saving";
  refs.checkout.textContent = checkoutState.status === "saving" ? "正在保存..." : "去结账";
  refs.checkout.setAttribute("aria-busy", checkoutState.status === "saving" ? "true" : "false");
}

function checkoutMessageText() {
  switch (checkoutState.status) {
    case "idle":
      return "";
    case "saving":
      return MESSAGES.saving;
    case "not-written":
      return MESSAGES.notWritten;
    case "number-generation-failed":
    case "duplicate-order-number":
      return MESSAGES.numberFailed;
    case "save-unknown":
      switch (checkoutState.code) {
        case "storage-unavailable":
          return MESSAGES.saveUnknownUnavailable;
        case "duplicate-order-number":
          return MESSAGES.saveUnknownDuplicate;
        case "save-unknown-mismatch":
          return MESSAGES.saveUnknownMismatch;
        case "save-unknown-unhealthy-storage":
          return MESSAGES.saveUnknownUnhealthy;
        case "save-unknown-absent":
          return MESSAGES.unknownAbsent;
        default:
          return MESSAGES.saveUnknown;
      }
    case "saved":
      return "";
    default:
      return "";
  }
}

function renderCheckoutMessage() {
  const text = checkoutMessageText();
  refs.checkoutMessage.textContent = text;
  refs.checkoutMessage.classList.toggle("is-error", Boolean(text) && checkoutState.status !== "saving");
  renderUnknownActions();
}

async function copyOrderNumber(orderNumber, feedback) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
    await navigator.clipboard.writeText(orderNumber);
    feedback.textContent = MESSAGES.copySuccess;
  } catch {
    feedback.textContent = MESSAGES.copyFailure;
  }
}

function renderUnknownActions() {
  if (checkoutState.status !== "save-unknown" || !checkoutState.orderNumber) {
    refs.unknownActions.hidden = true;
    refs.unknownActions.replaceChildren();
    return;
  }

  const feedback = element("p", {
    className: "copy-feedback",
    text: "",
    attrs: { "aria-live": "polite" },
  });
  const orderNumber = checkoutState.orderNumber;
  const copyButton = element("button", {
    className: "small-button",
    text: "复制订单号",
    attrs: { type: "button", "data-unknown-action": "copy" },
  });
  copyButton.addEventListener("click", () => copyOrderNumber(orderNumber, feedback));

  const queryButton = element("button", {
    className: "small-button",
    text: "查询此订单号",
    attrs: { type: "button", "data-unknown-action": "query" },
  });
  queryButton.addEventListener("click", () => {
    refs.lookupInput.value = orderNumber;
    submitLookup();
  });

  const checkButton = element("button", {
    className: "ink-button",
    text: "重新检查保存状态",
    attrs: { type: "button", "data-unknown-action": "check" },
  });
  checkButton.addEventListener("click", resolveUnknown);

  refs.unknownActions.replaceChildren(
    element("p", { className: "unknown-order-number", text: "本次订单号" }),
    element("code", {
      className: "order-number selectable",
      text: orderNumber,
      attrs: { tabindex: "0" },
    }),
    element("div", { className: "unknown-button-row" }, [copyButton, queryButton]),
    checkButton,
    feedback,
    element("p", {
      className: "manual-note",
      text: "只有本地存储恢复健康并确认此订单不存在后，才允许再次结账。",
    }),
  );
  refs.unknownActions.hidden = false;
}

function formatLocalTimestamp(iso) {
  const date = new Date(iso);
  const pad = (value) => String(value).padStart(2, "0");
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}（本地时间）`,
  ].join(" ");
}

function appendOrderDetails(container, order, prefix) {
  const copyFeedback = element("p", {
    id: `${prefix}-copy-feedback`,
    className: "copy-feedback",
    text: "",
    attrs: { "aria-live": "polite" },
  });
  const copyButton = element("button", {
    className: "small-button",
    text: "复制订单号",
    attrs: { type: "button" },
  });
  copyButton.addEventListener("click", () => copyOrderNumber(order.orderNumber, copyFeedback));

  const queryButton = element("button", {
    className: "small-button",
    text: "查询此订单",
    attrs: { type: "button" },
  });
  queryButton.addEventListener("click", () => {
    refs.lookupInput.value = order.orderNumber;
    submitLookup();
  });

  const itemLines = order.items.map((item) => element("li", { className: "receipt-line" }, [
    element("div", {}, [
      element("strong", { text: item.name }),
      element("span", { text: `${item.unit} · ${formatCny(item.unitPriceCents)} × ${item.quantity}` }),
    ]),
    element("strong", { className: "receipt-line-total", text: formatCny(item.lineTotalCents) }),
  ]));

  container.append(
    element("div", { className: "receipt-meta" }, [
      element("p", { className: "receipt-label", text: "订单号" }),
      element("code", {
        className: "order-number selectable",
        text: order.orderNumber,
        attrs: { tabindex: "0" },
      }),
      element("div", { className: "receipt-actions" }, [copyButton, queryButton]),
      copyFeedback,
    ]),
    element("div", { className: "receipt-time" }, [
      element("p", { className: "receipt-label", text: "下单时间" }),
      element("time", {
        text: formatLocalTimestamp(order.createdAt),
        attrs: { datetime: order.createdAt },
      }),
      element("span", { className: "utc-time", text: `UTC 记录：${order.createdAt}` }),
    ]),
    element("div", { className: "receipt-items" }, [
      element("p", { className: "receipt-label", text: "果子明细" }),
      element("ul", {}, itemLines),
    ]),
    element("p", { className: "receipt-total" }, [
      element("span", { text: "订单合计" }),
      element("strong", { text: formatCny(order.subtotalCents) }),
    ]),
    element("p", { className: "receipt-disclaimer", text: "订单保存在当前浏览器。清除站点数据后无法找回。" }),
  );
}

function renderSuccess() {
  if (checkoutState.status !== "saved" || !checkoutState.receipt) {
    refs.success.hidden = true;
    refs.success.replaceChildren();
    return;
  }

  refs.success.replaceChildren(
    element("p", { className: "section-kicker", text: "ORDER TICKET" }),
    element("h2", { id: "success-title", text: "果子票开好了" }),
    element("p", { className: "receipt-intro", text: "已保存到本浏览器，刷新后仍可按订单号查询。" }),
  );
  appendOrderDetails(refs.success, checkoutState.receipt, "success");
  refs.success.hidden = false;
}

function lookupMessageFor(result) {
  switch (result.status) {
    case "empty":
      return MESSAGES.lookupEmpty;
    case "malformed":
      return MESSAGES.lookupMalformed;
    case "unavailable":
      return MESSAGES.lookupUnavailable;
    case "duplicate":
      return MESSAGES.lookupDuplicate;
    case "not-found":
      return MESSAGES.lookupNotFound;
    case "found":
      return "订单已找到";
    default:
      return MESSAGES.lookupIdle;
  }
}

function renderLookupState() {
  if (lookupState.status === "idle") {
    refs.lookupMessage.textContent = MESSAGES.lookupIdle;
    refs.lookupResult.hidden = true;
    refs.lookupResult.replaceChildren();
    return;
  }

  refs.lookupMessage.textContent = lookupMessageFor(lookupState);
  const title = lookupState.status === "found" ? "订单详情" : "查询结果";
  refs.lookupResult.replaceChildren(
    element("h3", {
      id: "lookup-result-title",
      text: title,
      attrs: { tabindex: "-1" },
    }),
  );

  if (lookupState.status === "found" && lookupState.order) {
    appendOrderDetails(refs.lookupResult, lookupState.order, "lookup");
  }
  refs.lookupResult.hidden = false;
}

function focusLookupResult() {
  const heading = byId("lookup-result-title");
  if (!heading) return;
  heading.focus({ preventScroll: true });
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  requestAnimationFrame(() => {
    heading.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  });
}

function submitLookup() {
  const storage = getStorage();
  const raw = refs.lookupInput.value;
  let frozenResolution = null;

  if (isCartFrozen(checkoutState) && checkoutState.orderNumber) {
    let normalized = "";
    try {
      normalized = normalizeOrderNumber(raw);
    } catch {
      normalized = "";
    }
    if (normalized === checkoutState.orderNumber) {
      const resolved = resolveUnknownCheckout({ state: checkoutState, storage });
      applyUnknownResolution(resolved);
      refreshStorageNotice();
      frozenResolution = resolved;
    }
  }

  lookupState = lookupReducer(lookupState, {
    type: "LOOKUP_RESULT",
    ...performLookup({ input: raw, storage }),
  });
  renderLookupState();
  refreshStorageNotice();
  focusLookupResult();

  if (frozenResolution) {
    if (frozenResolution.status === "saved") {
      setCartLive("订单已确认保存");
    } else if (frozenResolution.status === "absent") {
      setCartLive("已确认订单未保存，可以重新结账");
    } else {
      setCartLive("保存状态仍无法确认，请检查本地订单数据");
    }
  }
}

function applyUnknownResolution(resolved) {
  checkoutState = resolved.state;
  if (resolved.status === "saved") {
    cart.clear();
    quantityErrors.clear();
    clearItemFeedback();
    setCartLive("订单已确认保存，果篮已清空");
  } else if (resolved.status === "absent") {
    setCartLive("已确认订单未保存，可以重新结账");
  }
  renderCart();
  renderCheckoutMessage();
  renderSuccess();
}

function resolveUnknown() {
  const resolvedClass = resolveUnknownCheckout({
    state: checkoutState,
    storage: getStorage(),
  });
  applyUnknownResolution(resolvedClass);
  refreshStorageNotice();
}

function showCheckoutResult(result) {
  checkoutState = result.state;
  if (result.status === "saved") {
    cart.clear();
    quantityErrors.clear();
    clearItemFeedback();
    setCartLive("订单已保存");
  } else if (result.status === "save-unknown") {
    setCartLive(MESSAGES.saveUnknown);
  } else if (result.status !== "number-generation-failed") {
    setCartLive(checkoutMessageText());
  }
  renderCart();
  renderCheckoutMessage();
  renderSuccess();
  refreshStorageNotice();
}

async function checkout() {
  if (cart.size === 0) {
    checkoutState = checkoutReducer(checkoutState, { type: "CHECKOUT_NOT_WRITTEN", code: "cart-empty" });
    renderCheckoutMessage();
    setCartLive(MESSAGES.emptyCart);
    return;
  }
  if (isCartFrozen(checkoutState)) {
    setCartLive(MESSAGES.cartFrozen);
    return;
  }

  checkoutState = checkoutReducer(checkoutState, { type: "CHECKOUT_STARTED" });
  renderCheckoutButton();
  renderCheckoutMessage();
  renderSuccess();

  await new Promise((resolve) => setTimeout(resolve, 0));
  const result = runCheckout({
    cart,
    catalogById,
    storage: getStorage(),
    now: new Date(),
  });
  showCheckoutResult(result);
}

function refreshStorageNotice() {
  const storage = getStorage();
  const result = storage ? readOrders(storage) : { ok: false, code: "storage-unavailable" };
  const lines = [];

  if (!result.ok) {
    if (result.code === "storage-security-blocked") {
      lines.push("浏览器阻止了本地订单存储。请允许本站使用站点数据后刷新。");
    } else if (result.code === "storage-quota-exceeded") {
      lines.push("本地订单存储空间已满。请先导出并检查现有订单数据。");
    } else if (result.code === "storage-read-failed") {
      lines.push("本地订单数据不是文本，无法读取。原始值未被修改。");
    } else {
      lines.push("本地订单存储不可用");
    }
  } else {
    if (result.invalidCount > 0) {
      lines.push(`本地订单数据有损坏，已跳过 ${result.invalidCount} 条。有效订单仍可查询。`);
    }
    if (result.duplicateNumbers.length > 0) {
      lines.push("本地订单数据存在重复订单号。重复订单不会作为查询结果返回。");
    }
  }

  if (lines.length === 0) {
    refs.storageNotice.hidden = true;
    refs.storageNotice.replaceChildren();
    return;
  }

  refs.storageNotice.replaceChildren(
    element("strong", { text: "本地存储提示" }),
    ...lines.map((text) => element("p", { text })),
  );
  refs.storageNotice.hidden = false;
}

function handleLookupInput() {
  lookupState = lookupReducer(lookupState, { type: "INPUT_CHANGED" });
  renderLookupState();
}

function bindEvents() {
  refs.catalog.addEventListener("click", (event) => {
    const addButton = event.target.closest("[data-add]");
    if (addButton) addFruit(addButton.dataset.add);
  });

  refs.cartLines.addEventListener("click", handleCartClick);
  refs.checkout.addEventListener("click", checkout);
  refs.lookupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitLookup();
  });
  refs.lookupInput.addEventListener("input", handleLookupInput);
}

function init() {
  renderCatalog();
  renderCart();
  renderCheckoutMessage();
  renderSuccess();
  renderLookupState();
  refreshStorageNotice();
  bindEvents();

  refs.lookupSubmit.disabled = false;
  refs.bootStatus.textContent = "商品已就绪 · 10 种鲜果";
  document.body.classList.add("is-ready");
  window.__fruitlabBooted = true;
}

try {
  init();
} catch (error) {
  window.__fruitlabShowBootFailure?.();
  console.error("FruitLab initialization failed", error);
}
