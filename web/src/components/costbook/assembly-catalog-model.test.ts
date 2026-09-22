import assert from "node:assert/strict";
import test from "node:test";
import type { CostItemCatalogRecord } from "./cost-item-catalog-actions.ts";
import { assessCostItemMapping, normalizeUnit, type StarterCatalogComponent } from "./assembly-catalog-model.ts";

const component: StarterCatalogComponent = {
  key: "concrete",
  label: "Ready-mix concrete",
  quantityPerUnit: 0.01296,
  help: "Concrete per square foot",
  compatibleUnits: ["CY"],
  allowedCostItemKinds: ["material", "composite"],
};

function item(overrides: Partial<CostItemCatalogRecord> = {}): CostItemCatalogRecord {
  return {
    id: "item-1", orgId: "org-1", subcategoryId: "sub-1", code: "CONC", name: "Concrete",
    unitOfMeasure: "CY", productionRate: null, laborRateId: null, materialId: "material-1",
    equipmentId: null, subcontractorId: null, isActive: true, ...overrides,
  };
}

test("normalizes common construction unit aliases", () => {
  assert.equal(normalizeUnit("cubic yards"), "CY");
  assert.equal(normalizeUnit("sq_ft"), "SF");
  assert.equal(normalizeUnit("linear feet"), "LF");
  assert.equal(normalizeUnit("unsupported"), null);
});

test("accepts a compatible unit and Cost Item type", () => {
  assert.deepEqual(assessCostItemMapping(component, item()), {
    compatible: true,
    normalizedUnit: "CY",
    kind: "material",
    reasons: [],
  });
});

test("explains incompatible unit and Cost Item type", () => {
  const result = assessCostItemMapping(component, item({ unitOfMeasure: "SF", materialId: null, laborRateId: "labor-1" }));
  assert.equal(result.compatible, false);
  assert.equal(result.kind, "labor");
  assert.match(result.reasons.join(" "), /Expected CY; found SF/);
  assert.match(result.reasons.join(" "), /Expected material or composite; found labor/);
});
