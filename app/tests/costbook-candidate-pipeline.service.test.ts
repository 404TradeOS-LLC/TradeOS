const mockPrisma = {
  costbookResearchCandidate: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  subcategory: { findFirst: jest.fn() },
  material: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  laborRate: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  equipment: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  costItem: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  materialPriceAudit: { create: jest.fn() },
  supplier: { findFirst: jest.fn() },
  activityEvent: { create: jest.fn() },
};

const transaction = {
  $executeRaw: jest.fn().mockResolvedValue(0),
  costbookResearchCandidate: {
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
  activityEvent: { create: jest.fn() },
};

const basePrisma = {
  $transaction: jest.fn((operation: (client: typeof transaction) => unknown) => operation(transaction)),
};

jest.mock("../db/client", () => ({ prisma: mockPrisma, basePrisma }));

import { CostbookCandidateService, resetKnowledgeCorpusReportCache } from "../modules/costbook/candidateCostItemService";
import type { AuthContext } from "../backend/auth/context";

const auth: AuthContext = { userId: "user-1", orgId: "org-1", role: "owner" };

function candidateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    orgId: "org-1",
    trade: "Roofing",
    category: "Roofing",
    itemName: "30-Year Architectural Shingle Installation",
    description: null,
    unitOfMeasure: "SQ",
    materialCostLow: null,
    materialCostTypical: 95,
    materialCostHigh: null,
    laborHours: null,
    laborRateAssumption: null,
    equipmentCost: 0,
    sourceName: "Manufacturer published price sheet",
    sourceUrl: "https://example.com/pricing/asphalt-shingles",
    sourceIdentifier: null,
    sourceDate: "2026-08-01",
    retrievedAt: new Date("2026-09-08T00:00:00.000Z"),
    regionalBasis: "US national average",
    confidence: "medium",
    researchNotes: null,
    provenanceStatus: "unverified-legacy",
    reviewStatus: "candidate",
    reviewedByUserId: null,
    reviewedAt: null,
    reviewNotes: null,
    promotedAt: null,
    promotedByUserId: null,
    promotedCostItemId: null,
    createdByUserId: "user-1",
    createdAt: new Date("2026-09-08T00:00:00.000Z"),
    updatedAt: new Date("2026-09-08T00:00:00.000Z"),
    ...overrides,
  };
}

describe("CostbookCandidateService.summary", () => {
  beforeEach(() => jest.clearAllMocks());

  it("derives real counts from this organization's rows only", async () => {
    mockPrisma.costbookResearchCandidate.groupBy
      .mockResolvedValueOnce([
        { reviewStatus: "candidate", _count: { _all: 3 } },
        { reviewStatus: "needs-review", _count: { _all: 2 } },
        { reviewStatus: "approved", _count: { _all: 4 } },
        { reviewStatus: "rejected", _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        { provenanceStatus: "documented", _count: { _all: 6 } },
        { provenanceStatus: "unverified-legacy", _count: { _all: 4 } },
      ]);
    mockPrisma.costbookResearchCandidate.count
      .mockResolvedValueOnce(3) // promoted
      .mockResolvedValueOnce(1) // awaiting promotion
      .mockResolvedValueOnce(10); // total

    const summary = await new CostbookCandidateService().summary(auth);

    expect(summary.pendingReview).toBe(5);
    expect(summary.approved).toBe(4);
    expect(summary.rejected).toBe(1);
    expect(summary.promoted).toBe(3);
    expect(summary.awaitingPromotion).toBe(1);
    expect(summary.documented).toBe(6);
    expect(summary.unverifiedLegacy).toBe(4);
    expect(summary.placeholder).toBe(0);
    expect(summary.total).toBe(10);

    for (const call of mockPrisma.costbookResearchCandidate.groupBy.mock.calls) {
      expect(call[0].where).toMatchObject({ orgId: "org-1" });
    }
    for (const call of mockPrisma.costbookResearchCandidate.count.mock.calls) {
      expect(call[0].where).toMatchObject({ orgId: "org-1" });
    }
  });

  it("reports honest zeroes for an empty queue rather than placeholder figures", async () => {
    mockPrisma.costbookResearchCandidate.groupBy.mockResolvedValue([]);
    mockPrisma.costbookResearchCandidate.count.mockResolvedValue(0);

    const summary = await new CostbookCandidateService().summary(auth);

    expect(summary).toMatchObject({
      pendingReview: 0,
      approved: 0,
      rejected: 0,
      promoted: 0,
      documented: 0,
      total: 0,
    });
  });
});

describe("CostbookCandidateService.knowledgeCorpusReport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetKnowledgeCorpusReportCache();
  });

  it("reports the real corpus and states plainly that none of it is production-trusted", () => {
    const report = new CostbookCandidateService().knowledgeCorpusReport(auth);

    expect(report.totalItems).toBeGreaterThan(1700);
    expect(report.documented).toBe(0);
    expect(report.candidateReady).toBe(0);
    expect(report.unverifiedLegacy).toBe(report.totalItems);
    expect(report.interpretation).toMatch(/not production-trusted pricing/);
  });

  it("never reads tenant data to build the corpus report", () => {
    new CostbookCandidateService().knowledgeCorpusReport(auth);

    expect(mockPrisma.costbookResearchCandidate.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.costItem.findMany).not.toHaveBeenCalled();
  });
});

