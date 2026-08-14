import test from "node:test";
import assert from "node:assert/strict";

import {
  createEquipmentCatalogRecord,
  deleteEquipmentCatalogRecord,
  getEquipmentCatalogCapabilities,
  updateEquipmentCatalogRecord,
  type EquipmentCatalogFetcher,
  type EquipmentCatalogPayload,
  type EquipmentCatalogRecord,
} from "./equipment-catalog-actions.ts";

const payload: EquipmentCatalogPayload = {
  name: "Scissor Lift",
  ownershipCostPerHour: 28.5,
  operatingCostPerHour: 11.25,
  dailyRate: 325,
};

const record: EquipmentCatalogRecord = {
  id: "equipment-1",
  organizationId: "org-1",
  ...payload,
  hourlyCost: 39.75,
  createdAt: "2026-08-12T00:00:00.000Z",
  updatedAt: "2026-08-12T00:00:00.000Z",
};

function recordingFetcher(response: unknown = record) {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const fetcher: EquipmentCatalogFetcher = async <T>(path: string, init?: RequestInit) => {
    calls.push({ path, init });
    return response as T;
  };
  return { fetcher, calls };
}

test("equipment create uses the Costbook collection POST route", async () => {
  const { fetcher, calls } = recordingFetcher();

  const result = await createEquipmentCatalogRecord(fetcher, payload);

  assert.equal(result.id, "equipment-1");
  assert.deepEqual(calls, [
    {
      path: "/costbook/equipment",
      init: { method: "POST", body: JSON.stringify(payload) },
    },
  ]);
});

test("equipment update uses the item PATCH route", async () => {
  const { fetcher, calls } = recordingFetcher();

  await updateEquipmentCatalogRecord(fetcher, "equipment-1", payload);

  assert.deepEqual(calls, [
    {
      path: "/costbook/equipment/equipment-1",
      init: { method: "PATCH", body: JSON.stringify(payload) },
    },
  ]);
});

test("equipment delete uses the item DELETE route", async () => {
  const { fetcher, calls } = recordingFetcher(undefined);

  await deleteEquipmentCatalogRecord(fetcher, "equipment-1");

  assert.deepEqual(calls, [
    {
      path: "/costbook/equipment/equipment-1",
      init: { method: "DELETE" },
    },
  ]);
});

test("equipment capabilities hide mutations for read-only roles", () => {
  assert.deepEqual(getEquipmentCatalogCapabilities(false, false), {
    canCreate: false,
    canEdit: false,
    canDelete: false,
    showActions: false,
  });
});

test("equipment capabilities separate writer and manager controls", () => {
  assert.deepEqual(getEquipmentCatalogCapabilities(true, false), {
    canCreate: true,
    canEdit: true,
    canDelete: false,
    showActions: true,
  });
  assert.deepEqual(getEquipmentCatalogCapabilities(false, true), {
    canCreate: false,
    canEdit: false,
    canDelete: true,
    showActions: true,
  });
  assert.deepEqual(getEquipmentCatalogCapabilities(true, true), {
    canCreate: true,
    canEdit: true,
    canDelete: true,
    showActions: true,
  });
});
