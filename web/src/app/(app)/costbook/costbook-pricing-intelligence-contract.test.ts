import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Costbook landing is search-first across the four real pricing catalogs", async () => {
  const source = await readSource("./page.tsx");

  assert.match(source, /type PrimaryAreaId = "materials" \| "labor" \| "equipment" \| "assemblies"/);
  assert.match(source, /href: "\/costbook\/materials"/);
  assert.match(source, /href: "\/costbook\/labor-rates"/);
  assert.match(source, /href: "\/costbook\/equipment"/);
  assert.match(source, /href: "\/costbook\/assemblies"/);
  assert.match(source, /<form action=\{selectedArea\.href\} method="get"/);
  assert.match(source, /Search \{selectedArea\.label\}/);
  assert.doesNotMatch(source, /Workspace Foundation|Permission Boundary/);
});

test("Costbook landing shows real Material source facts without fake price-health totals", async () => {
  const source = await readSource("./page.tsx");

  assert.match(source, /listCostbookMaterials\(token, \{/);
  assert.match(source, /limit: 5/);
  assert.match(source, /active: true/);
  assert.match(source, /<PricingProvenance\s+mode="catalog"/);
  assert.match(source, /Missing source or date stays missing/);
  assert.doesNotMatch(source, /Current \+ documented|31 prices need review|HIGH|PLACEHOLDER|Trust before precision/);
});

test("ordinary Material rows expose stored price supplier and lastPriceUpdate only", async () => {
  const source = await readSource("../../../components/costbook/materials-catalog.tsx");

  assert.match(source, />Current price<\/th>/);
  assert.match(source, />Source \+ date<\/th>/);
  assert.match(source, /supplierName=\{material\.supplierName\}/);
  assert.match(source, /lastPriceUpdate=\{material\.lastPriceUpdate\}/);
  assert.match(source, /formatCurrency\(material\.unitCost\)/);
  assert.doesNotMatch(source, /freshnessLabel|provenanceStatus|confidence=/);
});

test("catalog provenance never upgrades supplier/date facts into a trust verdict", async () => {
  const source = await readSource("../../../components/costbook/pricing-provenance.tsx");
  const catalogStart = source.indexOf('if (props.mode === "catalog")');
  const researchStart = source.indexOf('data-pricing-provenance="research"');

  assert.notEqual(catalogStart, -1);
  assert.notEqual(researchStart, -1);
  const catalogBranch = source.slice(catalogStart, researchStart);

  assert.match(catalogBranch, /props\.supplierName/);
  assert.match(catalogBranch, /props\.lastPriceUpdate/);
  assert.match(catalogBranch, /No supplier recorded/);
  assert.match(catalogBranch, /No price-update date recorded/);
  assert.doesNotMatch(catalogBranch, /provenanceLabel|freshnessLabel|props\.confidence|HIGH|verified price/);
});

test("Research Review keeps the richer evidence contract and human governance", async () => {
  const source = await readSource("./research-review/page.tsx");

  assert.match(source, /<PricingProvenance\s+mode="research"/);
  assert.match(source, /provenanceStatus=\{candidate\.provenanceStatus\}/);
  assert.match(source, /sourceDate=\{candidate\.sourceDate\}/);
  assert.match(source, /regionalBasis=\{candidate\.regionalBasis\}/);
  assert.match(source, /confidence=\{candidate\.confidence\}/);
  assert.match(source, /form action=\{reviewCostbookCandidateAction\}/);
  assert.match(source, /form action=\{promoteCostbookCandidateAction\}/);
});

test("Materials page leads with search and states the no-inference boundary", async () => {
  const source = await readSource("./materials/page.tsx");

  assert.match(source, /<CatalogQueryControls/);
  assert.match(source, /Supplier and last price-update date are evidence fields/);
  assert.match(source, /does not infer “verified” or “current local” pricing/);
  assert.doesNotMatch(source, /Materials summary|workspace\.organizationId/);
});


test("Material mutation failures stay visible when the editor is closed", async () => {
  const source = await readSource("../../../components/costbook/materials-catalog.tsx");

  const editorEnd = source.indexOf("You have read-only Costbook access");
  const errorAlert = source.indexOf('role="alert"', editorEnd);
  const catalogStart = source.indexOf('aria-label="Materials catalog"');

  assert.notEqual(errorAlert, -1, "mutation error alert must render outside the conditional editor");
  assert.ok(errorAlert < catalogStart, "mutation errors should surface before the catalog rows");
  assert.match(source, /handleDeactivate[\s\S]*setError\(err instanceof Error \? err\.message : "Material could not be deactivated\."\)/);
});


test("Material editor cannot switch or close while a mutation is pending", async () => {
  const source = await readSource("../../../components/costbook/materials-catalog.tsx");

  assert.match(source, /onClick=\{startCreate\} disabled=\{saving\}/);
  assert.match(source, /onClick=\{closeForm\} disabled=\{saving\}/);

  const editLocks = source.match(/onClick=\{\(\) => startEdit\(material\)\} disabled=\{saving\}/g) ?? [];
  assert.equal(editLocks.length, 2, "desktop and mobile Edit actions must both lock while saving");

  const deactivateLocks = source.match(/onClick=\{\(\) => handleDeactivate\(material\.id\)\} disabled=\{saving\}/g) ?? [];
  assert.equal(deactivateLocks.length, 2, "desktop and mobile Deactivate actions must remain locked while saving");
});


test("resolved-price client contract carries source confidence freshness and explanation", async () => {
  const source = await readSource("../../../lib/costbook-api.ts");

  assert.match(source, /export interface CostbookResolvedPrice/);
  assert.match(source, /selectedPrice: number/);
  assert.match(source, /confidence: CostbookPriceConfidence/);
  assert.match(source, /freshness: CostbookPriceFreshness/);
  assert.match(source, /verifiedVsInferred: "observed" \| "inferred"/);
  assert.match(source, /oneLineProvenance: string/);
  assert.match(source, /reasonSelected: string/);
  assert.match(source, /\/api\/v1\/costbook\/pricing\/resolve/);
});


test("Supplier Evidence exposes truthful paged observations without price promotion", async () => {
  const page = await readSource("./supplier-evidence/page.tsx");
  const api = await readSource("../../../lib/costbook-api.ts");
  const action = await readSource("../../actions/costbook-supplier-evidence.ts");

  assert.match(page, /Regional observations/);
  assert.match(page, /Evidence is not the current Material price/);
  assert.match(page, /type QueryValue = string \| string\[\] \| undefined/);
  assert.match(page, /singleQueryValue\(query\.q\)/);
  assert.match(page, /limit: PAGE_SIZE \+ 1/);
  assert.match(page, /cursor,/);
  assert.match(page, /row\.id === observationId/);
  assert.match(page, /money\(row\.normalizedUnitPrice, row\.currency\)/);
  assert.match(page, /Next page/);
  assert.match(page, /previewRegionalSupplierCanonicalMatch/);
  assert.match(page, /form action=\{reviewSupplierCanonicalMatchAction\}/);
  assert.match(page, /does not write/);
  assert.match(api, /supplierProductId: string/);
  assert.match(api, /currency: string/);
  assert.match(api, /cursor\?: string/);
  assert.match(api, /\/api\/v1\/costbook\/supplier-evidence/);
  assert.match(action, /parseSupplierCanonicalMatchReview/);
  assert.match(action, /reviewRegionalSupplierCanonicalMatch/);
  assert.doesNotMatch(action, /unitCost|price-history|promote/i);
});
