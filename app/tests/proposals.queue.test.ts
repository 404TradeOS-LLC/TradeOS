// Reuses the in-memory Prisma-shaped query engine originally built for the
// A10 observability services (see tests/helpers/fakeAthenaObservabilityDb.ts)
// — proposals.service.ts's where/orderBy/cursor construction is the behavior
// under test here.
import { createFakeModel, FakeRow } from "./helpers/fakeAthenaObservabilityDb";

const proposals: FakeRow[] = [];

const mockPrisma = {
  proposal: createFakeModel(proposals),
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { ProposalsService } from "../modules/proposals/service";

const ORG_A = "org-a";
const ORG_B = "org-b";

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

describe("ProposalsService.listOrganizationQueue", () => {
  const service = new ProposalsService();

  beforeEach(() => {
    proposals.length = 0;
    jest.clearAllMocks();
  });

  it("scopes results to the caller's organization via the project join", async () => {
    seed({ id: "prop-a", orgId: ORG_A, updatedAt: new Date("2026-08-10T00:00:00.000Z") });
    seed({ id: "prop-b", orgId: ORG_B, updatedAt: new Date("2026-08-10T00:00:00.000Z") });

    const result = await service.listOrganizationQueue({ orgId: ORG_A });
    expect(result.items.map((i) => i.id)).toEqual(["prop-a"]);
    expect(result.total).toBe(1);
  });

  it("maps finalPrice to amount, resolves contractId from the linked contract, and normalizes status", async () => {
    seed({
      id: "prop-a",
      orgId: ORG_A,
      updatedAt: new Date("2026-08-10T00:00:00.000Z"),
      status: "rejected",
      finalPrice: 1500,
      contracts: [{ id: "contract-1" }],
      project: { orgId: ORG_A, name: "Roof Repair", customer: { name: "Acme Co" } },
    });

    const result = await service.listOrganizationQueue({ orgId: ORG_A });
    expect(result.items[0]).toMatchObject({
      status: "declined",
      amount: 1500,
      contractId: "contract-1",
      projectName: "Roof Repair",
      customerName: "Acme Co",
    });
  });

  it("returns a null amount and contractId when neither is set", async () => {
    seed({ id: "prop-a", orgId: ORG_A, updatedAt: new Date() });
    const result = await service.listOrganizationQueue({ orgId: ORG_A });
    expect(result.items[0].amount).toBeNull();
    expect(result.items[0].contractId).toBeNull();
  });

  it("filters by sent (sentAt not null)", async () => {
    seed({ id: "sent", orgId: ORG_A, sentAt: new Date("2026-08-01T00:00:00.000Z"), updatedAt: new Date("2026-08-01T00:00:00.000Z") });
    seed({ id: "unsent", orgId: ORG_A, sentAt: null, updatedAt: new Date("2026-08-02T00:00:00.000Z") });

    const result = await service.listOrganizationQueue({ orgId: ORG_A, sent: true });
    expect(result.items.map((i) => i.id)).toEqual(["sent"]);
  });

  it("filters by viewed (viewedAt not null)", async () => {
    seed({ id: "viewed", orgId: ORG_A, viewedAt: new Date("2026-08-01T00:00:00.000Z"), updatedAt: new Date("2026-08-01T00:00:00.000Z") });
    seed({ id: "unviewed", orgId: ORG_A, viewedAt: null, updatedAt: new Date("2026-08-02T00:00:00.000Z") });

    const result = await service.listOrganizationQueue({ orgId: ORG_A, viewed: true });
    expect(result.items.map((i) => i.id)).toEqual(["viewed"]);
  });

  it("unsigned means no Contract row exists yet, regardless of that contract's own status", async () => {
    seed({ id: "unsigned", orgId: ORG_A, contracts: [], updatedAt: new Date("2026-08-01T00:00:00.000Z") });
    seed({ id: "converted", orgId: ORG_A, contracts: [{ id: "contract-1" }], updatedAt: new Date("2026-08-02T00:00:00.000Z") });

    const result = await service.listOrganizationQueue({ orgId: ORG_A, unsigned: true });
    expect(result.items.map((i) => i.id)).toEqual(["unsigned"]);
  });

  it("stale filters by sentAt <= the caller-supplied staleBefore, with no hard-coded threshold", async () => {
    seed({ id: "old-send", orgId: ORG_A, sentAt: new Date("2026-07-01T00:00:00.000Z"), updatedAt: new Date("2026-07-01T00:00:00.000Z") });
    seed({ id: "recent-send", orgId: ORG_A, sentAt: new Date("2026-08-15T00:00:00.000Z"), updatedAt: new Date("2026-08-15T00:00:00.000Z") });

    const result = await service.listOrganizationQueue({ orgId: ORG_A, staleBefore: "2026-08-01T00:00:00.000Z" });
    expect(result.items.map((i) => i.id)).toEqual(["old-send"]);
  });

  it("supports multiple canonical statuses in one request, including a legacy synonym", async () => {
    // legacyProposalStatusMap maps raw "rejected" -> canonical "declined"
    seed({ id: "draft", orgId: ORG_A, status: "draft", updatedAt: new Date("2026-08-01T00:00:00.000Z") });
    seed({ id: "declined-legacy", orgId: ORG_A, status: "rejected", updatedAt: new Date("2026-08-02T00:00:00.000Z") });
    seed({ id: "accepted", orgId: ORG_A, status: "accepted", updatedAt: new Date("2026-08-03T00:00:00.000Z") });

    const result = await service.listOrganizationQueue({ orgId: ORG_A, statuses: ["draft", "declined"] });
    expect(result.items.map((i) => i.id).sort()).toEqual(["declined-legacy", "draft"]);
  });

  it("filters by updatedAfter/updatedBefore", async () => {
    seed({ id: "too-old", orgId: ORG_A, updatedAt: new Date("2026-07-01T00:00:00.000Z") });
    seed({ id: "in-range", orgId: ORG_A, updatedAt: new Date("2026-08-05T00:00:00.000Z") });

    const result = await service.listOrganizationQueue({ orgId: ORG_A, updatedAfter: "2026-08-01T00:00:00.000Z" });
    expect(result.items.map((i) => i.id)).toEqual(["in-range"]);
  });

  it("paginates without duplicate rows across pages", async () => {
    for (let i = 0; i < 4; i += 1) {
      seed({ id: `prop-${i}`, orgId: ORG_A, updatedAt: new Date(Date.UTC(2026, 7, 10 - i)) });
    }

    const page1 = await service.listOrganizationQueue({ orgId: ORG_A, limit: 3 });
    expect(page1.items.map((i) => i.id)).toEqual(["prop-0", "prop-1", "prop-2"]);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await service.listOrganizationQueue({ orgId: ORG_A, limit: 3, cursor: page1.nextCursor! });
    expect(page2.items.map((i) => i.id)).toEqual(["prop-3"]);
    expect(page2.nextCursor).toBeNull();
  });

  it("rejects a malformed cursor with a 400 ApiError", async () => {
    await expect(service.listOrganizationQueue({ orgId: ORG_A, cursor: "garbage" })).rejects.toMatchObject({ statusCode: 400 });
  });
});
