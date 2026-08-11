import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readSource(relativePath: string): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, relativePath), "utf8");
}

test("labor-rates page loads the authenticated Costbook workspace and labor-rate catalog", () => {
  const source = readSource("page.tsx");

  assert.match(source, /title:\s*"Labor Rates \| TradeOS"/);
  assert.match(source, /getCostbookWorkspace\(token\)/);
  assert.match(source, /listCostbookLaborRates\(token\)/);
  assert.match(source, /Couldn't load labor rates/);
  assert.match(source, /Organization-scoped labor-rate records for Costbook/);
});

test("labor-rates loading route exposes a dedicated loading summary", () => {
  const source = readSource("loading.tsx");

  assert.match(source, /aria-label="Loading labor rates summary"/);
  assert.match(source, /aria-busy="true"/);
});

test("costbook navigation links include the labor-rates surface", () => {
  const source = readSource("../page.tsx");

  assert.match(source, /href:\s*"\/costbook\/labor-rates"/);
  assert.match(source, /label:\s*"Labor Rates"/);
});

test("labor-rates catalog preserves the factual empty-state copy", () => {
  const source = readSource("../../../../components/costbook/labor-rates-catalog.tsx");

  assert.match(source, /No labor rates yet/);
  assert.match(source, /Add labor rates to prepare Costbook for estimating workflows\./);
  assert.match(source, /Deactivate/);
});
