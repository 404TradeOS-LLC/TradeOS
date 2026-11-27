import { Prisma, PrismaClient } from "@prisma/client";
import {
  runFullCatalogImport,
  type AbcCatalogImportCatalog,
} from "../modules/supplier-integration/abcCatalogImport";

// Live-database proof for the Phase 2 importer (issue #735). Runs against
// the disposable Postgres provisioned by scripts/test-integration-db.sh
// (TEST_DATABASE_URL = restricted app role, TEST_DATABASE_ADMIN_URL =
// elevated admin). The provider is a stub: no ABC credentials, no network,
// no pricing — the same service code the CLI runs, with canned pages.
//
// Fixtures use the ABC-IMPORT-INT- prefix everywhere and are removed in
// afterAll through the admin client, so no other integration file sees
// them. The single-row sync state is deleted only when it points at this
// file's run.

const appDatabaseUrl = requiredEnvironment("TEST_DATABASE_URL");
const adminDatabaseUrl = requiredEnvironment("TEST_DATABASE_ADMIN_URL");
const appClient = new PrismaClient({ datasources: { db: { url: appDatabaseUrl } } });
const adminClient = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

const PREFIX = "ABC-IMPORT-INT-";
const CORRELATION = "abc-import-integration";

function rawItem(itemNumber: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    itemNumber,
    itemDescription: `Integration item ${itemNumber}`,
    familyId: "FAM-INT",
    familyName: "Integration Family",
    supplierName: "Integration Maker",
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
        code: "PG-INT", label: "Int Group", name: "Int Group Name",
        category: {
          code: "CA-INT", label: "Int Cat", name: "Int Cat Name",
          productType: {
            code: "PT-INT", label: "Int Type", name: "Int Type Name",
            materialComposition: {
              code: "MC-INT", label: "Int Mat", name: "Int Mat Name",
              warranty: {
                code: "", label: "",
                brandLine: { code: "BL-INT", label: "Int Brand", name: "Int Brand Name" },
              },
            },
          },
        },
      },
    },
    ...overrides,
  };
}

function hierarchyEntry(): Record<string, unknown> {
  return {
    productGroup: {
      code: "PG-INT", label: "Int Group", name: "Int Group Name",
      category: {
        code: "CA-INT", label: "Int Cat", name: "Int Cat Name",
        productType: {
          code: "PT-INT", label: "Int Type", name: "Int Type Name",
          materialComposition: {
            code: "MC-INT", label: "Int Mat", name: "Int Mat Name",
            warranty: {
              code: "WA-INT", label: "Int Warr", name: "Int Warr Name",
              brandLine: { code: "BL-INT", label: "Int Brand", name: "Int Brand Name" },
            },
          },
        },
      },
    },
  };
}

function stubCatalog(
  pages: Array<{ items: Record<string, unknown>[]; totalItems: number; totalPages: number }>,
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
      if (pageNumber !== 1) throw new Error("unexpected hierarchy page " + pageNumber);
      return {
        hierarchies: [hierarchyEntry()],
        pagination: { itemsPerPage: 50, pageNumber: 1, totalPages: 1, totalItems: 1 },
        source: "ABC Supply",
        environment: "sandbox",
        pricing: "not-requested",
        persisted: false,
      };
    }) as unknown as AbcCatalogImportCatalog["listHierarchyRaw"],
  };
}

const baseOptions = {
  dbCapacityBytes: 10 * 1024 * 1024 * 1024,
  correlationId: CORRELATION,
  log: () => undefined,
};

/**
 * Read through the restricted app role the same way the importer does:
 * inside a transaction that sets the ingestion flag. A bare app-role read
 * sees nothing — the global SELECT policy requires an org session or the
 * flag, and RLS hides rows silently instead of erroring (Phase 1 RLS
 * test). Verification reads must use this helper (or the admin client),
 * never a bare app-role query.
 */
async function readWithIngestionFlag<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return appClient.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`select set_config('app.abc_catalog_ingestion', 'true', true)`);
    return fn(tx);
  });
}

