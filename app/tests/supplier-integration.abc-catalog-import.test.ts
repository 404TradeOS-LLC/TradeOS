import type { PrismaClient } from "@prisma/client";
import {
  ABC_CATALOG_IMPORT_MIN_FREE_BYTES,
  AbcCatalogImportError,
  expectedPageItemCount,
  hierarchyPathKey,
  mapCatalogItem,
  mapHierarchyLevels,
  runFullCatalogImport,
  type AbcCatalogImportCatalog,
  type AbcCatalogImportReport,
} from "../modules/supplier-integration/abcCatalogImport";
import { classifyImportError, parseArgs, sanitizeReportForStdout } from "../scripts/run-abc-catalog-import";

// Unit tests for the Phase 2 importer (issue #735). The database is an
// in-memory fake implementing exactly the Prisma calls the service makes;
// the live-DB proof (same flows against real Postgres + RLS) lives in
// app/tests/abcCatalogImport.integration.ts. The fake carries throwing
// `supplierProduct` / `material` spies: the service has no access to those
// models, and any call would fail the test.

const CAPACITY_BYTES = 10 * 1024 * 1024 * 1024;
const USED_BYTES = 1024 * 1024 * 1024;

function rawItem(itemNumber: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    itemNumber,
    itemDescription: `Description for ${itemNumber}`,
    familyId: "FAM1",
    familyName: "Family",
    supplierName: "Maker",
    status: "Active",
    isDimensional: false,
    uoms: [{ name: "Bundle", code: "BD", description: "stocking" }],
    dimensions: null,
    color: null,
    finish: null,
    weights: [],
    variations: [],
    prop65Warnings: [],
    hierarchy: {
      productGroup: {
        code: "PG1", label: "Group", name: "Group Name",
        category: {
          code: "CA1", label: "Cat", name: "Cat Name",
          productType: {
            code: "PT1", label: "Type", name: "Type Name",
            materialComposition: {
              code: "MC1", label: "Mat", name: "Mat Name",
              warranty: {
                code: "WA1", label: "Warr", name: "Warr Name",
                brandLine: { code: "BL1", label: "Brand", name: "Brand Name" },
              },
            },
          },
        },
      },
    },
    ...overrides,
  };
}

function hierarchyEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    productGroup: {
      code: "PGH", label: "H Group", name: "H Group Name",
      category: {
        code: "CAH", label: "H Cat", name: "H Cat Name",
        productType: {
          code: "PTH", label: "H Type", name: "H Type Name",
          materialComposition: {
            code: "MCH", label: "H Mat", name: "H Mat Name",
            warranty: {
              code: "WAH", label: "H Warr", name: "H Warr Name",
              brandLine: { code: "BLH", label: "H Brand", name: "H Brand Name" },
            },
          },
        },
      },
    },
    ...overrides,
  };
}

interface FakeDb {
  db: unknown;
  tx: Record<string, any>;
  items: Map<string, Record<string, any>>;
  hierarchy: Map<string, Record<string, any>>;
  runs: Map<string, Record<string, any>>;
  getState: () => Record<string, any> | null;
  calls: { supplierProduct: jest.Mock; material: jest.Mock };
  failUpsertOnce: { current: boolean };
}

