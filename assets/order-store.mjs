import {
  normalizeOrderNumber,
  parseOrdersRaw,
  serializeOrder,
} from "./domain.mjs";

export const ORDER_KEY = "fruitlab.orders.v1";

function storageErrorCode(error, fallback) {
  const name = String(error?.name ?? "");
  if (/quota/i.test(name)) return "storage-quota-exceeded";
  if (/security/i.test(name)) return "storage-security-blocked";
  return fallback;
}

export function readOrders(storage) {
  if (!storage || typeof storage.getItem !== "function") {
    return {
      ok: false,
      code: "storage-unavailable",
      error: "localStorage is unavailable",
    };
  }

  let raw;
  try {
    raw = storage.getItem(ORDER_KEY);
  } catch (error) {
    return {
      ok: false,
      code: storageErrorCode(error, "storage-unavailable"),
      error: "localStorage access failed",
    };
  }

  if (raw === null) raw = "";
  if (typeof raw !== "string") {
    return {
      ok: false,
      code: "storage-read-failed",
      error: "stored order data is not text",
    };
  }

  const parsed = parseOrdersRaw(raw);
  return { ok: true, raw, ...parsed };
}

function countOrderNumber(orders, orderNumber) {
  return orders.filter((order) => normalizeOrderNumber(order.orderNumber) === orderNumber).length;
}

export function appendOrder(storage, order) {
  const current = readOrders(storage);
  if (!current.ok) {
    return {
      status: "not-written",
      code: current.code,
      error: current.error,
    };
  }

  let line;
  try {
    line = serializeOrder(order);
  } catch {
    return {
      status: "not-written",
      code: "domain-invalid-order",
      error: "the order did not pass domain validation",
    };
  }

  const orderNumber = normalizeOrderNumber(order.orderNumber);
  if (current.orders.some((stored) => stored.orderNumber === orderNumber)) {
    return {
      status: "duplicate-order-number",
      code: "duplicate-order-number",
      error: "order number already exists",
        raw: current.raw,
    };
  }

  const prefix = current.raw;
  const separator = prefix !== "" && !prefix.endsWith("\n") ? "\n" : "";
  const expectedRaw = `${prefix}${separator}${line}\n`;

  try {
    storage.setItem(ORDER_KEY, expectedRaw);
  } catch (error) {
    return {
      status: "not-written",
      code: storageErrorCode(error, "storage-write-failed"),
      error: "localStorage write failed",
      raw: prefix,
    };
  }

  let actualRaw;
  try {
    actualRaw = storage.getItem(ORDER_KEY);
  } catch {
    return {
      status: "save-unknown",
      code: "storage-readback-failed",
      error: "the write may have happened but readback failed",
      expectedRaw,
      raw: null,
    };
  }

  if (typeof actualRaw !== "string") {
    return {
      status: "save-unknown",
      code: "storage-readback-failed",
      error: "the write may have happened but readback was not text",
      expectedRaw,
      raw: null,
    };
  }

  if (actualRaw !== expectedRaw) {
    const readback = parseOrdersRaw(actualRaw);
    const occurrences = countOrderNumber(readback.orders, orderNumber);
    return {
      status: "save-unknown",
      code: occurrences > 1 ? "storage-readback-duplicate" : "storage-readback-mismatch",
      error: "the write may have happened but readback did not match",
      expectedRaw,
      raw: actualRaw,
    };
  }

  const readback = parseOrdersRaw(actualRaw);
  const occurrences = countOrderNumber(readback.orders, orderNumber);
  if (occurrences !== 1) {
    return {
      status: "save-unknown",
      code: occurrences > 1 ? "storage-readback-duplicate" : "storage-readback-invalid",
      error: "the appended order could not be verified uniquely",
      expectedRaw,
      raw: actualRaw,
    };
  }

  return {
    status: "saved",
    code: "order-saved",
    expectedRaw,
    raw: actualRaw,
    order,
  };
}
