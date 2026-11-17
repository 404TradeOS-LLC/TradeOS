import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCodesSearchParams } from "./costbook-codes-query.ts";

test("new visit defaults to Vigo while deliberate empty county searches statewide only", () => {
  assert.equal(normalizeCodesSearchParams({}).county, "Vigo");
  assert.equal(normalizeCodesSearchParams({ county: "" }).county, "");
  assert.equal(normalizeCodesSearchParams({ county: "   " }).county, "");
  assert.equal(normalizeCodesSearchParams({ county: " Marion " }).county, "Marion");
});

test("query params are normalized, bounded and multiple values are ignored", () => {
  assert.deepEqual(normalizeCodesSearchParams({
    county: ["Vigo", "Marion"], topic: ["signage", "electrical"], q: ["sign", "bad"],
  }), { county: "", topic: undefined, q: "" });
  const result = normalizeCodesSearchParams({
    county: "a".repeat(100), topic: "bad", q: "b".repeat(170),
  });
  assert.equal(result.county.length, 80);
  assert.equal(result.q.length, 120);
  assert.equal(result.topic, undefined);
});

test("topic selection permits only the five reviewed fields", () => {
  for (const topic of ["signage", "permits", "electrical", "structural", "right-of-way"] as const) {
    assert.equal(normalizeCodesSearchParams({ topic }).topic, topic);
  }
  assert.equal(normalizeCodesSearchParams({ topic: "anything-else" }).topic, undefined);
});
