import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStatementRow, parseStatementDate } from "../services/transactionValidation.js";

const validRow = {
  bookingDate: "2026-11-26",
  valueDate: "2026-11-27",
  description: "Customer settlement",
  amount: "1250.5000",
  currency: "USD",
  reference: "INV-100",
  counterparty: "Acme Ltd"
};

test("parses strict ISO calendar dates without timezone drift", () => {
  assert.equal(parseStatementDate("2024-02-29")?.toISOString(), "2024-02-29T00:00:00.000Z");
  assert.equal(parseStatementDate("2025-02-29"), null);
  assert.equal(parseStatementDate("26-11-2026"), null);
  assert.equal(parseStatementDate("2026-13-01"), null);
});

test("normalizes a valid inflow and preserves decimal precision", () => {
  const result = normalizeStatementRow(validRow, "USD");
  assert.ok(result.value);
  assert.equal(result.value.amount, "1250.5000");
  assert.equal(result.value.direction, "inflow");
  assert.equal(result.value.currency, "USD");
  assert.equal(result.value.externalReference, "INV-100");
  assert.match(result.value.dedupeKey, /^[a-f0-9]{64}$/);
});

test("normalizes negative amounts as outflows", () => {
  const result = normalizeStatementRow({ ...validRow, amount: "-0.0250" }, "USD");
  assert.ok(result.value);
  assert.equal(result.value.direction, "outflow");
  assert.equal(result.value.amount, "-0.0250");
});

test("rejects zero, malformed, and over-precision amounts", () => {
  for (const amount of ["0", "-0.0000", "12.12345", "1e3", "NaN", "1000000000000000"]) {
    const result = normalizeStatementRow({ ...validRow, amount }, "USD");
    assert.ok(result.errors?.some(error => error.startsWith("amount must be")));
  }
});

test("rejects invalid dates, blank descriptions, and account currency mismatches", () => {
  const result = normalizeStatementRow({
    ...validRow,
    bookingDate: "2026-02-30",
    description: " ",
    currency: "EUR"
  }, "USD");
  assert.ok(result.errors);
  assert.equal(result.errors.length, 3);
});

test("dedupe key is stable for identical rows and changes with material fields", () => {
  const first = normalizeStatementRow(validRow, "USD");
  const same = normalizeStatementRow({ ...validRow, currency: "usd" }, "USD");
  const changed = normalizeStatementRow({ ...validRow, reference: "INV-101" }, "USD");
  assert.ok(first.value && same.value && changed.value);
  assert.equal(first.value.dedupeKey, same.value.dedupeKey);
  assert.notEqual(first.value.dedupeKey, changed.value.dedupeKey);
});

test("trims and bounds optional counterparty and reference values", () => {
  const result = normalizeStatementRow({
    ...validRow,
    counterparty: "  " + "A".repeat(190) + "  ",
    reference: "  " + "R".repeat(170) + "  "
  }, "USD");
  assert.ok(result.value);
  assert.equal(result.value.counterparty?.length, 180);
  assert.equal(result.value.externalReference?.length, 160);
});
