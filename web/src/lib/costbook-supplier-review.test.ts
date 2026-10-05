import assert from "node:assert/strict";
import test from "node:test";
import { parseSupplierCanonicalMatchReview } from "./costbook-supplier-review.ts";

test("supplier canonical review preserves the submitted product and suggested key", () => {
  const formData = new FormData();
  formData.set("supplierProductId", "11111111-1111-4111-8111-111111111111");
  formData.set("canonicalMaterialKey", "LUMBER.SPF.2X4.8FT.STUD");

  assert.deepEqual(parseSupplierCanonicalMatchReview(formData), {
    supplierProductId: "11111111-1111-4111-8111-111111111111",
    canonicalMaterialKey: "LUMBER.SPF.2X4.8FT.STUD",
  });
});

test("supplier canonical review rejects missing mutation identity", () => {
  const missingProduct = new FormData();
  missingProduct.set("canonicalMaterialKey", "LUMBER.SPF.2X4.8FT.STUD");
  assert.throws(() => parseSupplierCanonicalMatchReview(missingProduct), /supplierProductId is required/);

  const missingKey = new FormData();
  missingKey.set("supplierProductId", "11111111-1111-4111-8111-111111111111");
  assert.throws(() => parseSupplierCanonicalMatchReview(missingKey), /canonicalMaterialKey is required/);
});
