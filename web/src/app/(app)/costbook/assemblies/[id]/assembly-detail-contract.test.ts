import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("assembly detail composes the existing tenant-scoped read contracts", async () => {
  const page = await readSource("./page.tsx");
  const api = await readSource("../../../../../lib/costbook-api.ts");

  assert.match(page, /getCostbookAssembly\(token, id\)/);
  assert.match(page, /listCostbookAssemblyItems\(token, id/);
  assert.match(page, /getCostbookAssemblyUnitCost\(token, id\)/);
  assert.match(api, /\/api\/v1\/costbook\/assemblies\/\$\{id\}/);
  assert.match(api, /\/api\/v1\/costbook\/assemblies\/\$\{id\}\/items/);
  assert.match(api, /\/api\/v1\/costbook\/assemblies\/\$\{id\}\/unit-cost/);
});

test("assembly detail is estimator-first without inventing estimate-specific economics", async () => {
  const page = await readSource("./page.tsx");

  assert.match(page, />Scope</);
  assert.match(page, />Recipe</);
  assert.match(page, />Current cost</);
  assert.match(page, /per 1 \{assembly\.unitOfMeasure\}/);
  assert.match(page, /This detail page does not create an Estimate or invent a sell price, margin, or job quantity without Estimate context/);
  assert.doesNotMatch(page, /gross margin|High confidence|Sell price|priceHigh|priceLow|markupPercent|profitPercent/);
});

test("assembly detail preserves the provenance boundary of the current API", async () => {
  const page = await readSource("./page.tsx");

  assert.match(page, /does not return component-level supplier\/date provenance, confidence, sell price, gross margin, or job-specific inputs/);
  assert.match(page, /This workspace does not infer those fields/);
  assert.doesNotMatch(page, /Supplier price|Recent purchase|Legacy price|PLACEHOLDER|HIGH|REVIEW/);
});

test("assembly recipe is bounded and exposes stored per-unit quantities", async () => {
  const page = await readSource("./page.tsx");

  assert.match(page, /const COMPONENT_PAGE_LIMIT = 100/);
  assert.match(page, /quantityPerUnit/);
  assert.match(page, /Qty \/ 1 \{assembly\.unitOfMeasure\}/);
  assert.match(page, /Showing \{shownItems\.length\} of \{itemsPage\.total\} components/);
});

test("unit-cost failure degrades without hiding assembly scope or recipe", async () => {
  const page = await readSource("./page.tsx");

  assert.match(page, /getCostbookAssemblyUnitCost\(token, id\)\s*\.then/);
  assert.match(page, /\.catch\(\(error: unknown\)/);
  assert.match(page, /Current unit cost unavailable/);
  assert.match(page, /costResult\.error/);
});

test("assembly catalog keeps editing behavior and exposes the canonical detail route", async () => {
  const catalog = await readSource("../../../../../components/costbook/assembly-catalog.tsx");

  assert.match(catalog, /href=\{"\/costbook\/assemblies\/" \+ selected\.id\}/);
  assert.match(catalog, />Open detail</);
  assert.match(catalog, /AssemblyEditForm/);
  assert.match(catalog, /deactivateSelected/);
});

test("assembly detail does not bypass Estimate workflow context", async () => {
  const page = await readSource("./page.tsx");

  assert.match(page, /Use an Assembly from an Estimate Items workflow when you have project\/estimate context/);
  assert.match(page, /href="\/estimates"/);
  assert.doesNotMatch(page, /applyAssembly|addLineItem|clientFetch|method: "POST"|method: "PATCH"/);
});
