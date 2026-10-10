import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Assembly Catalog wires all five tenant-safe browse facets into one filter", async () => {
  const ui = await source("./assembly-catalog.tsx");
  const expected = [
    ['NAHB', /aria-label="Filter by NAHB group"/],
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
  assert.match(updateFilter, /setCostPreview\(\{\}\)/);
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
  assert.match(ui, /disabled=\{!canWrite \|\| saving \|\| isStarterCatalogInstalled\(selected, installedCodes\)\}/);
  assert.match(ui, /if \(componentMappings\.some\(\(mapping\) => !mapping\.costItemId\)\)/);
  assert.match(ui, /if \(new Set\(componentMappings\.map\(\(mapping\) => mapping\.costItemId\)\)\.size !== componentMappings\.length\)/);
  assert.match(ui, /Pre-install cost preview/);
});
