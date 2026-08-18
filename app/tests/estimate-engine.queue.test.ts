// Reuses the in-memory Prisma-shaped query engine originally built for the
// A10 observability services (see tests/helpers/fakeAthenaObservabilityDb.ts)
// since listOrganizationQueue's where/orderBy/cursor construction is the
// behavior under test, not something a canned-return jest.fn() mock would
// exercise.
import { createFakeModel, FakeRow } from "./helpers/fakeAthenaObservabilityDb";
import { encodeUpdatedAtCursor } from "../modules/shared/pagination";

const estimates: FakeRow[] = [];

const mockPrisma = {
  estimate: createFakeModel(estimates),
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { EstimateEngineService } from "../modules/estimate-engine/service";

const ORG_A = "org-a";
const ORG_B = "org-b";

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

describe("EstimateEngineService.listOrganizationQueue", () => {
  const service = new EstimateEngineService();

  beforeEach(() => {
    estimates.length = 0;
    jest.clearAllMocks();
  });

  it("scopes results to the caller's organization only", async () => {
    seed({ id: "est-a", orgId: ORG_A, updatedAt: new Date("2026-08-10T00:00:00.000Z") });
    seed({ id: "est-b", orgId: ORG_B, updatedAt: new Date("2026-08-10T00:00:00.000Z") });

    const result = await service.listOrganizationQueue({ orgId: ORG_A });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("est-a");
    expect(result.total).toBe(1);
  });

  it("maps project/customer names, amount, and revision (version) onto each item", async () => {
    seed({
      id: "est-a",
      orgId: ORG_A,
      updatedAt: new Date("2026-08-10T00:00:00.000Z"),
      version: 3,
      totalPrice: 4200.5,
      status: "ready",
      project: { name: "Deck Build", customer: { name: "Acme Co" } },
    });

    const result = await service.listOrganizationQueue({ orgId: ORG_A });

    expect(result.items[0]).toMatchObject({
      id: "est-a",
      projectName: "Deck Build",
      customerName: "Acme Co",
      status: "ready",
      amount: 4200.5,
      revision: 3,
    });
  });

  it("returns customerName null when the project has no linked customer", async () => {
    seed({ id: "est-a", orgId: ORG_A, updatedAt: new Date(), project: { name: "Lead Job", customer: null } });

    const result = await service.listOrganizationQueue({ orgId: ORG_A });
    expect(result.items[0].customerName).toBeNull();
  });

  it("filters by a single canonical status, including its legacy raw synonym", async () => {
    // legacyEstimateStatusMap maps raw "sent" -> canonical "ready"
    seed({ id: "est-legacy", orgId: ORG_A, status: "sent", updatedAt: new Date("2026-08-01T00:00:00.000Z") });
    seed({ id: "est-canonical", orgId: ORG_A, status: "ready", updatedAt: new Date("2026-08-02T00:00:00.000Z") });
    seed({ id: "est-draft", orgId: ORG_A, status: "draft", updatedAt: new Date("2026-08-03T00:00:00.000Z") });

    const result = await service.listOrganizationQueue({ orgId: ORG_A, statuses: ["ready"] });

    expect(result.items.map((i) => i.id).sort()).toEqual(["est-canonical", "est-legacy"]);
    expect(result.total).toBe(2);
  });

  it("supports multiple statuses in one request", async () => {
    seed({ id: "est-draft", orgId: ORG_A, status: "draft", updatedAt: new Date("2026-08-01T00:00:00.000Z") });
    seed({ id: "est-ready", orgId: ORG_A, status: "ready", updatedAt: new Date("2026-08-02T00:00:00.000Z") });
    seed({ id: "est-declined", orgId: ORG_A, status: "declined", updatedAt: new Date("2026-08-03T00:00:00.000Z") });

    const result = await service.listOrganizationQueue({ orgId: ORG_A, statuses: ["draft", "ready"] });
    expect(result.items.map((i) => i.id).sort()).toEqual(["est-draft", "est-ready"]);
  });

  it("filters by updatedAfter/updatedBefore", async () => {
    seed({ id: "too-old", orgId: ORG_A, updatedAt: new Date("2026-07-01T00:00:00.000Z") });
    seed({ id: "in-range", orgId: ORG_A, updatedAt: new Date("2026-08-05T00:00:00.000Z") });
    seed({ id: "too-new", orgId: ORG_A, updatedAt: new Date("2026-09-01T00:00:00.000Z") });

    const result = await service.listOrganizationQueue({
      orgId: ORG_A,
      updatedAfter: "2026-08-01T00:00:00.000Z",
      updatedBefore: "2026-08-31T00:00:00.000Z",
    });

    expect(result.items.map((i) => i.id)).toEqual(["in-range"]);
  });

  it("orders newest-activity-first with a stable id tie-breaker", async () => {
    const tie = new Date("2026-08-10T00:00:00.000Z");
    seed({ id: "b-tie", orgId: ORG_A, updatedAt: tie });
    seed({ id: "a-tie", orgId: ORG_A, updatedAt: tie });
    seed({ id: "newest", orgId: ORG_A, updatedAt: new Date("2026-08-11T00:00:00.000Z") });

    const result = await service.listOrganizationQueue({ orgId: ORG_A });
    expect(result.items.map((i) => i.id)).toEqual(["newest", "b-tie", "a-tie"]);
  });

  it("paginates: page 1 and page 2 do not duplicate rows and the final page has no nextCursor", async () => {
    for (let i = 0; i < 5; i += 1) {
      seed({ id: `est-${i}`, orgId: ORG_A, updatedAt: new Date(Date.UTC(2026, 7, 10 - i)) });
    }

    const page1 = await service.listOrganizationQueue({ orgId: ORG_A, limit: 2 });
    expect(page1.items.map((i) => i.id)).toEqual(["est-0", "est-1"]);
    expect(page1.nextCursor).not.toBeNull();
    expect(page1.total).toBe(5);

    const page2 = await service.listOrganizationQueue({ orgId: ORG_A, limit: 2, cursor: page1.nextCursor! });
    expect(page2.items.map((i) => i.id)).toEqual(["est-2", "est-3"]);
    expect(page2.nextCursor).not.toBeNull();
    // Regression: total must reflect the whole filtered set, not just rows
    // remaining after the cursor — count() must not reuse the cursor predicate.
    expect(page2.total).toBe(5);

    const page3 = await service.listOrganizationQueue({ orgId: ORG_A, limit: 2, cursor: page2.nextCursor! });
    expect(page3.items.map((i) => i.id)).toEqual(["est-4"]);
    expect(page3.nextCursor).toBeNull();
    expect(page3.total).toBe(5);

    const seen = [...page1.items, ...page2.items, ...page3.items].map((i) => i.id);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("clamps limit to the documented default and maximum", async () => {
    for (let i = 0; i < 60; i += 1) {
      seed({ id: `est-${i}`, orgId: ORG_A, updatedAt: new Date(Date.UTC(2026, 7, 1, 0, 0, i)) });
    }
    const defaulted = await service.listOrganizationQueue({ orgId: ORG_A });
    expect(defaulted.items).toHaveLength(25);

    const maxed = await service.listOrganizationQueue({ orgId: ORG_A, limit: 500 });
    expect(maxed.items).toHaveLength(50);
  });

  it("rejects a malformed cursor with a 400 ApiError", async () => {
    await expect(service.listOrganizationQueue({ orgId: ORG_A, cursor: "not-a-cursor" })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("a cursor from one page is stable when replayed (no restart to page 1)", async () => {
    seed({ id: "est-a", orgId: ORG_A, updatedAt: new Date("2026-08-05T00:00:00.000Z") });
    seed({ id: "est-b", orgId: ORG_A, updatedAt: new Date("2026-08-04T00:00:00.000Z") });

    const cursor = encodeUpdatedAtCursor({ updatedAt: new Date("2026-08-05T00:00:00.000Z"), id: "est-a" });
    const result = await service.listOrganizationQueue({ orgId: ORG_A, cursor });
    expect(result.items.map((i) => i.id)).toEqual(["est-b"]);
  });
});
