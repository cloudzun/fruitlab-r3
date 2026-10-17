const QUANTITY_ERROR = "数量必须是 1-99 的整数";
const ORDER_NUMBER_PATTERN = /^FL-\d{8}-\d{6}-[A-Z0-9]{4}$/;
const FRUIT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_ITEMS = 10;
const MAX_LINE_LENGTH = 16_384;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isQuantity(value) {
  return Number.isInteger(value) && value >= 1 && value <= 99;
}

function fallbackQuantity(previousQuantity) {
  return isQuantity(previousQuantity) ? previousQuantity : 1;
}

function normalizeSuffix(value) {
  const suffix = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(suffix)) {
    throw new TypeError("randomSuffix must contain exactly 4 letters or digits");
  }
  return suffix;
}

function twoDigits(value) {
  return String(value).padStart(2, "0");
}

export function parseQuantity(raw, previousQuantity) {
  const fallback = fallbackQuantity(previousQuantity);
  const text = typeof raw === "string" ? raw.trim() : "";

  if (!/^\d+$/.test(text)) {
    return { quantity: fallback, error: QUANTITY_ERROR };
  }

  const quantity = Number(text);
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    return { quantity: fallback, error: QUANTITY_ERROR };
  }
  if (quantity > 99) {
    return { quantity: 99, error: QUANTITY_ERROR };
  }
  return { quantity, error: "" };
}

export function lineTotalCents(unitPriceCents, quantity) {
  if (!isPositiveSafeInteger(unitPriceCents) || !isQuantity(quantity)) {
    throw new TypeError("lineTotalCents requires a positive safe integer price and quantity 1-99");
  }
  const total = unitPriceCents * quantity;
  if (!Number.isSafeInteger(total)) {
    throw new TypeError("line total exceeds safe integer range");
  }
  return total;
}

export function subtotalCents(items) {
  if (!Array.isArray(items)) {
    throw new TypeError("subtotalCents requires an array");
  }

  let subtotal = 0;
  for (const item of items) {
    if (!isPlainObject(item)) {
      throw new TypeError("subtotalCents items must be objects");
    }
    const total = lineTotalCents(item.unitPriceCents, item.quantity);
    subtotal += total;
    if (!Number.isSafeInteger(subtotal)) {
      throw new TypeError("subtotal exceeds safe integer range");
    }
  }
  return subtotal;
}

export function formatCny(cents) {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new TypeError("formatCny requires a non-negative safe integer");
  }
  return `¥${Math.floor(cents / 100)}.${twoDigits(cents % 100)}`;
}

export function normalizeOrderNumber(input) {
  if (typeof input !== "string") {
    throw new TypeError("normalizeOrderNumber requires a string");
  }
  return input.trim().toUpperCase();
}

export function isOrderNumberFormat(value) {
  return typeof value === "string" && ORDER_NUMBER_PATTERN.test(value);
}

export function createOrderNumber(now, randomSuffix) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("createOrderNumber requires a valid Date");
  }

  const date = `${now.getFullYear()}${twoDigits(now.getMonth() + 1)}${twoDigits(now.getDate())}`;
  const time = `${twoDigits(now.getHours())}${twoDigits(now.getMinutes())}${twoDigits(now.getSeconds())}`;
  return `FL-${date}-${time}-${normalizeSuffix(randomSuffix)}`;
}

export function generateUniqueOrderNumber({ now, suffixFactory, isTaken }) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("generateUniqueOrderNumber requires a valid Date");
  }
  if (typeof suffixFactory !== "function" || typeof isTaken !== "function") {
    throw new TypeError("generateUniqueOrderNumber requires suffixFactory and isTaken functions");
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const orderNumber = createOrderNumber(now, suffixFactory());
    if (!isTaken(orderNumber)) {
      return orderNumber;
    }
  }
  return null;
}

