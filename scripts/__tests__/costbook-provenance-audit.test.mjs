import test from "node:test";
import assert from "node:assert/strict";
import { auditCostbook, formatReport, loadCostbookExport, loadTradeCategories } from "../costbook-provenance-audit.mjs";

const knownTrades = new Set(["Roofing", "Framing", "Concrete", "HVAC"]);

function baseItem(overrides = {}) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Test Item",
    category: "Roofing",
    unit: "SF",
    laborCost: "1.00",
    materialCost: "2.00",
    equipmentCost: "0.00",
    ...overrides,
  };
}

test("a fully clean corpus with no provenance fields reports zero structural failures and full warning counts", () => {
  const result = auditCostbook({ items: [baseItem()], assemblies: [] }, knownTrades);
  assert.equal(result.structuralFailureCount, 0);
  assert.equal(result.findings.missingProvenanceStatus.count, 1);
  assert.equal(result.findings.missingSourceCitation.count, 1);
  assert.equal(result.findings.missingConfidence.count, 1);
  assert.equal(result.findings.missingRetrievedAt.count, 1);
});

test("an item carrying valid provenance/source/confidence/retrievedAt is not flagged as missing", () => {
  const result = auditCostbook(
    {
      items: [
        baseItem({
          provenanceStatus: "documented",
          sourceName: "Manufacturer price sheet",
          confidence: "high",
          retrievedAt: "2026-09-08T00:00:00.000Z",
        }),
      ],
      assemblies: [],
    },
    knownTrades
  );
  assert.equal(result.findings.missingProvenanceStatus.count, 0);
  assert.equal(result.findings.missingSourceCitation.count, 0);
  assert.equal(result.findings.missingConfidence.count, 0);
  assert.equal(result.findings.missingRetrievedAt.count, 0);
  assert.equal(result.structuralFailureCount, 0);
});

test("an invalid provenanceStatus or confidence value is reported as a warning, not silently accepted", () => {
  const result = auditCostbook(
    { items: [baseItem({ provenanceStatus: "verified", confidence: "certain" })], assemblies: [] },
    knownTrades
  );
  assert.equal(result.findings.invalidProvenanceStatus.count, 1);
  assert.equal(result.findings.invalidConfidence.count, 1);
  assert.equal(result.structuralFailureCount, 0, "invalid enum values are a warning, not a structural failure");
});

test("duplicate item ids are a structural failure", () => {
  const result = auditCostbook(
    { items: [baseItem(), baseItem()], assemblies: [] },
    knownTrades
  );
  assert.equal(result.findings.duplicateItemIds.count, 1);
  assert.equal(result.structuralFailureCount, 1);
});

test("missing id/name/category is a structural failure", () => {
  const result = auditCostbook(
    { items: [baseItem({ id: undefined }), baseItem({ id: "22222222-2222-2222-2222-222222222222", name: "" })], assemblies: [] },
    knownTrades
  );
  assert.equal(result.findings.missingIdentityFields.count, 2);
  assert.equal(result.structuralFailureCount, 2);
});

test("a non-numeric cost field is a structural failure", () => {
  const result = auditCostbook(
    { items: [baseItem({ laborCost: "not-a-number" })], assemblies: [] },
    knownTrades
  );
  assert.equal(result.findings.nonNumericCostFields.count, 1);
  assert.equal(result.structuralFailureCount, 1);
});

test("a unit outside the known enum is a warning, not a structural failure", () => {
  const result = auditCostbook({ items: [baseItem({ unit: "TON" })], assemblies: [] }, knownTrades);
  assert.equal(result.findings.malformedUnits.count, 1);
  assert.equal(result.structuralFailureCount, 0);
});

test("a category with no matching trade and no known alias is an unmapped-category warning", () => {
  const result = auditCostbook({ items: [baseItem({ category: "Made Up Trade" })], assemblies: [] }, knownTrades);
  assert.equal(result.findings.unmappedCategories.count, 1);
});

test("a known category alias (e.g. Hvac -> HVAC) is not reported as unmapped", () => {
  const result = auditCostbook({ items: [baseItem({ category: "Hvac" })], assemblies: [] }, knownTrades);
  assert.equal(result.findings.unmappedCategories.count, 0);
});

test("duplicate assembly ids are a structural failure", () => {
  const assembly = { id: "assembly-1", name: "A", category: "Assemblies - Roofing", lineItems: [] };
  const result = auditCostbook({ items: [baseItem()], assemblies: [assembly, { ...assembly }] }, knownTrades);
  assert.equal(result.findings.duplicateAssemblyIds.count, 1);
  assert.equal(result.structuralFailureCount, 1);
});

