import assert from "node:assert/strict";
import test from "node:test";
import type { CostItemCatalogRecord } from "./cost-item-catalog-actions.ts";
import {
  collectPagedCatalogItems,
  mergeReuseMappingSuggestions,
  type MappingReuseSuggestion,
} from "./assembly-catalog-model.ts";

function item(overrides: Partial<CostItemCatalogRecord> = {}): CostItemCatalogRecord {
  return {
    id: "item-1", orgId: "org-1", subcategoryId: "sub-1", code: "CONC", name: "Concrete",
    unitOfMeasure: "CY", productionRate: null, laborRateId: null, materialId: "material-1",
    equipmentId: null, subcontractorId: null, isActive: true, ...overrides,
  };
}

function suggestion(overrides: Partial<MappingReuseSuggestion> & { componentKey: string }): MappingReuseSuggestion {
  return {
    componentLabel: overrides.componentKey,
    costItemId: null, costItemCode: null, costItemName: null, costItemUnitOfMeasure: null,
    costItemSubcategoryId: null, costItemProductionRate: null, costItemIsActive: false,
    orgId: "org-1", laborRateId: null, materialId: null, equipmentId: null, subcontractorId: null,
    compatible: true, reasons: [], ...overrides,
  };
}

test("merge fills only unmapped slots and preserves manual mappings", () => {
  const manual = item({ id: "ci-manual", code: "MAN", name: "Manual choice" });
  const merged = mergeReuseMappingSuggestions(
    { concrete: "ci-manual" },
    { concrete: manual },
    [
      suggestion({ componentKey: "concrete", componentLabel: "Ready-mix concrete", costItemId: "ci-other", costItemCode: "OTH", costItemName: "Other mix" }),
      suggestion({ componentKey: "base", componentLabel: "Compacted granular base", costItemId: "ci-base", costItemCode: "BASE", costItemName: "Granular base", costItemUnitOfMeasure: "CY", costItemSubcategoryId: "sub-1", costItemIsActive: true, materialId: "mat-1" }),
    ],
  );
  assert.equal(merged.mappings.concrete, "ci-manual");
  assert.equal(merged.items.concrete, manual);
  assert.equal(merged.mappings.base, "ci-base");
  assert.equal(merged.items.base.code, "BASE");
  assert.equal(merged.applied, 1);
  assert.deepEqual(merged.stillMissing, []);
});

test("merge skips a suggestion that reuses an item held by a manual mapping", () => {
  // Codex P2: assigning the same Cost Item twice would fail the install
  // distinct-item check; the slot stays unmapped instead.
  const merged = mergeReuseMappingSuggestions(
    { concrete: "ci-manual" },
    { concrete: item({ id: "ci-manual", code: "MAN", name: "Manual choice" }) },
    [
      suggestion({ componentKey: "base", componentLabel: "Compacted granular base", costItemId: "ci-manual", costItemCode: "MAN", costItemName: "Manual choice" }),
      suggestion({ componentKey: "reinforcing", componentLabel: "Slab reinforcing" }),
    ],
  );
  assert.equal(merged.mappings.base, undefined);
  assert.equal(merged.applied, 0);
  assert.deepEqual(merged.stillMissing, ["Compacted granular base", "Slab reinforcing"]);
});

test("merge reports slots with no suggested item as still missing", () => {
  const merged = mergeReuseMappingSuggestions(
    {},
    {},
    [
      suggestion({ componentKey: "base", componentLabel: "Compacted granular base", costItemId: "ci-base", costItemCode: "BASE", costItemName: "Granular base" }),
      suggestion({ componentKey: "concrete", componentLabel: "Ready-mix concrete" }),
    ],
  );
  assert.equal(merged.applied, 1);
  assert.deepEqual(merged.stillMissing, ["Ready-mix concrete"]);
});

test("merge never suggests the same Cost Item for two slots", () => {
  const merged = mergeReuseMappingSuggestions(
    {},
    {},
    [
      suggestion({ componentKey: "base", componentLabel: "Compacted granular base", costItemId: "ci-conc", costItemCode: "CONC", costItemName: "Ready-mix" }),
      suggestion({ componentKey: "concrete", componentLabel: "Ready-mix concrete", costItemId: "ci-conc", costItemCode: "CONC", costItemName: "Ready-mix" }),
    ],
  );
  assert.equal(merged.mappings.base, "ci-conc");
  assert.equal(merged.mappings.concrete, undefined);
  assert.equal(merged.applied, 1);
  assert.deepEqual(merged.stillMissing, ["Ready-mix concrete"]);
});

test("collectPagedCatalogItems follows cursors until null", async () => {
  const pages: Record<string, { items: { id: string }[]; nextCursor: string | null }> = {
    null: { items: [{ id: "a" }, { id: "b" }], nextCursor: "c1" },
    c1: { items: [{ id: "c" }], nextCursor: "c2" },
    c2: { items: [{ id: "d" }], nextCursor: null },
  };
  const seen: (string | null)[] = [];
  const items = await collectPagedCatalogItems(async (cursor) => {
    seen.push(cursor);
    return pages[String(cursor) as keyof typeof pages] ?? pages.null;
  });
  assert.deepEqual(items.map((entry) => entry.id), ["a", "b", "c", "d"]);
  assert.deepEqual(seen, [null, "c1", "c2"]);
});

test("collectPagedCatalogItems dedupes repeated ids and caps pages", async () => {
  const deduped = await collectPagedCatalogItems(async (cursor) => ({
    items: cursor === null ? [{ id: "a" }] : [{ id: "a" }, { id: "b" }],
    nextCursor: cursor === null ? "c1" : null,
  }));
  assert.deepEqual(deduped.map((entry) => entry.id), ["a", "b"]);

  let calls = 0;
  const capped = await collectPagedCatalogItems(async () => {
    calls += 1;
    return { items: [{ id: `p${calls}` }], nextCursor: "never-null" };
  }, 3);
  assert.equal(calls, 3);
  assert.equal(capped.length, 3);
});