describe("CostbookCandidateService.createFromKnowledgeItem", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetKnowledgeCorpusReportCache();
  });

  it("refuses to ingest an unsourced legacy corpus item and names the missing evidence", async () => {
    // Every item in the canonical corpus is in this state today.
    const { getKnowledgeRepositorySnapshot } = await import("../modules/knowledge-runtime/repository");
    const realItemId = getKnowledgeRepositorySnapshot().costItems[0].id;

    await expect(new CostbookCandidateService().createFromKnowledgeItem(auth, realItemId)).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(mockPrisma.costbookResearchCandidate.create).not.toHaveBeenCalled();
  });

  it("returns 404 for a Knowledge Engine item that does not exist", async () => {
    await expect(
      new CostbookCandidateService().createFromKnowledgeItem(auth, "00000000-0000-4000-8000-000000000000")
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockPrisma.costbookResearchCandidate.create).not.toHaveBeenCalled();
  });
});

describe("CostbookCandidateService.matchPreview", () => {
  beforeEach(() => jest.clearAllMocks());

  it("compares a candidate only against this organization's catalog", async () => {
    mockPrisma.costbookResearchCandidate.findFirst.mockResolvedValue(candidateRow());
    mockPrisma.costItem.findMany.mockResolvedValue([]);

    await new CostbookCandidateService().matchPreview(auth, "11111111-1111-4111-8111-111111111111");

    expect(mockPrisma.costbookResearchCandidate.findFirst).toHaveBeenCalledWith({
      where: { id: "11111111-1111-4111-8111-111111111111", orgId: "org-1" },
    });
    const searchCall = mockPrisma.costItem.findMany.mock.calls[0][0];
    expect(searchCall.where).toMatchObject({ orgId: "org-1" });
  });

  it("reports a new candidate when the catalog holds nothing similar", async () => {
    mockPrisma.costbookResearchCandidate.findFirst.mockResolvedValue(candidateRow());
    mockPrisma.costItem.findMany.mockResolvedValue([]);

    const result = await new CostbookCandidateService().matchPreview(auth, "11111111-1111-4111-8111-111111111111");

    expect(result.status).toBe("new-candidate");
    expect(result.bestMatch).toBeNull();
  });

  it("never mutates anything while previewing a match", async () => {
    mockPrisma.costbookResearchCandidate.findFirst.mockResolvedValue(candidateRow());
    mockPrisma.costItem.findMany.mockResolvedValue([]);

    await new CostbookCandidateService().matchPreview(auth, "11111111-1111-4111-8111-111111111111");

    expect(mockPrisma.costItem.create).not.toHaveBeenCalled();
    expect(mockPrisma.material.create).not.toHaveBeenCalled();
    expect(transaction.costbookResearchCandidate.updateMany).not.toHaveBeenCalled();
  });

  it("fails closed with 404 for a candidate belonging to another organization", async () => {
    mockPrisma.costbookResearchCandidate.findFirst.mockResolvedValue(null);

    await expect(
      new CostbookCandidateService().matchPreview(auth, "11111111-1111-4111-8111-111111111111")
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("CostbookCandidateService review/promote audit evidence", () => {
  beforeEach(() => jest.clearAllMocks());

  it("records an immutable audit event naming the real reviewer on approval", async () => {
    transaction.costbookResearchCandidate.findFirst.mockResolvedValue(candidateRow());
    transaction.costbookResearchCandidate.updateMany.mockResolvedValue({ count: 1 });

    await new CostbookCandidateService().review(auth, "11111111-1111-4111-8111-111111111111", {
      decision: "approved",
      reviewNotes: "Verified against the published sheet.",
    });

    expect(transaction.activityEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: "org-1",
        entityType: "costbook_research_candidate",
        entityId: "11111111-1111-4111-8111-111111111111",
        eventType: "costbook.candidate.approved",
        actorUserId: "user-1",
      }),
    });
  });

  it("records a rejection just as durably as an approval", async () => {
    transaction.costbookResearchCandidate.findFirst.mockResolvedValue(candidateRow());
    transaction.costbookResearchCandidate.updateMany.mockResolvedValue({ count: 1 });

    await new CostbookCandidateService().review(auth, "11111111-1111-4111-8111-111111111111", {
      decision: "rejected",
      reviewNotes: "Source does not support this price.",
    });

    expect(transaction.activityEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: "costbook.candidate.rejected" }),
    });
  });

  it("writes no audit event when a concurrent reviewer already claimed the candidate", async () => {
    transaction.costbookResearchCandidate.findFirst.mockResolvedValue(candidateRow());
    transaction.costbookResearchCandidate.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      new CostbookCandidateService().review(auth, "11111111-1111-4111-8111-111111111111", { decision: "approved" })
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(transaction.activityEvent.create).not.toHaveBeenCalled();
  });

  it("records the promoted Costbook target and the provenance that justified it", async () => {
    const approved = candidateRow({
      reviewStatus: "approved",
      reviewedByUserId: "reviewer-9",
      reviewedAt: new Date("2026-09-09T00:00:00.000Z"),
    });
    transaction.costbookResearchCandidate.findFirst.mockResolvedValue(approved);
    transaction.costbookResearchCandidate.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.subcategory.findFirst.mockResolvedValue({ id: "subcategory-1" });
    // CostDatabaseService.create independently re-verifies that every
    // referenced component belongs to the authenticated organization.
    mockPrisma.material.findFirst.mockResolvedValue({ id: "material-1", orgId: "org-1" });
    mockPrisma.material.create.mockResolvedValue({ id: "material-1", name: "x", unitOfMeasure: "SQ", unitCost: 95, wasteFactorPct: 0, supplier: null, sku: null, lastPriceUpdate: null, orgId: "org-1", createdAt: new Date(), updatedAt: new Date(), supplierId: null });
    mockPrisma.costItem.create.mockResolvedValue({
      id: "cost-item-1",
      orgId: "org-1",
      subcategoryId: "subcategory-1",
      code: "RC-11111111",
      name: "30-Year Architectural Shingle Installation",
      unitOfMeasure: "SQ",
      productionRate: null,
      laborRateId: null,
      materialId: "material-1",
      equipmentId: null,
      subcontractorId: null,
      isActive: true,
    });

    await new CostbookCandidateService().promote(auth, "11111111-1111-4111-8111-111111111111");

    expect(transaction.activityEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "costbook.candidate.promoted",
        entityType: "costbook_research_candidate",
        actorUserId: "user-1",
        metadataJson: expect.objectContaining({
          promotedCostItemId: "cost-item-1",
          reviewedByUserId: "reviewer-9",
          sourceName: "Manufacturer published price sheet",
          previousUnitCost: null,
        }),
      }),
    });
  });

  it("only ever creates new Costbook rows, so historical estimate snapshots cannot be repriced", async () => {
    const approved = candidateRow({
      reviewStatus: "approved",
      reviewedByUserId: "reviewer-9",
      reviewedAt: new Date("2026-09-09T00:00:00.000Z"),
    });
    transaction.costbookResearchCandidate.findFirst.mockResolvedValue(approved);
    transaction.costbookResearchCandidate.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.subcategory.findFirst.mockResolvedValue({ id: "subcategory-1" });
    mockPrisma.material.findFirst.mockResolvedValue({ id: "material-1", orgId: "org-1" });
    mockPrisma.material.create.mockResolvedValue({ id: "material-1", name: "x", unitOfMeasure: "SQ", unitCost: 95, wasteFactorPct: 0, supplier: null, sku: null, lastPriceUpdate: null, orgId: "org-1", createdAt: new Date(), updatedAt: new Date(), supplierId: null });
    mockPrisma.costItem.create.mockResolvedValue({
      id: "cost-item-1",
      orgId: "org-1",
      subcategoryId: "subcategory-1",
      code: "RC-11111111",
      name: "30-Year Architectural Shingle Installation",
      unitOfMeasure: "SQ",
      productionRate: null,
      laborRateId: null,
      materialId: "material-1",
      equipmentId: null,
      subcontractorId: null,
      isActive: true,
    });

    await new CostbookCandidateService().promote(auth, "11111111-1111-4111-8111-111111111111");

    // Promotion never updates an existing Material or CostItem. Estimate line
    // items hold their own captured unitCost/lineCost, so a promotion cannot
    // reach an existing estimate, proposal, contract, or invoice.
    expect(mockPrisma.material.update).not.toHaveBeenCalled();
    expect(mockPrisma.laborRate.update).not.toHaveBeenCalled();
    expect(mockPrisma.equipment.update).not.toHaveBeenCalled();
    expect(mockPrisma.costItem.update).not.toHaveBeenCalled();
    // No existing price changed, so there is no price-audit row to write either.
    expect(mockPrisma.materialPriceAudit.create).not.toHaveBeenCalled();
    expect(mockPrisma.costItem.create).toHaveBeenCalledTimes(1);
  });

  it("writes no audit event when an unapproved candidate is refused promotion", async () => {
    transaction.costbookResearchCandidate.findFirst.mockResolvedValue(candidateRow());

    await expect(
      new CostbookCandidateService().promote(auth, "11111111-1111-4111-8111-111111111111")
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(transaction.activityEvent.create).not.toHaveBeenCalled();
    expect(mockPrisma.costItem.create).not.toHaveBeenCalled();
  });
});
