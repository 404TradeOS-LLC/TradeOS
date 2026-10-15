import assert from "node:assert/strict";
import test from "node:test";
import { abcFieldLabel, abcUnitLabels, abcVariationLabels } from "./abc-catalog-preview.ts";

test("provider text fields are rendered only when supplied", () => {
  assert.equal(abcFieldLabel({ name: " Shingle " }), "Shingle");
  assert.equal(abcFieldLabel({ code: "EA" }), "EA");
  assert.equal(abcFieldLabel({ secret: "undisclosed" }), null);
  assert.equal(abcFieldLabel({}), null);
  assert.equal(abcFieldLabel(null), null);
  assert.equal(abcFieldLabel(0), "0");
});

test("ABC unit options are bounded and sanitized", () => {
  assert.deepEqual(abcUnitLabels([{ code: "EA" }, { name: "Bundle" }, {}, null]), ["EA", "Bundle"]);
  assert.deepEqual(abcUnitLabels([{ code: "BD", name: "Bundle", description: "stocking" }]), ["Bundle (BD) · stocking"]);
  assert.deepEqual(abcUnitLabels([{ code: "EA", name: "EA", description: "ordering" }]), ["EA · ordering"]);
  assert.equal(abcUnitLabels(Array.from({ length: 100 }, (_, i) => ({ code: String(i) }))).length, 25);
});

test("listing variation data is displayed without assuming prices, availability or stock", () => {
  assert.deepEqual(abcVariationLabels([{ size: "2x4", length: { value: "10", uomCode: "FT" } }]),
    ["2x4 · Length 10 FT"]);
  assert.deepEqual(abcVariationLabels([{}, null, { name: "Blue" }]), ["Blue"]);
});