function createFakeDb(opts: { usedBytes?: bigint } = {}): FakeDb {
  const items = new Map<string, Record<string, any>>();
  const hierarchy = new Map<string, Record<string, any>>();
  const runs = new Map<string, Record<string, any>>();
  let state: Record<string, any> | null = null;
  let runSeq = 0;
  const calls = { supplierProduct: jest.fn(), material: jest.fn() };
  const failUpsertOnce = { current: false };
  const tx: Record<string, any> = {
    $queryRaw: jest.fn(async () => []),
    $executeRaw: jest.fn(async () => 1),
    abcCatalogItem: {
      findMany: jest.fn(async ({ where }: any) => {
        const numbers: string[] = where?.itemNumber?.in ?? [];
        return [...items.values()]
          .filter((row) => numbers.includes(row.itemNumber))
          .map((row) => ({ itemNumber: row.itemNumber, contentHash: row.contentHash, isDisplayable: row.isDisplayable }));
      }),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        if (failUpsertOnce.current) {
          failUpsertOnce.current = false;
          throw new Error("database connection lost");
        }
        const existing = items.get(where.itemNumber);
        if (existing) {
          const next = { ...existing, ...update };
          items.set(where.itemNumber, next);
          return next;
        }
        const row = { ...create };
        items.set(where.itemNumber, row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const existing = items.get(where.itemNumber);
        if (!existing) throw new Error("record not found");
        const next = { ...existing, ...data };
        items.set(where.itemNumber, next);
        return next;
      }),
      count: jest.fn(async () => items.size),
    },
    abcCatalogHierarchy: {
      findUnique: jest.fn(async ({ where }: any) => hierarchy.get(where.pathKey) ?? null),
      findMany: jest.fn(async ({ where }: any) => {
        const keys: string[] = where?.pathKey?.in ?? [];
        return [...hierarchy.values()]
          .filter((row) => keys.includes(row.pathKey))
          .map((row) => ({ pathKey: row.pathKey, levels: row.levels }));
      }),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = hierarchy.get(where.pathKey);
        if (existing) {
          const next = { ...existing, ...update };
          hierarchy.set(where.pathKey, next);
          return next;
        }
        const row = { ...create };
        hierarchy.set(where.pathKey, row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const existing = hierarchy.get(where.pathKey);
        if (!existing) throw new Error("record not found");
        const next = { ...existing, ...data };
        hierarchy.set(where.pathKey, next);
        return next;
      }),
    },
    abcCatalogSyncRun: {
      create: jest.fn(async ({ data }: any) => {
        const row = {
          id: `run-${++runSeq}`,
          startedAt: new Date(),
          finishedAt: null,
          providerTotalItems: null,
          providerTotalPages: null,
          pagesProcessed: 0,
          itemsSeen: 0,
          itemsAdded: 0,
          itemsUpdated: 0,
          itemsDeactivated: 0,
          itemsFailed: 0,
          checkpointPage: null,
          correlationId: null,
          error: null,
          ...data,
        };
        runs.set(row.id, row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const existing = runs.get(where.id);
        if (!existing) throw new Error("run not found");
        const next = { ...existing, ...data };
        runs.set(where.id, next);
        return next;
      }),
      findUnique: jest.fn(async ({ where }: any) => runs.get(where.id) ?? null),
      findFirst: jest.fn(async ({ where }: any) =>
        [...runs.values()].find((row) =>
          (!where.kind || row.kind === where.kind) &&
          (!where.status || row.status === where.status)) ?? null,
      ),
    },
    abcCatalogSyncState: {
      upsert: jest.fn(async ({ create, update }: any) => {
        state = state ? { ...state, ...update } : { ...create };
        return state;
      }),
      findUnique: jest.fn(async () => state),
    },
  };
  const db: Record<string, any> = {
    $queryRaw: jest.fn(async () => [{ size: opts.usedBytes ?? BigInt(USED_BYTES) }]),
    $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
    supplierProduct: {
      create: (...args: unknown[]) => calls.supplierProduct(...args),
      update: (...args: unknown[]) => calls.supplierProduct(...args),
      upsert: (...args: unknown[]) => calls.supplierProduct(...args),
    },
    material: {
      create: (...args: unknown[]) => calls.material(...args),
      update: (...args: unknown[]) => calls.material(...args),
      upsert: (...args: unknown[]) => calls.material(...args),
    },
  };
  return { db, tx, items, hierarchy, runs, getState: () => state, calls, failUpsertOnce };
}

function fakeCatalog(
  pages: Array<{ items: Record<string, unknown>[]; totalItems: number; totalPages: number }>,
  hierarchyPages: Array<{ entries: unknown[]; totalItems: number; totalPages: number }> = [
    { entries: [hierarchyEntry()], totalItems: 1, totalPages: 1 },
  ],
): AbcCatalogImportCatalog {
  return {
    listRaw: jest.fn(async ({ pageNumber }: { pageNumber: number }) => {
      const page = pages[pageNumber - 1];
      if (!page) throw new Error("unexpected page " + pageNumber);
      return {
        items: page.items,
        pagination: { itemsPerPage: 1000, pageNumber, totalPages: page.totalPages, totalItems: page.totalItems },
        source: "ABC Supply",
        environment: "sandbox",
        pricing: "not-requested",
        persisted: false,
      };
    }) as unknown as AbcCatalogImportCatalog["listRaw"],
    listHierarchyRaw: jest.fn(async (pageNumber: number) => {
      const page = hierarchyPages[pageNumber - 1];
      if (!page) throw new Error("unexpected hierarchy page " + pageNumber);
      return {
        hierarchies: page.entries,
        pagination: { itemsPerPage: 50, pageNumber, totalPages: page.totalPages, totalItems: page.totalItems },
        source: "ABC Supply",
        environment: "sandbox",
        pricing: "not-requested",
        persisted: false,
      };
    }) as unknown as AbcCatalogImportCatalog["listHierarchyRaw"],
  };
}

