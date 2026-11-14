import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { estimateMaterialsPreview } from "./estimate-materials.ts";

test("shopping list preview exposes only material quantities and descriptions, never prices", () => {
  const lines = [
    { description: "Rebar 3/8 inch", quantity: 8, unitOfMeasure: "10-foot", section: "Footer", costType: "material", assemblyId: null, unitCost: 18.95, lineCost: 151.60 },
    { description: "Labor", quantity: 4, unitOfMeasure: "hour", section: "Footer", costType: "labor", assemblyId: null, unitCost: 40, lineCost: 160 },
    { description: "Assembly", quantity: 1, unitOfMeasure: "ea", section: "General", costType: "material", assemblyId: "assembly-1", unitCost: 300, lineCost: 300 },
  ] as const;
  const result = estimateMaterialsPreview(lines);
  assert.deepEqual(result, {
    items: [{ description: "Rebar 3/8 inch", quantity: 8, unitOfMeasure: "10-foot", section: "Footer" }],
    unexpandedAssemblyCount: 1,
    requiresReview: false,
  });
  assert.doesNotMatch(JSON.stringify(result), /unitCost|lineCost|151\\.60|markup|totalPrice/);
});

test("invalid material quantity blocks preview instead of hiding only the bad line", () => {
  const result = estimateMaterialsPreview([{ description: "Concrete", quantity: Number.NaN, unitOfMeasure: "bag", section: "Footer", costType: "material", assemblyId: null }]);
  assert.equal(result.requiresReview, true);
  assert.deepEqual(result.items, []);
});

test("price tokens in material descriptions are masked", () => {
  const result = estimateMaterialsPreview([{ description: "Concrete $211.03", quantity: 47, unitOfMeasure: "bag", section: "Footer", costType: "material", assemblyId: null }]);
  assert.doesNotMatch(JSON.stringify(result), /\$211\.03/);
});

test("materials checklist preview visibly pairs each item description with its section", async () => {
  const source = await readFile(new URL("../components/estimate/estimate-materials-panel.tsx", import.meta.url), "utf8");
  const rows = source.split("preview.items.map((item, index) => (");
  assert.equal(rows.length, 2, "expected a single materials preview render loop");
  const rowMarkup = rows[1].split("</li>")[0];
  assert.match(rowMarkup, /\{item\.section\}/);
  assert.match(rowMarkup, /\{item\.description\}/);
});
