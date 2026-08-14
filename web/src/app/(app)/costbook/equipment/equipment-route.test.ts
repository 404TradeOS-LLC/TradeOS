import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EQUIPMENT_LOAD_TIMEOUT_MS,
  loadEquipmentPageData,
} from "../../../../lib/costbook-equipment-load.ts";

function readSource(relativePath: string): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, relativePath), "utf8");
}

test("equipment page loads the authenticated Costbook workspace and equipment catalog", () => {
  const source = readSource("page.tsx");

  assert.match(source, /title:\s*"Equipment \| TradeOS"/);
  assert.match(source, /getWorkspace:\s*getEquipmentWorkspace/);
  assert.match(source, /listEquipment:\s*listCostbookEquipment/);
  assert.match(source, /Couldn't load equipment/);
  assert.match(source, /Organization-scoped equipment catalog records for Costbook/);
});

test("equipment load contract shares one bounded signal across both backend reads", async () => {
  const seenSignals: AbortSignal[] = [];

  const [workspace, equipment] = await loadEquipmentPageData("token", {
    getWorkspace: async (token, signal) => {
      assert.equal(token, "token");
      seenSignals.push(signal);
      return { organizationId: "org-1" };
    },
    listEquipment: async (token, signal) => {
      assert.equal(token, "token");
      seenSignals.push(signal);
      return [{ id: "equipment-1" }];
    },
  });

  assert.equal(EQUIPMENT_LOAD_TIMEOUT_MS, 15_000);
  assert.equal(seenSignals.length, 2);
  assert.equal(seenSignals[0], seenSignals[1], "workspace and equipment reads must share one timeout signal");
  assert.equal(seenSignals[0]?.aborted, false);
  assert.deepEqual(workspace, { organizationId: "org-1" });
  assert.deepEqual(equipment, [{ id: "equipment-1" }]);
});

test("equipment page reports timeout failures", () => {
  const source = readSource("page.tsx");
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

test("each equipment edit control remains locked while a mutation is pending", () => {
  const source = readSource("../../../../components/costbook/equipment-catalog.tsx");

  for (const field of ["name", "ownershipCostPerHour", "operatingCostPerHour", "dailyRate"]) {
    assert.match(
      source,
      new RegExp(`value=\\{form\\.${field}\\}[\\s\\S]*?disabled=\\{saving\\}`),
      `${field} input must be disabled while saving`,
    );
  }

  assert.match(source, /onClick=\{startCreate\}\s+disabled=\{saving\}/, "cancel transition must be locked while saving");
  assert.match(source, /type="submit"\s+disabled=\{saving\}/, "submit must be disabled while saving");

  const editButtons = source.match(/onClick=\{\(\) => startEdit\(item\)\}\s+disabled=\{saving\}/g) ?? [];
  const deleteButtons = source.match(/onClick=\{\(\) => handleDelete\(item\.id\)\}\s+disabled=\{saving\}/g) ?? [];
  assert.equal(editButtons.length, 2, "desktop and mobile edit actions must both lock while saving");
  assert.equal(deleteButtons.length, 2, "desktop and mobile delete actions must both lock while saving");

  assert.match(source, /function startCreate\(\) \{\s*if \(saving\) return;/);
  assert.match(source, /function startEdit\(item: EquipmentCatalogRecord\) \{\s*if \(saving\) return;/);
});
