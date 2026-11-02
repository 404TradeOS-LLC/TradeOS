import assert from "node:assert/strict";
import test from "node:test";
import { dollarsToCents, expenseCategoryLabel, formatCentsUsd } from "./job-expenses.ts";

test("dollars convert to integer cents exactly, rounding once", () => {
  assert.equal(dollarsToCents("19.99"), 1999);
  assert.equal(dollarsToCents("0.01"), 1);
  assert.equal(dollarsToCents("100"), 10000);
  assert.equal(dollarsToCents("10.005"), null);
  assert.equal(dollarsToCents("0"), null);
  assert.equal(dollarsToCents("-5"), null);
  assert.equal(dollarsToCents("abc"), null);
  assert.equal(dollarsToCents(""), null);
});

test("cents format as USD without float drift", () => {
  assert.equal(formatCentsUsd(1999), "$19.99");
  assert.equal(formatCentsUsd(7000), "$70.00");
  assert.equal(formatCentsUsd(97510), "$975.10");
});

test("category labels cover the estimate cost-type vocabulary", () => {
  assert.equal(expenseCategoryLabel("material"), "Materials");
  assert.equal(expenseCategoryLabel("subcontractor"), "Subcontractor");
  assert.equal(expenseCategoryLabel("unknown"), "unknown");
});
