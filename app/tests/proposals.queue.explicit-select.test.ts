// Regression tests for #1093: the proposals queue must not select-all.
//
// Production Today failed with "Proposal follow-ups could not load" because
// listOrganizationQueue ran a select-all Prisma findMany against a database
// whose migrations lagged the code: the seven DES-10-F7 signature columns
// (signerName / signerEmail / signatureDataUrl / signatureIpReported /
// signatureUserAgentReported / signedAt / declinedReason) did not exist yet,
// so Postgres raised 42703 and the whole queue 500ed. The queue item only
// consumes id / projectId / status / finalPrice / sentAt / viewedAt /
// updatedAt plus the project/customer names and the latest contract id, so
// the query must request exactly those columns — mirroring the invoices
// queue's explicit-column raw SQL — and a future additive column must
// degrade one field, not the queue.
//
// The fake Prisma model below is wrapped with a lagging-database guard: any
// findMany without an explicit select (or one that names a column the lagging
// database lacks) throws a 42703-style error, exactly as production did.
// These tests FAIL on the select-all implementation and PASS once the
// explicit select list lands.
import { createFakeModel, FakeRow } from "./helpers/fakeAthenaObservabilityDb";

const proposals: FakeRow[] = [];

const mockPrisma = {
  proposal: createFakeModel(proposals),
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { ProposalsService } from "../modules/proposals/service";

// Columns the lagging production database lacked when #1093 was filed.
const MISSING_COLUMNS = [
  "signerName",
  "signerEmail",
  "signatureDataUrl",
  "signatureIpReported",
  "signatureUserAgentReported",
  "signedAt",
  "declinedReason",
];

type FakeFindManyArgs = Parameters<typeof mockPrisma.proposal.findMany>[0];

// Simulate the lagging database: a select-all read (or one naming a missing
// column) fails with Postgres 42703; an explicit select that avoids the
// missing columns succeeds.
const rawFindMany = mockPrisma.proposal.findMany;
mockPrisma.proposal.findMany = jest.fn(async (args: FakeFindManyArgs = {}) => {
  const select = (args as { select?: Record<string, unknown> }).select;
  if (!select) {
    const error = new Error('column "signer_name" does not exist') as Error & { code: string };
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
  const orgId = overrides.orgId;
  proposals.push({
    projectId: overrides.projectId ?? "project-1",
    status: overrides.status ?? "draft",
    finalPrice: overrides.finalPrice ?? null,
    sentAt: overrides.sentAt ?? null,
    viewedAt: overrides.viewedAt ?? null,
    contracts: overrides.contracts ?? [],
    project: overrides.project ?? { orgId, name: "Kitchen Remodel", customer: { name: "Jane Homeowner" } },
    ...overrides,
  });
}

describe("ProposalsService.listOrganizationQueue explicit select (#1093)", () => {
  const service = new ProposalsService();

  beforeEach(() => {
    proposals.length = 0;
    jest.clearAllMocks();
  });

  it("loads the queue when the database lacks the F7 signature columns", async () => {
    seed({
      id: "prop-a",
      orgId: ORG_A,
      updatedAt: new Date("2026-08-10T00:00:00.000Z"),
      status: "accepted",
      finalPrice: 8500,
      sentAt: new Date("2026-08-05T00:00:00.000Z"),
      contracts: [{ id: "contract-1" }],
      // The lagging database has no such columns; the row carries values only
      // so the DTO mapping is proven identical with them present.
      signerName: "TEST Customer",
      signerEmail: "test@example.com",
      signatureDataUrl: "data:image/png;base64,AAAA",
      signedAt: new Date("2026-08-06T00:00:00.000Z"),
    });

    const result = await service.listOrganizationQueue({ orgId: ORG_A });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: "prop-a",
      projectName: "Kitchen Remodel",
      customerName: "Jane Homeowner",
      status: "accepted",
      amount: 8500,
      contractId: "contract-1",
    });
  });

  it("requests exactly the columns the queue item consumes, and no include", async () => {
    seed({ id: "prop-a", orgId: ORG_A, updatedAt: new Date("2026-08-10T00:00:00.000Z") });

    await service.listOrganizationQueue({ orgId: ORG_A });

    expect(mockPrisma.proposal.findMany).toHaveBeenCalledTimes(1);
    const args = (mockPrisma.proposal.findMany as jest.Mock).mock.calls[0][0] as {
      select?: unknown;
      include?: unknown;
    };
    expect(args.include).toBeUndefined();
    expect(args.select).toEqual({
      id: true,
      projectId: true,
      status: true,
      finalPrice: true,
      sentAt: true,
      viewedAt: true,
      updatedAt: true,
      project: { select: { name: true, customer: { select: { name: true } } } },
      contracts: { select: { id: true }, orderBy: { createdAt: "desc" }, take: 1 },
    });
  });
});