/** Collect every object key at any depth (values never inspected). */
function collectKeys(value: unknown, depth = 0, out: string[] = []): string[] {
  if (depth > 10 || value === null || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    for (const entry of value) collectKeys(entry, depth + 1, out);
    return out;
  }
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    out.push(key);
    collectKeys(entry, depth + 1, out);
  }
  return out;
}

const baseOptions = {
  dbCapacityBytes: CAPACITY_BYTES,
  now: () => new Date("2026-11-27T00:00:00.000Z"),
  log: () => undefined,
};

async function runImport(
  fake: FakeDb,
  catalog: AbcCatalogImportCatalog,
  options: Record<string, unknown> = {},
): Promise<AbcCatalogImportReport> {
  return runFullCatalogImport(fake.db as unknown as PrismaClient, catalog, {
    ...baseOptions,
    ...options,
  });
}

describe("abc catalog import mapping (issue #735, Phase 2)", () => {
  it("maps exactly the stored fields and hashes them deterministically", () => {
    const mapped = mapCatalogItem(rawItem("ABC-001") as never);
    expect(mapped.itemNumber).toBe("ABC-001");
    expect(mapped.description).toBe("Description for ABC-001");
    expect(mapped.manufacturer).toBe("Maker");
    expect(mapped.isDisplayable).toBe(true);
    expect(mapped.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(mapCatalogItem(rawItem("ABC-001") as never).contentHash).toBe(mapped.contentHash);
    expect(mapCatalogItem(rawItem("ABC-001", { itemDescription: "Changed" }) as never).contentHash)
      .not.toBe(mapped.contentHash);
    // No price anywhere in the mapped row: keys only, never values.
    expect(collectKeys(mapped).some((key) => /price/i.test(key))).toBe(false);
  });

  it("stores Inactive items as not displayable and other statuses too", () => {
    expect(mapCatalogItem(rawItem("ABC-002", { status: "Inactive" }) as never).isDisplayable).toBe(false);
    expect(mapCatalogItem(rawItem("ABC-003", { status: "Discontinued" }) as never).isDisplayable).toBe(false);
    expect(mapCatalogItem(rawItem("ABC-004", { status: "active" }) as never).isDisplayable).toBe(true);
  });

  it("preserves empty hierarchy level nodes instead of failing", () => {
    const hierarchy = {
      productGroup: {
        code: "PG1", label: "Group",
        category: { code: "CA1", label: "Cat", productType: { code: "", label: "", materialComposition: { code: "MC1", label: "Mat" } } },
      },
    };
    const levels = mapHierarchyLevels(hierarchy);
    expect(levels).toHaveLength(4);
    expect(levels?.[2]).toEqual({ level: "productType", code: "", label: "", name: null });
    expect(hierarchyPathKey(levels ?? [])).toBe("PG1/CA1//MC1//");
    expect(mapHierarchyLevels(null)).toBeNull();
    expect(mapHierarchyLevels("not-an-object")).toBeNull();
    expect(mapHierarchyLevels({})).toBeNull();
  });

  it("refuses any price-like key in the stored payload", () => {
    expect(() =>
      mapCatalogItem(rawItem("ABC-005", { uoms: [{ code: "BD", unitPrice: 12.5 }] }) as never),
    ).toThrow(AbcCatalogImportError);
  });

  it("refuses a price-like key nested deeper than any fixed scan depth", () => {
    // Eleven nested `meta` objects put `unitPrice` past the depth a
    // capped scan would reach; the scan must cover the whole value.
    let deep: Record<string, unknown> = { unitPrice: 1 };
    for (let i = 0; i < 11; i++) deep = { meta: deep };
    expect(() =>
      mapCatalogItem(rawItem("ABC-006", { uoms: [deep] }) as never),
    ).toThrow(AbcCatalogImportError);
  });
});

describe("abc catalog full import (issue #735, Phase 2)", () => {
  it("imports two pages, seeds hierarchy, and reports a succeeded run", async () => {
    const fake = createFakeDb();
    const catalog = fakeCatalog([
      { items: [rawItem("ABC-101"), rawItem("ABC-102", { status: "Inactive" })], totalItems: 3, totalPages: 2 },
      { items: [rawItem("ABC-103")], totalItems: 3, totalPages: 2 },
    ]);
    const report = await runImport(fake, catalog);

    expect(report.status).toBe("succeeded");
    expect(report.providerTotalItems).toBe(3);
    expect(report.itemsSeen).toBe(3);
    expect(report.itemsAdded).toBe(3);
    expect(report.itemsUpdated).toBe(0);
    expect(report.itemsDeactivated).toBe(1);
    expect(report.checkpointPage).toBe(2);
    expect(report.hierarchyPathsSeen).toBeGreaterThanOrEqual(1);
    expect(fake.items.size).toBe(3);
    expect(fake.items.get("ABC-102")?.isDisplayable).toBe(false);
    expect(fake.items.get("ABC-101")?.isDisplayable).toBe(true);
    const run = fake.runs.get(report.runId ?? "");
    expect(run?.status).toBe("succeeded");
    expect(run?.checkpointPage).toBe(2);
    expect(fake.getState()?.lastSuccessfulRunId).toBe(report.runId);
    expect(fake.getState()?.lastSeenTotalItems).toBe(3);
    // No tenant-model writes, ever.
    expect(fake.calls.supplierProduct).not.toHaveBeenCalled();
    expect(fake.calls.material).not.toHaveBeenCalled();
    // No price keys stored in any row.
    for (const row of fake.items.values()) {
      expect(collectKeys(row).some((key) => /price/i.test(key))).toBe(false);
    }
  });

  it("produces 0 adds / 0 updates on a second identical run", async () => {
    const fake = createFakeDb();
    const pages = [
      { items: [rawItem("ABC-201"), rawItem("ABC-202")], totalItems: 2, totalPages: 1 },
    ];
    const first = await runImport(fake, fakeCatalog(pages));
    expect(first.itemsAdded).toBe(2);
    const second = await runImport(fake, fakeCatalog(pages));
    expect(second.status).toBe("succeeded");
    expect(second.itemsSeen).toBe(2);
    expect(second.itemsAdded).toBe(0);
    expect(second.itemsUpdated).toBe(0);
    expect(second.itemsDeactivated).toBe(0);
    expect(second.hierarchyAdded).toBe(0);
    expect(second.hierarchyUpdated).toBe(0);
  });

  it("counts a changed item as one update and a reactivation correctly", async () => {
    const fake = createFakeDb();
    const firstPages = [{ items: [rawItem("ABC-301", { status: "Inactive" })], totalItems: 1, totalPages: 1 }];
    await runImport(fake, fakeCatalog(firstPages));
    expect(fake.items.get("ABC-301")?.isDisplayable).toBe(false);
    const changedPages = [{ items: [rawItem("ABC-301", { status: "Active", itemDescription: "New description" })], totalItems: 1, totalPages: 1 }];
    const second = await runImport(fake, fakeCatalog(changedPages));
    expect(second.itemsUpdated).toBe(1);
    expect(second.itemsAdded).toBe(0);
    expect(second.itemsDeactivated).toBe(0);
    expect(fake.items.get("ABC-301")?.isDisplayable).toBe(true);
    expect(fake.items.get("ABC-301")?.description).toBe("New description");
  });

  it("resumes a bounded partial run from its checkpoint without duplicates", async () => {
    const fake = createFakeDb();
    const pages = [
      { items: [rawItem("ABC-401")], totalItems: 3, totalPages: 3 },
      { items: [rawItem("ABC-402")], totalItems: 3, totalPages: 3 },
      { items: [rawItem("ABC-403")], totalItems: 3, totalPages: 3 },
    ];
    const bounded = await runImport(fake, fakeCatalog(pages), { maxPages: 1 });
    expect(bounded.status).toBe("partial");
    expect(bounded.checkpointPage).toBe(1);
    expect(bounded.itemsSeen).toBe(1);
    expect(bounded.error).toMatch(/catalog_import_bounded_stop/);
    const resumed = await runImport(fake, fakeCatalog(pages), { resumeRunId: bounded.runId ?? "" });
    expect(resumed.status).toBe("succeeded");
    expect(resumed.runId).toBe(bounded.runId);
    // Counts are cumulative for the run: 1 page from the bounded attempt
    // plus 2 pages from the resume.
    expect(resumed.itemsSeen).toBe(3);
    expect(resumed.itemsAdded).toBe(3);
    expect(resumed.pagesProcessed).toBe(3);
    expect(fake.items.size).toBe(3);
    expect(fake.runs.get(bounded.runId ?? "")?.checkpointPage).toBe(3);
  });

  it("refuses to start a second run while one is live, but resumes it", async () => {
    const fake = createFakeDb();
    const pages = [{ items: [rawItem("ABC-501")], totalItems: 1, totalPages: 1 }];
    const bounded = await runImport(fake, fakeCatalog(pages), { maxPages: 1 });
    // A bounded run ends partial; simulate a killed run by leaving a run
    // in `running` state with a checkpoint.
    const live = fake.runs.get(bounded.runId ?? "");
    if (live) live.status = "running";
    await expect(runImport(fake, fakeCatalog(pages))).rejects.toThrow(AbcCatalogImportError);
    await expect(runImport(fake, fakeCatalog(pages))).rejects.toMatchObject({ code: "catalog_import_already_running" });
    const resumed = await runImport(fake, fakeCatalog(pages), { resumeRunId: bounded.runId ?? "" });
    expect(resumed.status).toBe("succeeded");
  });

  it("dry-run counts without writing anything", async () => {
    const fake = createFakeDb();
    const pages = [
      { items: [rawItem("ABC-601"), rawItem("ABC-602", { status: "Inactive" })], totalItems: 2, totalPages: 1 },
    ];
    const report = await runImport(fake, fakeCatalog(pages), { dryRun: true });
    expect(report.status).toBe("succeeded");
    expect(report.dryRun).toBe(true);
    expect(report.runId).toBeNull();
    expect(report.itemsSeen).toBe(2);
    expect(report.itemsAdded).toBe(2);
    expect(report.itemsDeactivated).toBe(1);
    expect(fake.items.size).toBe(0);
    expect(fake.runs.size).toBe(0);
    expect(fake.getState()).toBeNull();
    expect(fake.calls.supplierProduct).not.toHaveBeenCalled();
  });

  it("dry-run logs per-page progress so a stall leaves a signal", async () => {
    const fake = createFakeDb();
    const pages = [
      { items: [rawItem("ABC-601"), rawItem("ABC-602", { status: "Inactive" })], totalItems: 2, totalPages: 1 },
    ];
    const lines: string[] = [];
    const report = await runImport(fake, fakeCatalog(pages), {
      dryRun: true,
      log: (line: string) => {
        lines.push(line);
      },
    });
    expect(report.status).toBe("succeeded");
    // Counts only — no item content, tokens, or payloads in the lines.
    expect(lines).toContain("[abc-catalog-import] hierarchy page 1/1 counted (dry run): 1 paths seen");
    expect(lines).toContain("[abc-catalog-import] page 1/1 counted (dry run): seen 2, +2/~0");
    expect(lines.some((line) => line.includes("dry run headroom ok"))).toBe(true);
  });

  it("aborts as partial on provider total drift with the checkpoint preserved", async () => {
    const fake = createFakeDb();
    const drifting = fakeCatalog([
      { items: [rawItem("ABC-701")], totalItems: 2, totalPages: 2 },
      { items: [rawItem("ABC-702")], totalItems: 3, totalPages: 2 },
    ]);
    const report = await runImport(fake, drifting);
    expect(report.status).toBe("partial");
    expect(report.checkpointPage).toBe(1);
    expect(report.itemsSeen).toBe(1);
    expect(report.error).toMatch(/catalog_import_pagination_drift/);
    expect(fake.items.size).toBe(1);
  });

  it("computes the expected page count only when the totals fit the 1000-item contract", () => {
    expect(expectedPageItemCount(1, 258494, 259)).toBe(1000);
    expect(expectedPageItemCount(259, 258494, 259)).toBe(494);
    expect(expectedPageItemCount(1, 1000, 1)).toBe(1000);
    expect(expectedPageItemCount(1, 1500, 2)).toBe(1000);
    expect(expectedPageItemCount(2, 1500, 2)).toBe(500);
    // Totals that cannot come from 1000-item pages have no baseline.
    expect(expectedPageItemCount(1, 3, 2)).toBeNull();
    expect(expectedPageItemCount(2, 3, 2)).toBeNull();
  });

  it("aborts as partial on a truncated non-final page, checkpoint preserved", async () => {
    const fake = createFakeDb();
    const fullPage = Array.from({ length: 1000 }, (_, i) => rawItem(`ABC-S${String(i).padStart(4, "0")}`));
    const shortPage = Array.from({ length: 500 }, (_, i) => rawItem(`ABC-T${String(i).padStart(4, "0")}`));
    const catalog = fakeCatalog([
      { items: fullPage, totalItems: 2500, totalPages: 3 },
      { items: shortPage, totalItems: 2500, totalPages: 3 },
      { items: shortPage, totalItems: 2500, totalPages: 3 },
    ]);
    const report = await runImport(fake, catalog);
    expect(report.status).toBe("partial");
    expect(report.error).toMatch(/catalog_import_short_page/);
    expect(report.checkpointPage).toBe(1);
    expect(report.itemsSeen).toBe(1000);
    expect(fake.items.size).toBe(1000);
  });

  it("aborts as partial when the only page is short of the stated total", async () => {
    const fake = createFakeDb();
    const catalog = fakeCatalog([
      { items: [rawItem("ABC-S001")], totalItems: 1000, totalPages: 1 },
    ]);
    const report = await runImport(fake, catalog);
    expect(report.status).toBe("partial");
    expect(report.error).toMatch(/catalog_import_short_page/);
    expect(report.checkpointPage).toBe(0);
    expect(report.itemsSeen).toBe(0);
    expect(fake.items.size).toBe(0);
  });

  it("accepts a short final page that matches the stated total", async () => {
    const fake = createFakeDb();
    const fullPage = Array.from({ length: 1000 }, (_, i) => rawItem(`ABC-U${String(i).padStart(4, "0")}`));
    const finalPage = Array.from({ length: 500 }, (_, i) => rawItem(`ABC-V${String(i).padStart(4, "0")}`));
    const catalog = fakeCatalog([
      { items: fullPage, totalItems: 1500, totalPages: 2 },
      { items: finalPage, totalItems: 1500, totalPages: 2 },
    ]);
    const report = await runImport(fake, catalog);
    expect(report.status).toBe("succeeded");
    expect(report.itemsSeen).toBe(1500);
    expect(report.checkpointPage).toBe(2);
  });

  it("dry-run bounded by max-pages ends partial with a bounded stop", async () => {
    const fake = createFakeDb();
    const pages = [
      { items: [rawItem("ABC-W01")], totalItems: 2, totalPages: 2 },
      { items: [rawItem("ABC-W02")], totalItems: 2, totalPages: 2 },
    ];
    const report = await runImport(fake, fakeCatalog(pages), { dryRun: true, maxPages: 1 });
    expect(report.status).toBe("partial");
    expect(report.error).toMatch(/catalog_import_bounded_stop/);
    expect(report.itemsSeen).toBe(1);
    expect(report.runId).toBeNull();
    expect(fake.items.size).toBe(0);
    expect(fake.runs.size).toBe(0);
  });

  it("revalidates page 1 when resuming a run that failed before any page committed", async () => {
    const fake = createFakeDb();
    const empty = fakeCatalog([{ items: [], totalItems: 0, totalPages: 0 }]);
    await expect(runImport(fake, empty)).rejects.toMatchObject({
      code: "catalog_import_empty_provider_response",
    });
    const failed = [...fake.runs.values()].find((row) => row.status === "failed");
    expect(failed?.checkpointPage).toBe(0);
    expect(failed?.providerTotalItems).toBe(0);
    // Without the revalidation, the resume would restore totals 0/0, skip
    // every item page, and succeed vacuously.
    const resumed = await runImport(
      fake,
      fakeCatalog([{ items: [rawItem("ABC-X01")], totalItems: 1, totalPages: 1 }]),
      { resumeRunId: failed?.id ?? "" },
    );
    expect(resumed.status).toBe("succeeded");
    expect(resumed.runId).toBe(failed?.id);
    expect(resumed.itemsSeen).toBe(1);
    expect(resumed.providerTotalItems).toBe(1);
    expect(fake.items.size).toBe(1);
  });

  it("takes the ownership lock, budgets page transactions, and batches hierarchy reads", async () => {
    const fake = createFakeDb();
    const pages = [
      { items: [rawItem("ABC-Y01")], totalItems: 2, totalPages: 2 },
      { items: [rawItem("ABC-Y02")], totalItems: 2, totalPages: 2 },
    ];
    const report = await runImport(fake, fakeCatalog(pages));
    expect(report.status).toBe("succeeded");
    const queryRawCalls = (fake.tx.$queryRaw as jest.Mock).mock.calls;
    expect(queryRawCalls.some(([arg]: any[]) =>
      JSON.stringify(arg).includes("app.abc_catalog_ingestion"))).toBe(true);
    const executeRawCalls = (fake.tx.$executeRaw as jest.Mock).mock.calls;
    expect(executeRawCalls.some(([arg]: any[]) =>
      JSON.stringify(arg).includes("pg_advisory_xact_lock"))).toBe(true);
    const txCalls = ((fake.db as Record<string, any>).$transaction as jest.Mock).mock.calls;
    expect(txCalls.some(([, options]: any[]) => options?.timeout === 120_000)).toBe(true);
    // No per-item hierarchy read: distinct paths are read once per page.
    expect(fake.tx.abcCatalogHierarchy.findUnique).not.toHaveBeenCalled();
    expect(fake.tx.abcCatalogHierarchy.findMany).toHaveBeenCalled();
  });

  it("fails closed on an empty first page and retains stored data", async () => {
    const fake = createFakeDb();
    await runImport(fake, fakeCatalog([
      { items: [rawItem("ABC-801")], totalItems: 1, totalPages: 1 },
    ]));
    expect(fake.items.size).toBe(1);
    const empty = fakeCatalog([
      { items: [], totalItems: 0, totalPages: 0 },
    ]);
    await expect(runImport(fake, empty)).rejects.toMatchObject({ code: "catalog_import_empty_provider_response" });
    expect(fake.items.size).toBe(1);
    expect(fake.items.get("ABC-801")?.description).toBe("Description for ABC-801");
    const failedRuns = [...fake.runs.values()].filter((row) => row.status === "failed");
    expect(failedRuns).toHaveLength(1);
  });

  it("captures per-item failures without aborting the sync", async () => {
    const fake = createFakeDb();
    const pages = [
      {
        items: [
          rawItem("ABC-901"),
          rawItem("ABC-902", { uoms: [{ code: "BD", listPrice: 9.99 }] }),
          rawItem("ABC-903"),
        ],
        totalItems: 3,
        totalPages: 1,
      },
    ];
    const report = await runImport(fake, fakeCatalog(pages));
    expect(report.status).toBe("succeeded");
    expect(report.itemsSeen).toBe(3);
    expect(report.itemsAdded).toBe(2);
    expect(report.itemsFailed).toBe(1);
    expect(report.error).toMatch(/failed_items: 1/);
    // The stdout report is counts only — the failing item number stays in
    // the run row's audit record, never in the report.
    expect(report.error).not.toContain("ABC-902");
    expect(fake.runs.get(report.runId ?? "")?.error).toContain("ABC-902");
    expect(fake.items.has("ABC-902")).toBe(false);
    expect(fake.items.size).toBe(2);
  });

  it("aborts the run (not the item) when a page transaction fails", async () => {
    const fake = createFakeDb();
    const pages = [
      { items: [rawItem("ABC-A01")], totalItems: 2, totalPages: 2 },
      { items: [rawItem("ABC-A02")], totalItems: 2, totalPages: 2 },
    ];
    const first = await runImport(fake, fakeCatalog(pages), { maxPages: 1 });
    expect(first.status).toBe("partial");
    fake.failUpsertOnce.current = true;
    await expect(runImport(fake, fakeCatalog(pages), { resumeRunId: first.runId ?? "" }))
      .rejects.toMatchObject({ code: "catalog_import_failed" });
    const run = fake.runs.get(first.runId ?? "");
    expect(run?.status).toBe("failed");
    expect(run?.checkpointPage).toBe(1);
    expect(fake.items.size).toBe(1);
    // Resume after the transient DB failure completes the import.
    const resumed = await runImport(fake, fakeCatalog(pages), { resumeRunId: first.runId ?? "" });
    expect(resumed.status).toBe("succeeded");
    expect(fake.items.size).toBe(2);
  });

  it("skips malformed hierarchy entries and still succeeds", async () => {
    const fake = createFakeDb();
    const catalog = fakeCatalog(
      [{ items: [rawItem("ABC-B01")], totalItems: 1, totalPages: 1 }],
      [{ entries: ["not-an-object", { somethingElse: true }, hierarchyEntry()], totalItems: 3, totalPages: 1 }],
    );
    const report = await runImport(fake, catalog);
    expect(report.status).toBe("succeeded");
    expect(report.hierarchyPathsSeen).toBe(1);
    expect(report.hierarchySkipped).toBe(2);
    expect(report.hierarchyAdded).toBeGreaterThanOrEqual(1);
  });

  it("fails the headroom gate before any provider call", async () => {
    const fake = createFakeDb({ usedBytes: BigInt(9 * 1024 * 1024 * 1024) });
    const catalog = fakeCatalog([
      { items: [rawItem("ABC-C01")], totalItems: 1, totalPages: 1 },
    ]);
    await expect(runImport(fake, catalog)).rejects.toMatchObject({ code: "catalog_import_insufficient_headroom" });
    expect(catalog.listRaw).not.toHaveBeenCalled();
    expect(fake.items.size).toBe(0);
    const failedRuns = [...fake.runs.values()].filter((row) => row.status === "failed");
    expect(failedRuns).toHaveLength(1);
    expect(failedRuns[0].error).toMatch(/catalog_import_insufficient_headroom/);
  });

  it("fails closed when no database capacity is configured", async () => {
    const fake = createFakeDb();
    const catalog = fakeCatalog([
      { items: [rawItem("ABC-D01")], totalItems: 1, totalPages: 1 },
    ]);
    const saved = process.env.ABC_CATALOG_DB_CAPACITY_BYTES;
    delete process.env.ABC_CATALOG_DB_CAPACITY_BYTES;
    try {
      await expect(runFullCatalogImport(fake.db as unknown as PrismaClient, catalog, {
        now: () => new Date("2026-11-27T00:00:00.000Z"),
        log: () => undefined,
      })).rejects.toMatchObject({ code: "catalog_import_headroom_unconfigured" });
    } finally {
      if (saved !== undefined) process.env.ABC_CATALOG_DB_CAPACITY_BYTES = saved;
    }
    expect(catalog.listRaw).not.toHaveBeenCalled();
  });

  it("rejects resuming a succeeded run", async () => {
    const fake = createFakeDb();
    const pages = [{ items: [rawItem("ABC-E01")], totalItems: 1, totalPages: 1 }];
    const done = await runImport(fake, fakeCatalog(pages));
    expect(done.status).toBe("succeeded");
    await expect(runImport(fake, fakeCatalog(pages), { resumeRunId: done.runId ?? "" }))
      .rejects.toMatchObject({ code: "catalog_import_run_already_succeeded" });
  });
});

describe("abc catalog import CLI (issue #735, Phase 2)", () => {
  it("parses the bounded, resume, and dry-run flags", () => {
    expect(parseArgs(["--dry-run", "--max-pages", "3"])).toEqual({
      dryRun: true,
      maxPages: 3,
    });
    expect(parseArgs(["--resume", "run-1", "--correlation-id", "abc", "--db-capacity-bytes", "42"])).toEqual({
      dryRun: false,
      maxPages: 0,
      resumeRunId: "run-1",
      correlationId: "abc",
      dbCapacityBytes: 42,
    });
    expect(() => parseArgs(["--bogus"])).toThrow("invalid_import_arguments");
    expect(() => parseArgs(["--max-pages", "-1"])).toThrow("invalid_import_arguments");
  });

  it("classifies importer and provider failures without leaking detail", () => {
    expect(classifyImportError(new AbcCatalogImportError("catalog_import_headroom_unconfigured"))).toBe(
      "catalog_import_headroom_unconfigured",
    );
    expect(classifyImportError(new Error("ABC catalog provider denied request: HTTP 403"))).toBe("provider_denied");
    expect(classifyImportError(new Error("Duplicate ABC item number in provider page"))).toBe("provider_duplicate_item");
    expect(classifyImportError(new Error("something else entirely"))).toBe("import_or_provider_failure");
  });

  it("sanitizes failed item numbers out of the stdout report copy", () => {
    const report = {
      runId: "run-1",
      kind: "full",
      status: "succeeded",
      dryRun: false,
      correlationId: "abc",
      providerTotalItems: 3,
      providerTotalPages: 1,
      pagesProcessed: 1,
      itemsSeen: 3,
      itemsAdded: 2,
      itemsUpdated: 0,
      itemsDeactivated: 0,
      itemsFailed: 1,
      hierarchyPathsSeen: 0,
      hierarchyAdded: 0,
      hierarchyUpdated: 0,
      hierarchySkipped: 0,
      checkpointPage: 1,
      databaseUsedBytes: null,
      databaseFreeBytes: null,
      error: "failed_items: 1; first item numbers: ABC-902",
    } as const;
    const sanitized = sanitizeReportForStdout(report);
    expect(sanitized.error).toBe("failed_items: 1");
    expect(sanitized.error).not.toContain("ABC-902");
    expect(sanitized.runId).toBe("run-1");
    expect(sanitized.itemsFailed).toBe(1);
    // The caller's report is untouched — the database audit record keeps it.
    expect(report.error).toContain("ABC-902");
  });

  it("requires at least ~2 GB free", () => {
    expect(ABC_CATALOG_IMPORT_MIN_FREE_BYTES).toBe(2 * 1024 * 1024 * 1024);
  });
});