export function validateOrder(value) {
  const errors = [];
  if (!isPlainObject(value)) {
    return { valid: false, errors: ["order must be an object"] };
  }

  if (!isOrderNumberFormat(value.orderNumber)) {
    errors.push("orderNumber has an invalid format");
  }
  if (
    typeof value.createdAt !== "string" ||
    Number.isNaN(Date.parse(value.createdAt)) ||
    new Date(value.createdAt).toISOString() !== value.createdAt
  ) {
    errors.push("createdAt must be a canonical ISO timestamp");
  }
  if (value.currency !== "CNY") {
    errors.push("currency must be CNY");
  }
  if (!Array.isArray(value.items) || value.items.length < 1 || value.items.length > MAX_ITEMS) {
    errors.push(`items must contain 1-${MAX_ITEMS} entries`);
    return { valid: false, errors };
  }

  const fruitIds = new Set();
  let computedSubtotal = 0;

  for (const [index, item] of value.items.entries()) {
    if (!isPlainObject(item)) {
      errors.push(`items[${index}] must be an object`);
      continue;
    }

    if (
      typeof item.fruitId !== "string" ||
      item.fruitId.length < 1 ||
      item.fruitId.length > 64 ||
      !FRUIT_ID_PATTERN.test(item.fruitId)
    ) {
      errors.push(`items[${index}].fruitId is invalid`);
    } else if (fruitIds.has(item.fruitId)) {
      errors.push(`items[${index}].fruitId is duplicated`);
    } else {
      fruitIds.add(item.fruitId);
    }

    if (typeof item.name !== "string" || item.name.length < 1 || item.name.length > 80) {
      errors.push(`items[${index}].name is invalid`);
    }
    if (typeof item.unit !== "string" || item.unit.length < 1 || item.unit.length > 32) {
      errors.push(`items[${index}].unit is invalid`);
    }
    if (!isPositiveSafeInteger(item.unitPriceCents)) {
      errors.push(`items[${index}].unitPriceCents is invalid`);
    }
    if (!isQuantity(item.quantity)) {
      errors.push(`items[${index}].quantity is invalid`);
    }
    if (!isPositiveSafeInteger(item.lineTotalCents)) {
      errors.push(`items[${index}].lineTotalCents is invalid`);
    }

    if (
      isPositiveSafeInteger(item.unitPriceCents) &&
      isQuantity(item.quantity) &&
      isPositiveSafeInteger(item.lineTotalCents)
    ) {
      const expected = item.unitPriceCents * item.quantity;
      if (!Number.isSafeInteger(expected) || expected !== item.lineTotalCents) {
        errors.push(`items[${index}].lineTotalCents does not match price x quantity`);
      } else {
        computedSubtotal += item.lineTotalCents;
        if (!Number.isSafeInteger(computedSubtotal)) {
          errors.push("subtotal exceeds safe integer range");
        }
      }
    }
  }

  if (!isPositiveSafeInteger(value.subtotalCents)) {
    errors.push("subtotalCents is invalid");
  } else if (computedSubtotal !== value.subtotalCents) {
    errors.push("subtotalCents does not match item totals");
  }

  return { valid: errors.length === 0, errors };
}

export function parseOrdersRaw(raw) {
  if (typeof raw !== "string") {
    throw new TypeError("parseOrdersRaw requires a string");
  }

  const orders = [];
  const counts = new Map();
  let invalidCount = 0;

  for (const line of raw.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    if (line.length > MAX_LINE_LENGTH) {
      invalidCount += 1;
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      invalidCount += 1;
      continue;
    }

    if (!validateOrder(parsed).valid) {
      invalidCount += 1;
      continue;
    }

    const normalized = normalizeOrderNumber(parsed.orderNumber);
    orders.push({ ...parsed, orderNumber: normalized });
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  const duplicateNumbers = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([orderNumber]) => orderNumber)
    .sort();

  return { orders, invalidCount, duplicateNumbers };
}

export function serializeOrder(order) {
  if (!validateOrder(order).valid) {
    throw new TypeError("serializeOrder requires a valid order");
  }
  const line = JSON.stringify(order);
  if (line.length > MAX_LINE_LENGTH) {
    throw new TypeError("serialized order exceeds the line limit");
  }
  return line;
}

export const limits = Object.freeze({
  maxItems: MAX_ITEMS,
  maxLineLength: MAX_LINE_LENGTH,
});