describe("abc catalog full import against live Postgres (issue #735, Phase 2)", () => {
  afterAll(async () => {
    const state = await adminClient.abcCatalogSyncState.findUnique({ where: { id: "abc-catalog" } });
    const runIds = (await adminClient.abcCatalogSyncRun.findMany({
      where: { correlationId: CORRELATION },
      select: { id: true },
    })).map((row) => row.id);
    if (state?.lastSuccessfulRunId && runIds.includes(state.lastSuccessfulRunId)) {
      await adminClient.abcCatalogSyncState.delete({ where: { id: "abc-catalog" } });
    }
    await adminClient.abcCatalogSyncRun.deleteMany({ where: { correlationId: CORRELATION } });
    await adminClient.abcCatalogHierarchy.deleteMany({ where: { pathKey: { startsWith: "PG-INT/" } } });
    await adminClient.abcCatalogItem.deleteMany({ where: { itemNumber: { startsWith: PREFIX } } });
    await appClient.$disconnect();
    await adminClient.$disconnect();
  });

  it("imports through the restricted app role under the ingestion flag, then proves 0/0 on a second run", async () => {
    const pages = [
      {
        items: [
          rawItem(`${PREFIX}001`),
          rawItem(`${PREFIX}002`, { status: "Inactive" }),
        ],
        totalItems: 3,
        totalPages: 2,
      },
      { items: [rawItem(`${PREFIX}003`)], totalItems: 3, totalPages: 2 },
    ];
    const first = await runFullCatalogImport(appClient, stubCatalog(pages), baseOptions);
    expect(first.status).toBe("succeeded");
    expect(first.itemsSeen).toBe(3);
    expect(first.itemsAdded).toBe(3);
    expect(first.itemsDeactivated).toBe(1);
    expect(first.checkpointPage).toBe(2);

    // Rows are really in the database, readable by the app role under the
    // ingestion flag.
    const stored = await readWithIngestionFlag((tx) =>
      tx.$queryRaw<Array<{ item_number: string; is_displayable: boolean; content_hash: string }>>(
        Prisma.sql`select item_number, is_displayable, content_hash from abc_catalog_items where item_number like ${PREFIX + "%"} order by item_number`,
      ),
    );
    expect(stored.map((row) => row.item_number)).toEqual([`${PREFIX}001`, `${PREFIX}002`, `${PREFIX}003`]);
    expect(stored.find((row) => row.item_number === `${PREFIX}002`)?.is_displayable).toBe(false);
    for (const row of stored) {
      expect(row.content_hash).toMatch(/^[0-9a-f]{64}$/);
    }
    // No price column exists to hold a price, and the stored JSONB carries
    // no price key.
    const priceKeys = await readWithIngestionFlag((tx) =>
      tx.$queryRaw<Array<{ found: boolean }>>(
        Prisma.sql`select exists (select 1 from abc_catalog_items where item_number like ${PREFIX + "%"} and (uoms::text ilike '%price%' or dimensions::text ilike '%price%' or prop65_warnings::text ilike '%price%')) as found`,
      ),
    );
    expect(priceKeys[0]?.found).toBe(false);
    // The empty warranty node is preserved: its code collapses to '' in
    // the path key and the hierarchy row exists.
    const hierarchy = await readWithIngestionFlag((tx) =>
      tx.abcCatalogHierarchy.findUnique({
        where: { pathKey: "PG-INT/CA-INT/PT-INT/MC-INT//BL-INT" },
      }),
    );
    expect(hierarchy).not.toBeNull();
    expect(hierarchy?.levels).toEqual(
      expect.arrayContaining([expect.objectContaining({ level: "warranty", code: "", label: "" })]),
    );

    // The run row and sync state are the audit trail.
    const run = await readWithIngestionFlag((tx) =>
      tx.abcCatalogSyncRun.findUnique({ where: { id: first.runId ?? "" } }),
    );
    expect(run?.status).toBe("succeeded");
    expect(run?.checkpointPage).toBe(2);
    const state = await readWithIngestionFlag((tx) =>
      tx.abcCatalogSyncState.findUnique({ where: { id: "abc-catalog" } }),
    );
    expect(state?.lastSuccessfulRunId).toBe(first.runId);
    expect(state?.lastSeenTotalItems).toBe(3);

    // The import created no tenant rows for these items (admin sees all).
    expect(await adminClient.supplierProduct.count({
      where: { supplierProductKey: { contains: PREFIX } },
    })).toBe(0);
    expect(await adminClient.material.count({
      where: { name: { contains: PREFIX } },
    })).toBe(0);

    // Second identical run: 0 adds / 0 updates / 0 deactivations.
    const second = await runFullCatalogImport(appClient, stubCatalog(pages), baseOptions);
    expect(second.status).toBe("succeeded");
    expect(second.itemsSeen).toBe(3);
    expect(second.itemsAdded).toBe(0);
    expect(second.itemsUpdated).toBe(0);
    expect(second.itemsDeactivated).toBe(0);
  });

  it("resumes a bounded partial run from its checkpoint against live Postgres", async () => {
    const pages = [
      { items: [rawItem(`${PREFIX}101`)], totalItems: 2, totalPages: 2 },
      { items: [rawItem(`${PREFIX}102`)], totalItems: 2, totalPages: 2 },
    ];
    const bounded = await runFullCatalogImport(appClient, stubCatalog(pages), {
      ...baseOptions,
      maxPages: 1,
    });
    expect(bounded.status).toBe("partial");
    expect(bounded.checkpointPage).toBe(1);
    const resumed = await runFullCatalogImport(appClient, stubCatalog(pages), {
      ...baseOptions,
      resumeRunId: bounded.runId ?? "",
    });
    expect(resumed.status).toBe("succeeded");
    expect(resumed.runId).toBe(bounded.runId);
    expect(resumed.itemsSeen).toBe(2);
    expect(await adminClient.abcCatalogItem.count({
      where: { itemNumber: { startsWith: `${PREFIX}10` } },
    })).toBe(2);
  });

  it("dry-run writes nothing to live Postgres", async () => {
    const pages = [
      { items: [rawItem(`${PREFIX}201`)], totalItems: 1, totalPages: 1 },
    ];
    const before = await adminClient.abcCatalogItem.count({
      where: { itemNumber: { startsWith: `${PREFIX}20` } },
    });
    const report = await runFullCatalogImport(appClient, stubCatalog(pages), {
      ...baseOptions,
      dryRun: true,
    });
    expect(report.status).toBe("succeeded");
    expect(report.runId).toBeNull();
    expect(report.itemsAdded).toBe(1);
    const after = await adminClient.abcCatalogItem.count({
      where: { itemNumber: { startsWith: `${PREFIX}20` } },
    });
    expect(after).toBe(before);
  });

  it("fails closed on an empty provider response and retains stored rows", async () => {
    // Seed one row first so this test is independent of file order.
    await runFullCatalogImport(
      appClient,
      stubCatalog([{ items: [rawItem(`${PREFIX}301`)], totalItems: 1, totalPages: 1 }]),
      baseOptions,
    );
    const stored = await adminClient.abcCatalogItem.count({
      where: { itemNumber: { startsWith: PREFIX } },
    });
    expect(stored).toBeGreaterThan(0);
    const empty = stubCatalog([{ items: [], totalItems: 0, totalPages: 0 }]);
    await expect(runFullCatalogImport(appClient, empty, baseOptions)).rejects.toMatchObject({
      code: "catalog_import_empty_provider_response",
    });
    expect(await adminClient.abcCatalogItem.count({
      where: { itemNumber: { startsWith: PREFIX } },
    })).toBe(stored);
  });

  it("resumes a run that failed on an empty first page and completes it", async () => {
    // A failed first page persists empty totals (0/0) with checkpoint 0;
    // the resume must revalidate page 1 instead of restoring those totals
    // and succeeding vacuously.
    const empty = stubCatalog([{ items: [], totalItems: 0, totalPages: 0 }]);
    await expect(runFullCatalogImport(appClient, empty, baseOptions)).rejects.toMatchObject({
      code: "catalog_import_empty_provider_response",
    });
    const failed = await adminClient.abcCatalogSyncRun.findFirst({
      where: { correlationId: CORRELATION, status: "failed" },
      orderBy: { startedAt: "desc" },
    });
    expect(failed?.checkpointPage).toBe(0);
    expect(failed?.providerTotalItems).toBe(0);
    const resumed = await runFullCatalogImport(
      appClient,
      stubCatalog([{ items: [rawItem(`${PREFIX}401`)], totalItems: 1, totalPages: 1 }]),
      { ...baseOptions, resumeRunId: failed?.id ?? "" },
    );
    expect(resumed.status).toBe("succeeded");
    expect(resumed.runId).toBe(failed?.id);
    expect(resumed.itemsSeen).toBe(1);
    expect(resumed.providerTotalItems).toBe(1);
    expect(await adminClient.abcCatalogItem.count({
      where: { itemNumber: `${PREFIX}401` },
    })).toBe(1);
  });
});
