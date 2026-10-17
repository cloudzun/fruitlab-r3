import test from "node:test";
import assert from "node:assert/strict";

import {
  ORDER_KEY,
  appendOrder,
  readOrders,
} from "../assets/order-store.mjs";

const ORDER_NUMBER = "FL-20261017-131500-A7K2";

function makeOrder(orderNumber = ORDER_NUMBER) {
  return {
    orderNumber,
    createdAt: "2026-10-17T05:15:00.000Z",
    currency: "CNY",
    subtotalCents: 1299,
    items: [
      {
        fruitId: "fuji-apple",
        name: "红富士苹果",
        unit: "500g",
        unitPriceCents: 1299,
        quantity: 1,
        lineTotalCents: 1299,
      },
    ],
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
    this.nonStringRead = false;
    this.getError = null;
    this.setError = null;
  }

  getItem(key) {
    assert.equal(key, ORDER_KEY);
    this.getCount += 1;
    if (this.throwGet) throw this.getError ?? new Error("storage blocked");
    if (this.throwReadback && this.writeCount > 0) throw new Error("readback blocked");
    if (this.nonStringRead) return 42;
    if (this.staleReadback && this.writeCount > 0) return this.staleValue;
    return this.value;
  }

  setItem(key, value) {
    assert.equal(key, ORDER_KEY);
    if (this.throwSet) throw this.setError ?? new Error("quota exceeded");
    if (this.staleReadback) this.staleValue = this.value;
    this.value = value;
    this.writeCount += 1;
  }
}

test("readOrders treats null as empty and never writes", () => {
  const storage = new FakeStorage(null);
  const result = readOrders(storage);

  assert.equal(result.ok, true);
  assert.equal(result.raw, "");
  assert.deepEqual(result.orders, []);
  assert.equal(result.invalidCount, 0);
  assert.deepEqual(result.duplicateNumbers, []);
  assert.equal(storage.writeCount, 0);
});

test("readOrders returns valid orders, corrupt count, and duplicate numbers without mutation", () => {
  const valid = JSON.stringify(makeOrder());
  const duplicate = JSON.stringify(makeOrder());
  const storage = new FakeStorage([valid, "{bad", duplicate].join("\n"));

  const result = readOrders(storage);
  assert.equal(result.ok, true);
  assert.equal(result.orders.length, 2);
  assert.equal(result.invalidCount, 1);
  assert.deepEqual(result.duplicateNumbers, [ORDER_NUMBER]);
  assert.equal(storage.writeCount, 0);
  assert.equal(storage.value, [valid, "{bad", duplicate].join("\n"));
});

test("readOrders reports unavailable storage and invalid storage values", () => {
  const blocked = new FakeStorage(null);
  blocked.throwGet = true;
  assert.deepEqual(
    { ok: readOrders(blocked).ok, code: readOrders(blocked).code },
    { ok: false, code: "storage-unavailable" },
  );

  const nonString = new FakeStorage(null);
  nonString.nonStringRead = true;
  assert.equal(readOrders(nonString).code, "storage-read-failed");
});

test("appendOrder to empty storage writes one newline-terminated line", () => {
  const storage = new FakeStorage(null);
  const order = makeOrder();
  const result = appendOrder(storage, order);

  assert.equal(result.status, "saved");
  assert.equal(storage.value, `${JSON.stringify(order)}\n`);
  assert.equal(result.expectedRaw, storage.value);
});

test("appendOrder preserves every old byte as a prefix", () => {
  const oldOrder = makeOrder("FL-20261017-120000-B2C3");
  const oldRaw = `${JSON.stringify(oldOrder)}\n{bad line without newline`;
  const storage = new FakeStorage(oldRaw);
  const order = makeOrder();
  const result = appendOrder(storage, order);

  assert.equal(result.status, "saved");
  assert.equal(storage.value.startsWith(oldRaw), true);
  assert.equal(storage.value.endsWith(`${JSON.stringify(order)}\n`), true);
  assert.equal(readOrders(storage).invalidCount, 1);
});

test("appendOrder rejects duplicate order numbers without writing", () => {
  const order = makeOrder();
  const storage = new FakeStorage(JSON.stringify(order));
  const result = appendOrder(storage, order);

  assert.equal(result.status, "duplicate-order-number");
  assert.equal(result.code, "duplicate-order-number");
  assert.equal(storage.writeCount, 0);
});

test("appendOrder maps pre-write access failures to not-written", () => {
  const storage = new FakeStorage(null);
  storage.throwGet = true;
  const result = appendOrder(storage, makeOrder());

  assert.equal(result.status, "not-written");
  assert.equal(result.code, "storage-unavailable");
  assert.equal(storage.writeCount, 0);
});

test("appendOrder maps setItem failures to not-written and leaves storage unchanged", () => {
  const storage = new FakeStorage(null);
  storage.throwSet = true;
  const result = appendOrder(storage, makeOrder());

  assert.equal(result.status, "not-written");
  assert.equal(result.code, "storage-write-failed");
  assert.equal(storage.value, null);
});

test("readOrders and appendOrder keep distinct security and quota codes", () => {
  const blocked = new FakeStorage(null);
  blocked.throwGet = true;
  blocked.getError = new DOMException("blocked", "SecurityError");
  assert.equal(readOrders(blocked).code, "storage-security-blocked");

  const quota = new FakeStorage(null);
  quota.throwSet = true;
  quota.setError = new DOMException("quota", "QuotaExceededError");
  const result = appendOrder(quota, makeOrder());
  assert.equal(result.status, "not-written");
  assert.equal(result.code, "storage-quota-exceeded");
  assert.equal(quota.value, null);
});

test("appendOrder maps readback throws to save-unknown", () => {
  const storage = new FakeStorage(null);
  storage.throwReadback = true;
  const result = appendOrder(storage, makeOrder());

  assert.equal(result.status, "save-unknown");
  assert.equal(result.code, "storage-readback-failed");
  assert.equal(storage.writeCount, 1);
});

test("appendOrder maps stale readback to save-unknown", () => {
  const storage = new FakeStorage("old raw");
  storage.staleReadback = true;
  const result = appendOrder(storage, makeOrder());

  assert.equal(result.status, "save-unknown");
  assert.equal(result.code, "storage-readback-mismatch");
  assert.equal(storage.value.startsWith("old raw\n"), true);
});

test("appendOrder maps non-text and non-unique readback to save-unknown", () => {
  class NonTextAfterWriteStorage extends FakeStorage {
    getItem(key) {
      if (this.writeCount > 0) {
        assert.equal(key, ORDER_KEY);
        return 42;
      }
      return super.getItem(key);
    }
  }

  const nonText = new NonTextAfterWriteStorage(null);
  const nonTextResult = appendOrder(nonText, makeOrder());
  assert.equal(nonTextResult.status, "save-unknown");
  assert.equal(nonTextResult.code, "storage-readback-failed");

  class DuplicateReadbackStorage extends FakeStorage {
    getItem(key) {
      if (this.writeCount > 0) {
        assert.equal(key, ORDER_KEY);
        return `${this.value}${JSON.stringify(makeOrder())}\n`;
      }
      return super.getItem(key);
    }
  }

  const duplicate = new DuplicateReadbackStorage(null);
  const duplicateResult = appendOrder(duplicate, makeOrder());
  assert.equal(duplicateResult.status, "save-unknown");
  assert.equal(duplicateResult.code, "storage-readback-duplicate");
});