test("an assembly line item referencing a nonexistent cost item is a structural failure", () => {
  const assembly = {
    id: "assembly-1",
    name: "A",
    category: "Assemblies - Roofing",
    lineItems: [{ costBookItemId: "does-not-exist", quantity: "1" }],
  };
  const result = auditCostbook({ items: [baseItem()], assemblies: [assembly] }, knownTrades);
  assert.equal(result.findings.danglingAssemblyReferences.count, 1);
  assert.equal(result.structuralFailureCount, 1);
});

test("an assembly line item referencing a real cost item is not flagged", () => {
  const item = baseItem();
  const assembly = {
    id: "assembly-1",
    name: "A",
    category: "Assemblies - Roofing",
    lineItems: [{ costBookItemId: item.id, quantity: "1" }],
  };
  const result = auditCostbook({ items: [item], assemblies: [assembly] }, knownTrades);
  assert.equal(result.findings.danglingAssemblyReferences.count, 0);
  assert.equal(result.structuralFailureCount, 0);
});

test("formatReport renders a PASS line when there are no structural failures", () => {
  const result = auditCostbook({ items: [baseItem()], assemblies: [] }, knownTrades);
  const report = formatReport(result);
  assert.match(report, /Result: PASS/);
  assert.match(report, /Corpus: 1 cost items, 0 assemblies/);
});

test("formatReport renders a FAIL line and truncates long example lists when structural failures exist", () => {
  const items = Array.from({ length: 8 }, () => baseItem());
  const result = auditCostbook({ items, assemblies: [] }, knownTrades);
  const report = formatReport(result);
  assert.match(report, /Result: FAIL \(7 structural defect\(s\) found\)/);
  assert.match(report, /\.\.\. and \d+ more/);
});

test("the real canonical corpus currently passes structurally with zero item-level provenance (documents the honest baseline)", () => {
  const { items, assemblies } = loadCostbookExport();
  const knownTradeCategories = loadTradeCategories();
  const result = auditCostbook({ items, assemblies }, knownTradeCategories);

  assert.equal(result.structuralFailureCount, 0, "the real corpus must remain structurally clean");
  assert.equal(result.totals.items, items.length);
  // Honest baseline: this PR adds the contract and validator, it does not
  // fabricate metadata for existing items.
  assert.ok(result.findings.missingProvenanceStatus.count > 0, "no item-level provenance exists yet in the real corpus");
});

test("an assembly with no provenance fields reports the assembly-level missing warnings", () => {
  const assembly = { id: "assembly-1", name: "A", category: "Assemblies - Roofing", lineItems: [] };
  const result = auditCostbook({ items: [baseItem()], assemblies: [assembly] }, knownTrades);
  assert.equal(result.findings.missingAssemblyProvenanceStatus.count, 1);
  assert.equal(result.findings.missingAssemblySourceCitation.count, 1);
  assert.equal(result.findings.missingAssemblyConfidence.count, 1);
  assert.equal(result.findings.missingAssemblyRetrievedAt.count, 1);
  assert.equal(result.structuralFailureCount, 0);
});

test("an assembly carrying valid provenance/source/confidence/retrievedAt is not flagged as missing", () => {
  const assembly = {
    id: "assembly-1",
    name: "A",
    category: "Assemblies - Roofing",
    lineItems: [],
    provenanceStatus: "documented",
    sourceName: "Manufacturer assembly guide",
    confidence: "high",
    retrievedAt: "2026-09-10T00:00:00.000Z",
  };
  const result = auditCostbook({ items: [baseItem()], assemblies: [assembly] }, knownTrades);
  assert.equal(result.findings.missingAssemblyProvenanceStatus.count, 0);
  assert.equal(result.findings.missingAssemblySourceCitation.count, 0);
  assert.equal(result.findings.missingAssemblyConfidence.count, 0);
  assert.equal(result.findings.missingAssemblyRetrievedAt.count, 0);
});

test("an assembly with an invalid provenanceStatus or confidence value is a warning, not a structural failure", () => {
  const assembly = {
    id: "assembly-1",
    name: "A",
    category: "Assemblies - Roofing",
    lineItems: [],
    provenanceStatus: "verified",
    confidence: "certain",
  };
  const result = auditCostbook({ items: [baseItem()], assemblies: [assembly] }, knownTrades);
  assert.equal(result.findings.invalidAssemblyProvenanceStatus.count, 1);
  assert.equal(result.findings.invalidAssemblyConfidence.count, 1);
  assert.equal(result.structuralFailureCount, 0);
});

test("the real canonical corpus currently has zero assembly-level provenance (documents the honest baseline)", () => {
  const { items, assemblies } = loadCostbookExport();
  const knownTradeCategories = loadTradeCategories();
  const result = auditCostbook({ items, assemblies }, knownTradeCategories);

  assert.equal(result.structuralFailureCount, 0, "the real corpus must remain structurally clean");
  if (assemblies.length > 0) {
    assert.equal(result.findings.missingAssemblyProvenanceStatus.count, assemblies.length, "no assembly-level provenance exists yet in the real corpus");
  }
});
