import {
  generateUniqueOrderNumber,
  isOrderNumberFormat,
  lineTotalCents,
  normalizeOrderNumber,
  subtotalCents,
} from "./domain.mjs";
import { appendOrder, readOrders } from "./order-store.mjs";

const DEFAULT_SUFFIX_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function defaultSuffixFactory() {
  let suffix = "";
  for (let index = 0; index < 4; index += 1) {
    suffix += DEFAULT_SUFFIX_ALPHABET[
      Math.floor(Math.random() * DEFAULT_SUFFIX_ALPHABET.length)
    ];
  }
  return suffix;
}

export function createCheckoutState() {
  return {
    status: "idle",
    frozen: false,
    code: null,
    orderNumber: null,
    attemptedOrder: null,
    receipt: null,
  };
}

export function isCartFrozen(state) {
  return Boolean(state?.frozen || state?.status === "save-unknown");
}

export function checkoutReducer(state, event) {
  switch (event.type) {
    case "CART_CHANGED":
      if (isCartFrozen(state)) return state;
      return createCheckoutState();
    case "CHECKOUT_STARTED":
      if (isCartFrozen(state)) return state;
      return {
        ...createCheckoutState(),
        status: "saving",
      };
    case "CHECKOUT_SAVED":
      return {
        ...createCheckoutState(),
        status: "saved",
        code: "order-saved",
        orderNumber: event.order.orderNumber,
        receipt: event.order,
      };
    case "CHECKOUT_NOT_WRITTEN":
      return {
        ...createCheckoutState(),
        status: "not-written",
        code: event.code ?? "storage-write-failed",
      };
    case "CHECKOUT_DUPLICATE":
      return {
        ...createCheckoutState(),
        status: "duplicate-order-number",
        code: event.code ?? "duplicate-order-number",
      };
    case "CHECKOUT_SAVE_UNKNOWN":
      return {
        ...createCheckoutState(),
        status: "save-unknown",
        frozen: true,
        code: event.code ?? "storage-readback-mismatch",
        orderNumber: event.order.orderNumber,
        attemptedOrder: event.order,
      };
    case "CHECKOUT_NUMBER_FAILED":
      return {
        ...createCheckoutState(),
        status: "number-generation-failed",
        code: "order-number-exhausted",
      };
    case "UNKNOWN_INCONCLUSIVE":
      if (!isCartFrozen(state)) return state;
      return {
        ...state,
        code: event.code ?? "save-unknown-inconclusive",
      };
    case "UNKNOWN_ABSENT":
      if (!isCartFrozen(state)) return state;
      return {
        ...createCheckoutState(),
        code: "save-unknown-absent",
      };
    default:
      return state;
  }
}

export function createLookupState() {
  return {
    status: "idle",
    code: null,
    order: null,
    orderNumber: null,
    invalidCount: 0,
    duplicateNumbers: [],
  };
}

export function lookupReducer(state, event) {
  switch (event.type) {
    case "INPUT_CHANGED":
      return createLookupState();
    case "LOOKUP_RESULT":
      return {
        status: event.status,
        code: event.code ?? null,
        order: event.order ?? null,
        orderNumber: event.orderNumber ?? null,
        invalidCount: event.invalidCount ?? 0,
        duplicateNumbers: event.duplicateNumbers ?? [],
      };
    default:
      return state;
  }
}

export function createCartItems(cart, catalogById) {
  if (!(cart instanceof Map)) {
    throw new TypeError("createCartItems requires a Map");
  }
  if (!(catalogById instanceof Map)) {
    throw new TypeError("createCartItems requires a catalog Map");
  }

  const items = [];
  for (const [fruitId, quantity] of cart) {
    const fruit = catalogById.get(fruitId);
    if (!fruit) {
      throw new TypeError(`unknown fruit: ${fruitId}`);
    }
    const lineTotal = lineTotalCents(fruit.unitPriceCents, quantity);
    items.push(Object.freeze({
      fruitId: fruit.id,
      name: fruit.name,
      unit: fruit.unit,
      unitPriceCents: fruit.unitPriceCents,
      quantity,
      lineTotalCents: lineTotal,
    }));
  }
  return Object.freeze(items);
}

function createOrderSnapshot({ items, now, orderNumber }) {
  return Object.freeze({
    orderNumber,
    createdAt: now.toISOString(),
    currency: "CNY",
    subtotalCents: subtotalCents(items),
    items,
  });
}

