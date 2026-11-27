import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Assembly Catalog wires the tenant-safe browse facets into one filter", async () => {
  const ui = await source("./assembly-catalog.tsx");
  const expected = [
    ['NAHB', /aria-label="Filter by NAHB group"/],
    ['phase', /aria-label="Filter by NAHB build phase"/],
    ['CSI', /aria-label="Filter by CSI division"/],
    ['trade', /aria-label="Filter by trade"/],
    ['unit', /aria-label="Filter by assembly unit"/],
    ['installed', /aria-label="Filter by installation status"/],
  ] as const;
  for (const [name, selector] of expected) {
    assert.match(ui, selector, `Missing ${name} facet`);
  }
  assert.match(ui, /filterStarterCatalogTemplates\(templates, filters, installedCodes\)/);
  assert.match(ui, /buildStarterCatalogFacets\(templates\)/);
  assert.match(ui, /filtered\.length\} of \{templates\.length\} recipes/);
  assert.match(ui, /Clear filters/);
});

test("changing filters clears mapping state and hides a selected recipe outside the result set", async () => {
  const ui = await source("./assembly-catalog.tsx");
  assert.match(ui, /const selected = filtered\.find\(\(template\) => template\.id === selectedTemplateId\) \?\? null/);
  assert.match(ui, /function updateFilter/);
  // Stale Cost Item mappings and price previews must not survive a facet change.
  const updateFilter = ui.slice(ui.indexOf("function updateFilter"), ui.indexOf("function resetFilters"));
  assert.match(updateFilter, /setSelectedTemplateId\(""\)/);
  assert.match(updateFilter, /setMappings\(\{\}\)/);
  assert.match(updateFilter, /setMappingItems\(\{\}\)/);
  // The preview is query-derived (keyed by selected template + mapped
  // ids), so clearing the selection and mappings retires the preview
  // without a setCostPreview({}) reset: no stale preview can survive.
  assert.doesNotMatch(ui, /setCostPreview\(/);
  assert.match(ui, /queryKey: \["assembly-catalog-cost-preview", selected\?\.id \?\? "", \.\.\.mappedIds\]/);
});

test("installed status comes from all active tenant assemblies, not the current page or recipe labels", async () => {
  const ui = await source("./assembly-catalog.tsx");
  const page = await source("../../app/(app)/costbook/assemblies/page.tsx");
  assert.match(ui, /availableChildAssemblies\.map\(\(assembly\) => assembly\.code\.trim\(\)\.toUpperCase\(\)\)/);
  assert.match(ui, /isStarterCatalogInstalled\(template, installedCodes\)/);
  assert.match(page, /loadChildAssemblyChoices\(token\)/);
  assert.match(page, /while \(cursor\)/);
});

test("browse facets preserve existing write permissions and priced preview gates", async () => {
  const ui = await source("./assembly-catalog.tsx");
  assert.match(ui, /Boolean\(selected\.blockingReasons\?\.length\)/);
  assert.match(ui, /!mappingComplete \|\| !previewReady/);
  assert.match(ui, /if \(componentMappings\.some\(\(mapping\) => !mapping\.costItemId\)\)/);
  assert.match(ui, /if \(new Set\(componentMappings\.map\(\(mapping\) => mapping\.costItemId\)\)\.size !== componentMappings\.length\)/);
  assert.match(ui, /Pre-install cost preview/);
});

test("saving pricing overrides refreshes the displayed unit cost", async () => {
  const ui = await source("./assembly-catalog.tsx");
  // The edit form's onUpdated path must refresh the unit cost: the
  // selectedId query alone does not refetch after an override save, so
  // the displayed cost would stay stale. The refresh fetches the cost
  // with `cache: "no-store"` and writes it into the query cache: a plain
  // invalidation would refetch the allowlisted (60 s) GET from the
  // browser HTTP cache and return the pre-save cost. A failed refresh
  // leaves the last known cost visible instead of clearing it.
  assert.match(ui, /onUpdated=\{handleAssemblyUpdated\}/);
  assert.match(ui, /function handleAssemblyUpdated\(updated: CostbookAssembly\)/);
  const handler = ui.slice(ui.indexOf("function handleAssemblyUpdated"), ui.indexOf("async function deactivateSelected"));
  assert.match(handler, /updateAssemblyInList\(updated\)/);
  assert.match(handler, /refreshSelectedUnitCost\(updated\.id\)/);
  assert.match(ui, /async function refreshSelectedUnitCost\(requestAssemblyId: string\)/);
  const refresh = ui.slice(ui.indexOf("async function refreshSelectedUnitCost"), ui.indexOf("function handleAssemblyUpdated"));
  assert.match(refresh, /await queryClient\.cancelQueries\(\{ queryKey: \["assembly-unit-cost", requestAssemblyId\], exact: true \}\);/);
  assert.match(refresh, /clientFetch<AssemblyCost>\(`\/costbook\/assemblies\/\$\{requestAssemblyId\}\/unit-cost`, \{ cache: "no-store" \}\)/);
  assert.match(refresh, /queryClient\.setQueryData\(\["assembly-unit-cost", requestAssemblyId\], fresh\)/);
  assert.doesNotMatch(refresh, /setUnitCost\(null\)/);
});

test("override edit inputs accept every value the API contract accepts", async () => {
  const ui = await source("./assembly-catalog.tsx");
  const form = ui.slice(ui.indexOf("function AssemblyEditForm"), ui.indexOf("function money"));
  // Waste 7.25 and production factor 0.85 are valid per the override
  // contract (waste 0–100, factor > 0 and ≤ 10, enforced by submit); the
  // native inputs must not reject them first via step/min.
  assert.match(form, /aria-label="Waste override percent" type="number" min="0" max="100" step="any"/);
  assert.match(form, /aria-label="Production factor" type="number" min="0" max="10" step="any"/);
  assert.doesNotMatch(form, /step="0\.5"/);
  assert.doesNotMatch(form, /step="0\.1"/);
  assert.doesNotMatch(form, /min="0\.1"/);
});
