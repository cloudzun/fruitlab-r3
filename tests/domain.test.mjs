import test from "node:test";
import assert from "node:assert/strict";

import { FRUITS, catalogById } from "../assets/catalog.mjs";
import {
  createOrderNumber,
  formatCny,
  generateUniqueOrderNumber,
  isOrderNumberFormat,
  lineTotalCents,
  normalizeOrderNumber,
  parseOrdersRaw,
  parseQuantity,
  serializeOrder,
  subtotalCents,
  validateOrder,
} from "../assets/domain.mjs";

const VALID_ORDER_NUMBER = "FL-20261017-131500-A7K2";

function makeOrder(overrides = {}) {
  return {
    orderNumber: VALID_ORDER_NUMBER,
    createdAt: "2026-10-17T05:15:00.000Z",
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

test("catalog: 10 unique fruits with positive integer-cent prices", () => {
  assert.equal(FRUITS.length, 10);
  assert.equal(new Set(FRUITS.map((fruit) => fruit.id)).size, 10);

  for (const fruit of FRUITS) {
    assert.equal(typeof fruit.name, "string");
    assert.equal(typeof fruit.unit, "string");
    assert.equal(typeof fruit.description, "string");
    assert.equal(Number.isSafeInteger(fruit.unitPriceCents), true);
    assert.ok(fruit.unitPriceCents > 0);
  }

  assert.deepEqual(
    FRUITS.map(({ id, unitPriceCents }) => [id, unitPriceCents]),
    [
      ["fuji-apple", 1299],
      ["banana", 899],
      ["navel-orange", 1599],
      ["shine-muscat", 2999],
      ["golden-pineapple", 1999],
      ["durian", 4999],
      ["hami-melon", 2599],
      ["peach", 1899],
      ["blueberry", 2199],
      ["red-dragon-fruit", 1399],
    ],
  );
});

test("parseQuantity: accepts integers from 1 through 99", () => {
  assert.deepEqual(parseQuantity("1", 7), { quantity: 1, error: "" });
  assert.deepEqual(parseQuantity(" 99 ", 7), { quantity: 99, error: "" });
  assert.deepEqual(parseQuantity("07", 7), { quantity: 7, error: "" });
});

test("parseQuantity: rejects empty, negative, decimal, text, and zero", () => {
  for (const raw of ["", " ", "-1", "0", "1.5", "abc", "1e2"]) {
    assert.deepEqual(parseQuantity(raw, 5), {
      quantity: 5,
      error: "数量必须是 1-99 的整数",
    });
  }
});

test("parseQuantity: clamps values over 99 and reports the required error", () => {
  assert.deepEqual(parseQuantity("100", 5), {
    quantity: 99,
    error: "数量必须是 1-99 的整数",
  });
});

test("lineTotalCents and subtotalCents use integer cents and reject bad input", () => {
  assert.equal(lineTotalCents(1299, 2), 2598);
  assert.equal(subtotalCents([{ unitPriceCents: 1299, quantity: 2 }, { unitPriceCents: 899, quantity: 1 }]), 3497);
  assert.equal(subtotalCents([]), 0);

  assert.throws(() => lineTotalCents("1299", 2), TypeError);
  assert.throws(() => lineTotalCents(1299, 0), TypeError);
  assert.throws(() => lineTotalCents(Number.MAX_SAFE_INTEGER, 2), TypeError);
  assert.throws(() => subtotalCents({}), TypeError);
});

test("formatCny: fixed two decimals without thousands separators", () => {
  assert.equal(formatCny(1299), "¥12.99");
  assert.equal(formatCny(3117), "¥31.17");
  assert.equal(formatCny(5), "¥0.05");
  assert.throws(() => formatCny(1.5), TypeError);
});

test("order number helpers normalize and validate the fixed format", () => {
  assert.equal(normalizeOrderNumber("  fl-20261017-131500-a7k2  "), VALID_ORDER_NUMBER);
  assert.equal(isOrderNumberFormat(VALID_ORDER_NUMBER), true);
  assert.equal(isOrderNumberFormat("FL-20261017-131500-A7K"), false);
  assert.equal(isOrderNumberFormat("fs-20261017-131500-A7K2"), false);
  assert.equal(isOrderNumberFormat(42), false);
});

test("createOrderNumber uses local date/time and accepts only a strict four-character suffix", () => {
  const localNow = new Date(2026, 9, 17, 13, 15, 0);
  assert.equal(createOrderNumber(localNow, "  a7k2  "), "FL-20261017-131500-A7K2");
  for (const invalid of ["x", "A-7K2", "A7K2X", "", null, 42]) {
    assert.throws(() => createOrderNumber(localNow, invalid), {
      name: "TypeError",
      message: "randomSuffix must contain exactly 4 letters or digits",
    });
  }
});

test("generateUniqueOrderNumber retries collisions and stops after 10 attempts", () => {
  const suffixes = ["A001", "A002", "A003"];
  let calls = 0;
  const result = generateUniqueOrderNumber({
    now: new Date(2026, 9, 17, 13, 15, 0),
    suffixFactory: () => suffixes[calls++],
    isTaken: (number) => number.endsWith("A001") || number.endsWith("A002"),
  });

  assert.equal(result, "FL-20261017-131500-A003");
  assert.equal(calls, 3);

  let exhaustedCalls = 0;
  const exhausted = generateUniqueOrderNumber({
    now: new Date(2026, 9, 17, 13, 15, 0),
    suffixFactory: () => `B${String(exhaustedCalls++).padStart(3, "0")}`,
    isTaken: () => true,
  });

  assert.equal(exhausted, null);
  assert.equal(exhaustedCalls, 10);
});

test("validateOrder accepts a catalog-consistent snapshot", () => {
  assert.deepEqual(validateOrder(makeOrder()), { valid: true, errors: [] });
});

test("validateOrder rejects malformed dates, currency, quantities, totals, and duplicates", () => {
  const cases = [
    makeOrder({ createdAt: "not-a-date" }),
    makeOrder({ currency: "USD" }),
    makeOrder({ subtotalCents: 3496 }),
    makeOrder({ items: [] }),
    makeOrder({
      items: [
        makeOrder().items[0],
        { ...makeOrder().items[1], fruitId: "fuji-apple" },
      ],
    }),
    makeOrder({
      items: [{ ...makeOrder().items[0], quantity: 0, lineTotalCents: 0 }],
      subtotalCents: 0,
    }),
    makeOrder({
      items: [{ ...makeOrder().items[0], lineTotalCents: 2597 }],
      subtotalCents: 2597,
    }),
  ];

  for (const order of cases) {
    assert.equal(validateOrder(order).valid, false);
  }
});

test("validateOrder enforces untrusted record bounds", () => {
  const elevenItems = Array.from({ length: 11 }, (_, index) => ({
    fruitId: `fruit-${index}`,
    name: "果子",
    unit: "1个",
    unitPriceCents: 100,
    quantity: 1,
    lineTotalCents: 100,
  }));

  assert.equal(
    validateOrder(makeOrder({ items: elevenItems, subtotalCents: 1100 })).valid,
    false,
  );
  assert.equal(
    validateOrder(makeOrder({
      items: [{ ...makeOrder().items[0], fruitId: "Bad_ID" }],
      subtotalCents: 2598,
    })).valid,
    false,
  );
  assert.equal(
    validateOrder(makeOrder({
      items: [{ ...makeOrder().items[0], name: "果".repeat(81) }],
      subtotalCents: 2598,
    })).valid,
    false,
  );
  assert.equal(
    validateOrder(makeOrder({
      items: [{ ...makeOrder().items[0], unit: "单".repeat(33) }],
      subtotalCents: 2598,
    })).valid,
    false,
  );
});

test("parseOrdersRaw skips bad lines and reports duplicate normalized order numbers", () => {
  const duplicate = makeOrder();
  const raw = [
    JSON.stringify(makeOrder()),
    "",
    "{broken json",
    JSON.stringify({ ...duplicate, currency: "USD" }),
    JSON.stringify(duplicate),
    "x".repeat(16_385),
    "",
  ].join("\n");

  const parsed = parseOrdersRaw(raw);
  assert.equal(parsed.orders.length, 2);
  assert.equal(parsed.invalidCount, 3);
  assert.deepEqual(parsed.duplicateNumbers, [VALID_ORDER_NUMBER]);
});

test("parseOrdersRaw handles empty storage and non-string input", () => {
  assert.deepEqual(parseOrdersRaw(""), {
    orders: [],
    invalidCount: 0,
    duplicateNumbers: [],
  });
  assert.throws(() => parseOrdersRaw(null), TypeError);
});

test("parseOrdersRaw accepts CRLF and a missing final newline while skipping invalid lines", () => {
  const first = makeOrder();
  const second = makeOrder({ orderNumber: "FL-20261017-120000-B2C3" });
  const raw = `${JSON.stringify(first)}\r\n{bad}\r\n${JSON.stringify(second)}`;

  const parsed = parseOrdersRaw(raw);
  assert.deepEqual(parsed.orders.map((order) => order.orderNumber), [
    VALID_ORDER_NUMBER,
    "FL-20261017-120000-B2C3",
  ]);
  assert.equal(parsed.invalidCount, 1);
  assert.deepEqual(parsed.duplicateNumbers, []);
});

test("serializeOrder returns one JSON line and refuses invalid orders", () => {
  const line = serializeOrder(makeOrder());
  assert.equal(line.includes("\n"), false);
  assert.deepEqual(JSON.parse(line), makeOrder());
  assert.throws(() => serializeOrder(makeOrder({ currency: "USD" })), TypeError);

  const newlineOrder = makeOrder({
    items: [{ ...makeOrder().items[0], name: "红富士\n苹果" }],
    subtotalCents: 2598,
  });
  const escaped = serializeOrder(newlineOrder);
  assert.equal(escaped.includes("\n"), false);
  assert.equal(JSON.parse(escaped).items[0].name, "红富士\n苹果");
});

test("documented sample is valid and totals 3497 cents", () => {
  const order = makeOrder();
  assert.equal(subtotalCents(order.items), order.subtotalCents);
  for (const item of order.items) {
    assert.equal(catalogById.get(item.fruitId)?.unitPriceCents, item.unitPriceCents);
    assert.equal(catalogById.get(item.fruitId)?.unit, item.unit);
    assert.equal(catalogById.get(item.fruitId)?.name, item.name);
  }
  assert.equal(order.subtotalCents, 3497);
  assert.equal(formatCny(order.subtotalCents), "¥34.97");
  assert.equal(validateOrder(order).valid, true);
});
