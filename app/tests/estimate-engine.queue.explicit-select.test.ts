// Regression tests for #1093: the estimates queue must not select-all.
//
// Production Today failed with "Estimates in progress could not load" because
// listOrganizationQueue ran a select-all Prisma findMany against a database
// whose migrations lagged the code: the two DES-10-F2 review-checklist
// columns (exclusionsReviewedAt / priceSourcesReviewedAt) did not exist yet,
// so Postgres raised 42703 and the whole queue 500ed. The queue item only
// consumes id / projectId / version / status / totalPrice / createdAt /
// updatedAt plus the project/customer names, so the query must request
// exactly those columns — mirroring the invoices queue's explicit-column raw
// SQL — and a future additive column must degrade one field, not the queue.
//
// The fake Prisma model below is wrapped with a lagging-database guard: any
// findMany without an explicit select (or one that names a column the lagging
// database lacks) throws a 42703-style error, exactly as production did.
// These tests FAIL on the select-all implementation and PASS once the
// explicit select list lands.
import { createFakeModel, FakeRow } from "./helpers/fakeAthenaObservabilityDb";

const estimates: FakeRow[] = [];

const mockPrisma = {
  estimate: createFakeModel(estimates),
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { EstimateEngineService } from "../modules/estimate-engine/service";

// Columns the lagging production database lacked when #1093 was filed.
const MISSING_COLUMNS = ["exclusionsReviewedAt", "priceSourcesReviewedAt"];

type FakeFindManyArgs = Parameters<typeof mockPrisma.estimate.findMany>[0];

// Simulate the lagging database: a select-all read (or one naming a missing
// column) fails with Postgres 42703; an explicit select that avoids the
// missing columns succeeds.
const rawFindMany = mockPrisma.estimate.findMany;
mockPrisma.estimate.findMany = jest.fn(async (args: FakeFindManyArgs = {}) => {
  const select = (args as { select?: Record<string, unknown> }).select;
  if (!select) {
    const error = new Error('column "exclusions_reviewed_at" does not exist') as Error & { code: string };
    error.code = "42703";
    throw error;
  }
  const requested = Object.keys(select);
  const missing = MISSING_COLUMNS.find((column) => requested.includes(column));
  if (missing) {
    const error = new Error(`column "${missing}" does not exist`) as Error & { code: string };
    error.code = "42703";
    throw error;
  }
  return rawFindMany(args);
});

const ORG_A = "org-a";

function seed(overrides: Partial<FakeRow> & { id: string; orgId: string; updatedAt: Date }): void {
  estimates.push({
    projectId: overrides.projectId ?? "project-1",
    version: overrides.version ?? 1,
    status: overrides.status ?? "draft",
    totalPrice: overrides.totalPrice ?? 1000,
    createdAt: overrides.createdAt ?? overrides.updatedAt,
    project: overrides.project ?? { name: "Kitchen Remodel", customer: { name: "Jane Homeowner" } },
    ...overrides,
  });
}

describe("EstimateEngineService.listOrganizationQueue explicit select (#1093)", () => {
  const service = new EstimateEngineService();

  beforeEach(() => {
    estimates.length = 0;
    jest.clearAllMocks();
  });

  it("loads the queue when the database lacks the review-checklist columns", async () => {
    seed({
      id: "est-a",
      orgId: ORG_A,
      updatedAt: new Date("2026-08-10T00:00:00.000Z"),
      version: 2,
      totalPrice: 4200.5,
      status: "ready",
      // The lagging database has no such columns; the row carries values only
      // so the DTO mapping is proven identical with them present.
      exclusionsReviewedAt: new Date("2026-08-09T00:00:00.000Z"),
      priceSourcesReviewedAt: new Date("2026-08-09T00:00:00.000Z"),
    });

    const result = await service.listOrganizationQueue({ orgId: ORG_A });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: "est-a",
      projectName: "Kitchen Remodel",
      customerName: "Jane Homeowner",
      status: "ready",
      amount: 4200.5,
      revision: 2,
    });
  });

  it("requests exactly the columns the queue item consumes, and no include", async () => {
    seed({ id: "est-a", orgId: ORG_A, updatedAt: new Date("2026-08-10T00:00:00.000Z") });

    await service.listOrganizationQueue({ orgId: ORG_A });

    expect(mockPrisma.estimate.findMany).toHaveBeenCalledTimes(1);
    const args = (mockPrisma.estimate.findMany as jest.Mock).mock.calls[0][0] as {
      select?: unknown;
      include?: unknown;
    };
    expect(args.include).toBeUndefined();
    expect(args.select).toEqual({
      id: true,
      projectId: true,
      version: true,
      status: true,
      totalPrice: true,
      createdAt: true,
      updatedAt: true,
      project: { select: { name: true, customer: { select: { name: true } } } },
    });
  });
});
