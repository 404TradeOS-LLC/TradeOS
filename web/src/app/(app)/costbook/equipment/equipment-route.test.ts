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
  assert.match(source, /getEquipmentWorkspace\(token, signal\)/);
  assert.match(source, /listCostbookEquipment\(token, signal\)/);
  assert.match(source, /Couldn't load equipment/);
  assert.match(source, /Organization-scoped equipment catalog records for Costbook/);
});

test("equipment page bounds backend loading and reports timeout failures", () => {
  const source = readSource("page.tsx");

  assert.match(source, /EQUIPMENT_LOAD_TIMEOUT_MS\s*=\s*15_000/);
  assert.match(source, /AbortSignal\.timeout\(EQUIPMENT_LOAD_TIMEOUT_MS\)/);
  assert.match(source, /Costbook equipment took too long to load\. Try again\./);
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

test("equipment catalog is wired to the behaviorally tested mutation and permission seam", () => {
  const source = readSource("../../../../components/costbook/equipment-catalog.tsx");

  assert.match(source, /getEquipmentCatalogCapabilities\(canWrite, canManage\)/);
  assert.match(source, /createEquipmentCatalogRecord\(clientFetch, payload\)/);
  assert.match(source, /updateEquipmentCatalogRecord\(clientFetch, editingId, payload\)/);
  assert.match(source, /deleteEquipmentCatalogRecord\(clientFetch, id\)/);
  assert.match(source, /capabilities\.canCreate/);
  assert.match(source, /capabilities\.canEdit/);
  assert.match(source, /capabilities\.canDelete/);
  assert.match(source, /capabilities\.showActions/);
});

test("equipment catalog locks editable form state while a mutation is pending", () => {
  const source = readSource("../../../../components/costbook/equipment-catalog.tsx");
  const disabledWhileSaving = source.match(/disabled=\{saving\}/g) ?? [];

  assert.ok(disabledWhileSaving.length >= 9, "expected form inputs and mutation transitions to be disabled while saving");
  assert.match(source, /function startCreate\(\) \{\s*if \(saving\) return;/);
  assert.match(source, /function startEdit\(item: EquipmentCatalogRecord\) \{\s*if \(saving\) return;/);
});
