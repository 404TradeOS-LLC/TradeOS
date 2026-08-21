import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readSource(relativePath: string): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, relativePath), "utf8");
}

test("divisions page loads the authenticated Costbook workspace and hierarchy catalog", () => {
  const source = readSource("page.tsx");

  assert.match(source, /title:\s*"Divisions \| TradeOS"/);
  assert.match(source, /getCostbookWorkspace\(token\)/);
  assert.match(source, /listCostbookDivisions\(token[,)]/);
  assert.match(source, /listCostbookCategories\(token[,)]/);
  assert.match(source, /listCostbookSubcategories\(token[,)]/);
  assert.match(source, /Couldn't load the Costbook hierarchy/);
});

test("divisions loading route exposes a dedicated loading summary", () => {
  const source = readSource("loading.tsx");

  assert.match(source, /aria-label="Loading hierarchy summary"/);
  assert.match(source, /aria-busy="true"/);
});

test("costbook navigation links include the divisions surface", () => {
  const source = readSource("../page.tsx");

  assert.match(source, /href:\s*"\/costbook\/divisions"/);
});

test("hierarchy catalog preserves the factual empty-state copy", () => {
  const source = readSource("../../../../components/costbook/hierarchy-catalog.tsx");

  assert.match(source, /No divisions yet/);
  assert.match(source, /Add divisions to organize the Costbook catalog into trade groupings\./);
  assert.match(source, /Deactivate/);
});
