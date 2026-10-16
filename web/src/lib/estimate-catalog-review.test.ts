import assert from "node:assert/strict";
import test from "node:test";
import { canAddReviewedEstimateCatalogItem } from "./estimate-catalog-review.ts";

const valid = { kind: "costItem" as const, quantity: "2", unitCost: 18.5, previewPending: false, adding: false };

test("Costbook or installed assembly needs an explicit selected source and resolved unit cost", () => {
  assert.equal(canAddReviewedEstimateCatalogItem(valid), true);
  assert.equal(canAddReviewedEstimateCatalogItem({ ...valid, kind: "assembly" }), true);
  assert.equal(canAddReviewedEstimateCatalogItem({ ...valid, kind: null }), false);
  assert.equal(canAddReviewedEstimateCatalogItem({ ...valid, kind: "starterAssembly" }), false);
});

test("unresolved, invalid, or in-flight cost previews never authorize estimate Add", () => {
  for (const unitCost of [undefined, NaN, Infinity, -1]) {
    assert.equal(canAddReviewedEstimateCatalogItem({ ...valid, unitCost }), false);
  }
  assert.equal(canAddReviewedEstimateCatalogItem({ ...valid, previewPending: true }), false);
  assert.equal(canAddReviewedEstimateCatalogItem({ ...valid, adding: true }), false);
  // Zero can be an intentionally recorded Costbook cost; don't invent a supplier price.
  assert.equal(canAddReviewedEstimateCatalogItem({ ...valid, unitCost: 0 }), true);
});

test("blank, invalid, or nonpositive quantities cannot produce priced estimate lines", () => {
  for (const quantity of ["", " ", "0", "-2", "NaN", "Infinity", "1e999"]) {
    assert.equal(canAddReviewedEstimateCatalogItem({ ...valid, quantity }), false);
  }
  assert.equal(canAddReviewedEstimateCatalogItem({ ...valid, quantity: "0.5" }), true);
});