export function runCheckout({
  cart,
  catalogById,
  storage,
  now = new Date(),
  suffixFactory = defaultSuffixFactory,
}) {
  if (!(cart instanceof Map) || cart.size === 0) {
    return {
      status: "empty-cart",
      code: "cart-empty",
      state: createCheckoutState(),
    };
  }

  let items;
  try {
    items = createCartItems(cart, catalogById);
  } catch {
    return {
      status: "not-written",
      code: "domain-invalid-order",
      state: checkoutReducer(createCheckoutState(), {
        type: "CHECKOUT_NOT_WRITTEN",
        code: "domain-invalid-order",
      }),
    };
  }

  const latest = readOrders(storage);
  if (!latest.ok) {
    return {
      status: "not-written",
      code: latest.code,
      state: checkoutReducer(createCheckoutState(), {
        type: "CHECKOUT_NOT_WRITTEN",
        code: latest.code,
      }),
    };
  }

  const taken = new Set(latest.orders.map((order) => normalizeOrderNumber(order.orderNumber)));
  const orderNumber = generateUniqueOrderNumber({
    now,
    suffixFactory,
    isTaken: (candidate) => taken.has(candidate),
  });

  if (!orderNumber) {
    return {
      status: "number-generation-failed",
      code: "order-number-exhausted",
      state: checkoutReducer(createCheckoutState(), {
        type: "CHECKOUT_NUMBER_FAILED",
      }),
    };
  }

  const order = createOrderSnapshot({ items, now, orderNumber });
  const result = appendOrder(storage, order);

  if (result.status === "saved") {
    return {
      status: "saved",
      code: result.code,
      order,
      state: checkoutReducer(createCheckoutState(), {
        type: "CHECKOUT_SAVED",
        order,
      }),
    };
  }
  if (result.status === "duplicate-order-number") {
    return {
      status: "duplicate-order-number",
      code: result.code,
      state: checkoutReducer(createCheckoutState(), {
        type: "CHECKOUT_DUPLICATE",
        code: result.code,
      }),
    };
  }
  if (result.status === "save-unknown") {
    return {
      status: "save-unknown",
      code: result.code,
      order,
      state: checkoutReducer(createCheckoutState(), {
        type: "CHECKOUT_SAVE_UNKNOWN",
        code: result.code,
        order,
      }),
    };
  }
  return {
    status: "not-written",
    code: result.code,
    state: checkoutReducer(createCheckoutState(), {
      type: "CHECKOUT_NOT_WRITTEN",
      code: result.code,
    }),
  };
}

export function performLookup({ input, storage }) {
  if (typeof input !== "string") {
    return { status: "malformed", code: "lookup-malformed" };
  }
  const trimmed = input.trim();
  if (trimmed === "") {
    return { status: "empty", code: "lookup-empty" };
  }

  const orderNumber = normalizeOrderNumber(trimmed);
  if (!isOrderNumberFormat(orderNumber)) {
    return { status: "malformed", code: "lookup-malformed" };
  }

  const result = readOrders(storage);
  if (!result.ok) {
    return {
      status: "unavailable",
      code: result.code,
      orderNumber,
    };
  }

  if (result.duplicateNumbers.includes(orderNumber)) {
    return {
      status: "duplicate",
      code: "duplicate-order-number",
      orderNumber,
      invalidCount: result.invalidCount,
      duplicateNumbers: result.duplicateNumbers,
    };
  }

  const order = result.orders.find((candidate) => candidate.orderNumber === orderNumber);
  if (!order) {
    return {
      status: "not-found",
      code: "lookup-not-found",
      orderNumber,
      invalidCount: result.invalidCount,
      duplicateNumbers: result.duplicateNumbers,
    };
  }

  return {
    status: "found",
    code: "lookup-found",
    orderNumber,
    order,
    invalidCount: result.invalidCount,
    duplicateNumbers: result.duplicateNumbers,
  };
}

function ordersEqual(left, right) {
  if (!left || !right || left.items.length !== right.items.length) return false;
  if (
    left.orderNumber !== right.orderNumber ||
    left.createdAt !== right.createdAt ||
    left.currency !== right.currency ||
    left.subtotalCents !== right.subtotalCents
  ) {
    return false;
  }

  return left.items.every((item, index) => {
    const other = right.items[index];
    return (
      item.fruitId === other.fruitId &&
      item.name === other.name &&
      item.unit === other.unit &&
      item.unitPriceCents === other.unitPriceCents &&
      item.quantity === other.quantity &&
      item.lineTotalCents === other.lineTotalCents
    );
  });
}

export function resolveUnknownCheckout({ state, storage }) {
  if (state?.status !== "save-unknown" || !state.attemptedOrder) {
    return { status: "not-applicable", state };
  }

  const result = readOrders(storage);
  if (!result.ok) {
    return {
      status: "unavailable",
      code: result.code,
      state: checkoutReducer(state, {
        type: "UNKNOWN_INCONCLUSIVE",
        code: result.code,
      }),
    };
  }

  const orderNumber = normalizeOrderNumber(state.attemptedOrder.orderNumber);
  if (result.duplicateNumbers.includes(orderNumber)) {
    return {
      status: "duplicate",
      code: "duplicate-order-number",
      state: checkoutReducer(state, {
        type: "UNKNOWN_INCONCLUSIVE",
        code: "duplicate-order-number",
      }),
    };
  }

  const found = result.orders.find((order) => order.orderNumber === orderNumber);
  if (found) {
    if (!ordersEqual(found, state.attemptedOrder)) {
      return {
        status: "inconclusive",
        code: "save-unknown-mismatch",
        state: checkoutReducer(state, {
          type: "UNKNOWN_INCONCLUSIVE",
          code: "save-unknown-mismatch",
        }),
      };
    }
    return {
      status: "saved",
      code: "order-saved",
      order: found,
      state: checkoutReducer(state, {
        type: "CHECKOUT_SAVED",
        order: found,
      }),
    };
  }

  if (result.invalidCount > 0 || result.duplicateNumbers.length > 0) {
    return {
      status: "inconclusive",
      code: "save-unknown-unhealthy-storage",
      state: checkoutReducer(state, {
        type: "UNKNOWN_INCONCLUSIVE",
        code: "save-unknown-unhealthy-storage",
      }),
    };
  }

  return {
    status: "absent",
    code: "save-unknown-absent",
    state: checkoutReducer(state, { type: "UNKNOWN_ABSENT" }),
  };
}

