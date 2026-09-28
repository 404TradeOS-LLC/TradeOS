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
