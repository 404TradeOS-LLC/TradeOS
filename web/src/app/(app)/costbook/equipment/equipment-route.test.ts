import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readSource(relativePath: string): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, relativePath), "utf8");
}

test("equipment page loads the authenticated Costbook workspace and equipment catalog", () => {
  const source = readSource("page.tsx");

  assert.match(source, /title:\s*"Equipment \| TradeOS"/);
  assert.match(source, /getCostbookWorkspace\(token\)/);
  assert.match(source, /listCostbookEquipment\(token\)/);
  assert.match(source, /Couldn't load equipment/);
  assert.match(source, /Organization-scoped equipment catalog records for Costbook/);
});

test("equipment loading route exposes a dedicated loading summary", () => {
  const source = readSource("loading.tsx");

  assert.match(source, /aria-label="Loading equipment summary"/);
  assert.match(source, /aria-busy="true"/);
});

test("costbook navigation links include the equipment surface", () => {
  const source = readSource("../page.tsx");

  assert.match(source, /href:\s*"\/costbook\/equipment"/);
  assert.match(source, /label:\s*"Equipment"/);
});

test("equipment catalog preserves the factual empty-state copy", () => {
  const source = readSource("../../../../components/costbook/equipment-catalog.tsx");

  assert.match(source, /No equipment yet/);
  assert.match(source, /Add equipment to prepare Costbook for estimating workflows\./);
  assert.match(source, /Delete/);
});
