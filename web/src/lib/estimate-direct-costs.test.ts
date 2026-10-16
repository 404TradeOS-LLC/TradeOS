import assert from "node:assert/strict";
import test from "node:test";
import { groupSavedDirectCosts } from "./estimate-direct-costs.ts";

test("saved costs group by actual type without deriving customer sell prices", () => {
  const rows = [
    { costType: "material", lineCost: 123.45, quantity: 999, unitCost: 999 },
    { costType: "labor", lineCost: 80 },
    { costType: "material", lineCost: 6.55 },
    { costType: "disposal", lineCost: 0 },
  ];
  assert.deepEqual(groupSavedDirectCosts(rows), [
    { type: "material", label: "Materials", amount: 130 },
    { type: "labor", label: "Labor", amount: 80 },
    { type: "disposal", label: "Disposal", amount: 0 },
  ]);
  assert.equal(rows[0].lineCost, 123.45);
});

test("cent-valued snapshots avoid floating-point display errors", () => {
  assert.equal(groupSavedDirectCosts([
    { costType: "material", lineCost: 0.1 },
    { costType: "material", lineCost: 0.2 },
  ])[0].amount, 0.3);
  assert.deepEqual(groupSavedDirectCosts([]), []);
});

test("invalid saved costs remain unavailable rather than silently becoming zero", () => {
  for (const lineCost of [NaN, Infinity, -Infinity, Number.MAX_VALUE]) {
    assert.equal(groupSavedDirectCosts([{ costType: "labor", lineCost }])[0].amount, null);
  }
});
