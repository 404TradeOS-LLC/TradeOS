import assert from "node:assert/strict";
import test from "node:test";
import type { CostItemCatalogRecord } from "./cost-item-catalog-actions.ts";
import {
  assessCostItemMapping,
  buildStarterCatalogFacets,
  DEFAULT_STARTER_CATALOG_FILTERS,
  filterStarterCatalogTemplates,
  isStarterCatalogInstalled,
  normalizeUnit,
  type StarterCatalogComponent,
  type StarterCatalogFilters,
  type StarterCatalogTemplate,
} from "./assembly-catalog-model.ts";

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

function starter(overrides: Partial<StarterCatalogTemplate> = {}): StarterCatalogTemplate {
  return {
    id: "roof", code: "07 31 13-TOS-001", name: "Architectural shingles",
    description: "Roofing assembly", unitOfMeasure: "SQ", csiDivision: "07",
    csiTitle: "Thermal and Moisture Protection", nahbGroup: "Exterior shell",
    trade: "Roofing", measurementBasis: "Roofing square", wasteGuidance: "Review pitch and valleys",
    version: 1,
    review: { status: "reviewed", source: "TradeOS-authored", reviewedOn: "2026-09-19", regionalBasis: "Review local conditions" },
    components: [],
    ...overrides,
  };
}

const starterFixtures: StarterCatalogTemplate[] = [
  starter(),
  starter({ id: "deck", code: "06 15 00-TOS-002", name: "Deck framing", description: "Outdoor deck", unitOfMeasure: "SF", csiDivision: "06", csiTitle: "Wood, Plastics, and Composites", nahbGroup: "Outdoor living", trade: "Carpentry" }),
  starter({ id: "paint", code: "09 91 23-TOS-003", name: "Interior painting", description: "Interior walls", unitOfMeasure: "SF", csiDivision: "09", csiTitle: "Finishes", nahbGroup: "Interior finishes", trade: "Painting" }),
  starter({ id: "underlayment", code: "07 31 13-TOS-004", name: "Roof underlayment", description: "Rolls under shingles", unitOfMeasure: "SQ", csiDivision: "07", csiTitle: "Thermal and Moisture Protection", nahbGroup: "Exterior shell", trade: "Roofing" }),
];
const installed = new Set(["07 31 13-TOS-001", "06 15 00-TOS-002"]);

function browse(overrides: Partial<StarterCatalogFilters> = {}, codes = installed) {
  return filterStarterCatalogTemplates(starterFixtures, { ...DEFAULT_STARTER_CATALOG_FILTERS, ...overrides }, codes);
}

test("derives NAHB, CSI, trade and output-unit facets from actual recipes without duplicates", () => {
  assert.deepEqual(buildStarterCatalogFacets(starterFixtures), {
    nahbGroups: ["Exterior shell", "Interior finishes", "Outdoor living"],
    csiDivisions: ["06", "07", "09"],
    trades: ["Carpentry", "Painting", "Roofing"],
    units: ["SF", "SQ"],
  });
  assert.deepEqual(buildStarterCatalogFacets([]), {
    nahbGroups: [], csiDivisions: [], trades: [], units: [],
  });
});

test("applies combined work group, CSI, trade, output unit and search filters", () => {
  assert.deepEqual(browse({ nahbGroup: "Exterior shell", csiDivision: "07", trade: "Roofing", unit: "SQ" }).map((row) => row.id), ["roof", "underlayment"]);
  assert.deepEqual(browse({ nahbGroup: "Exterior shell", csiDivision: "07", trade: "Roofing", unit: "SQ", query: "  UNDERLAYMENT " }).map((row) => row.id), ["underlayment"]);
  assert.deepEqual(browse({ query: "09 91 23" }).map((row) => row.id), ["paint"]);
  assert.deepEqual(browse({ query: "square" }).map((row) => row.id), ["roof", "underlayment"]);
  assert.deepEqual(browse({ trade: "Electrical", csiDivision: "07" }), []);
  assert.equal(browse().length, starterFixtures.length);
});

test("filters installed status only from active tenant assembly codes, never a recipe flag", () => {
  assert.deepEqual(browse({ installation: "installed" }).map((row) => row.id), ["roof", "deck"]);
  assert.deepEqual(browse({ installation: "available" }).map((row) => row.id), ["paint", "underlayment"]);
  assert.deepEqual(browse({ installation: "installed", trade: "Roofing" }).map((row) => row.id), ["roof"]);
  assert.deepEqual(browse({ installation: "available", nahbGroup: "Exterior shell" }).map((row) => row.id), ["underlayment"]);
  assert.deepEqual(browse({ installation: "installed" }, new Set()), []);
  assert.deepEqual(browse({ installation: "available" }, new Set()).map((row) => row.id), starterFixtures.map((row) => row.id));
  assert.equal(isStarterCatalogInstalled(starter({ code: " 07 31 13-TOS-001 " }), installed), true);
});

test("filters are read-only and do not mutate shared catalog recipes or tenant install state", () => {
  const before = structuredClone(starterFixtures);
  const codes = new Set(installed);
  const filtered = browse({ installation: "available", query: "paint" }, codes);
  assert.deepEqual(filtered.map((row) => row.id), ["paint"]);
  assert.deepEqual(starterFixtures, before);
  assert.deepEqual(codes, installed);
});
