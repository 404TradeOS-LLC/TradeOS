const mockPrisma = {
  costbookResearchCandidate: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  subcategory: { findFirst: jest.fn() },
  material: { create: jest.fn(), findFirst: jest.fn() },
  laborRate: { create: jest.fn(), findFirst: jest.fn() },
  equipment: { create: jest.fn(), findFirst: jest.fn() },
  costItem: { create: jest.fn() },
  supplier: { findFirst: jest.fn() },
};

const transaction = {
  $executeRaw: jest.fn().mockResolvedValue(0),
  costbookResearchCandidate: {
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
};

const basePrisma = {
  $transaction: jest.fn((operation: (client: typeof transaction) => unknown) => operation(transaction)),
};

jest.mock("../db/client", () => ({ prisma: mockPrisma, basePrisma }));

import { CostbookCandidateService } from "../modules/costbook/candidateCostItemService";
import type { AuthContext } from "../backend/auth/context";

const auth: AuthContext = { userId: "user-1", orgId: "org-1", role: "owner" };
const otherOrgAuth: AuthContext = { userId: "user-2", orgId: "org-2", role: "owner" };

function validCreateInput(overrides: Record<string, unknown> = {}) {
  return {
    trade: "Roofing",
    category: "Roofing",
    itemName: "30-Year Architectural Shingle Installation",
    unitOfMeasure: "SQ",
    materialCostTypical: 95,
    sourceName: "Manufacturer published price sheet",
    sourceUrl: "https://example.com/pricing/asphalt-shingles",
    sourceDate: "2026-08-01",
    retrievedAt: "2026-09-08T00:00:00.000Z",
    regionalBasis: "US national average",
    confidence: "medium" as const,
    ...overrides,
  };
}

function candidateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "cand-1",
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

describe("CostbookCandidateService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("persists a valid candidate starting in the candidate review state", async () => {
      mockPrisma.costbookResearchCandidate.create.mockResolvedValue(candidateRow());

      const result = await new CostbookCandidateService().create(auth, validCreateInput());

      expect(mockPrisma.costbookResearchCandidate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orgId: "org-1",
          reviewStatus: "candidate",
          createdByUserId: "user-1",
          provenanceStatus: "unverified-legacy",
        }),
      });
      expect(result.reviewStatus).toBe("candidate");
      expect(result.provenanceStatus).toBe("unverified-legacy");
    });

    it("rejects a candidate with no source traceability", async () => {
      await expect(
        new CostbookCandidateService().create(auth, validCreateInput({ sourceUrl: undefined, sourceIdentifier: undefined }))
      ).rejects.toThrow();
      expect(mockPrisma.costbookResearchCandidate.create).not.toHaveBeenCalled();
    });

    it("defaults provenanceStatus to unverified-legacy when the caller omits it", async () => {
      mockPrisma.costbookResearchCandidate.create.mockResolvedValue(candidateRow());
      await new CostbookCandidateService().create(auth, validCreateInput());
      expect(mockPrisma.costbookResearchCandidate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ provenanceStatus: "unverified-legacy" }),
      });
    });

    it("scopes creation to the authenticated organization, not any org the caller might supply", async () => {
      mockPrisma.costbookResearchCandidate.create.mockResolvedValue(candidateRow({ orgId: "org-1" }));
      await new CostbookCandidateService().create(auth, validCreateInput());
      expect(mockPrisma.costbookResearchCandidate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ orgId: "org-1" }),
      });
    });
  });

  describe("review", () => {
    it("records a named authenticated reviewer and timestamp on approval", async () => {
      transaction.costbookResearchCandidate.findFirst.mockResolvedValue(candidateRow({ reviewStatus: "candidate" }));
      transaction.costbookResearchCandidate.updateMany.mockResolvedValue({ count: 1 });

      const result = await new CostbookCandidateService().review(auth, "cand-1", { decision: "approved" });

      expect(transaction.costbookResearchCandidate.updateMany).toHaveBeenCalledWith({
        where: { id: "cand-1", orgId: "org-1", reviewStatus: "candidate" },
        data: expect.objectContaining({ reviewStatus: "approved", reviewedByUserId: "user-1" }),
      });
      expect(result.reviewStatus).toBe("approved");
      expect(result.reviewedByUserId).toBe("user-1");
    });

    it("records rejection with review notes", async () => {
      transaction.costbookResearchCandidate.findFirst.mockResolvedValue(candidateRow({ reviewStatus: "candidate" }));
      transaction.costbookResearchCandidate.updateMany.mockResolvedValue({ count: 1 });

      const result = await new CostbookCandidateService().review(auth, "cand-1", {
        decision: "rejected",
        reviewNotes: "Source is stale",
      });

      expect(result.reviewStatus).toBe("rejected");
      expect(result.reviewNotes).toBe("Source is stale");
    });

    it("rejects reviewing a candidate that is already approved", async () => {
      transaction.costbookResearchCandidate.findFirst.mockResolvedValue(candidateRow({ reviewStatus: "approved" }));

      await expect(
        new CostbookCandidateService().review(auth, "cand-1", { decision: "rejected" })
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(transaction.costbookResearchCandidate.updateMany).not.toHaveBeenCalled();
    });

    it("fails closed when a concurrent reviewer claims the candidate first", async () => {
      transaction.costbookResearchCandidate.findFirst.mockResolvedValue(candidateRow({ reviewStatus: "candidate" }));
      transaction.costbookResearchCandidate.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        new CostbookCandidateService().review(auth, "cand-1", { decision: "approved" })
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("returns 404 rather than leaking existence across organizations", async () => {
      transaction.costbookResearchCandidate.findFirst.mockResolvedValue(null);

      await expect(
        new CostbookCandidateService().review(otherOrgAuth, "cand-1", { decision: "approved" })
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(transaction.costbookResearchCandidate.findFirst).toHaveBeenCalledWith({
        where: { id: "cand-1", orgId: "org-2" },
      });
    });
  });

  describe("promote", () => {
    function approvedRow(overrides: Record<string, unknown> = {}) {
      return candidateRow({
        reviewStatus: "approved",
        reviewedByUserId: "user-1",
        reviewedAt: new Date("2026-09-08T01:00:00.000Z"),
        ...overrides,
      });
    }

    it("cannot promote a candidate that was never reviewed", async () => {
      transaction.costbookResearchCandidate.findFirst.mockResolvedValue(candidateRow({ reviewStatus: "candidate" }));

      await expect(new CostbookCandidateService().promote(auth, "cand-1")).rejects.toMatchObject({ statusCode: 409 });
      expect(mockPrisma.costItem.create).not.toHaveBeenCalled();
    });

    it("cannot promote a candidate stuck in needs-review", async () => {
      transaction.costbookResearchCandidate.findFirst.mockResolvedValue(candidateRow({ reviewStatus: "needs-review" }));

      await expect(new CostbookCandidateService().promote(auth, "cand-1")).rejects.toMatchObject({ statusCode: 409 });
      expect(mockPrisma.costItem.create).not.toHaveBeenCalled();
    });

    it("cannot promote a rejected candidate", async () => {
      transaction.costbookResearchCandidate.findFirst.mockResolvedValue(
        candidateRow({ reviewStatus: "rejected", reviewedByUserId: "user-1", reviewedAt: new Date() })
      );

      await expect(new CostbookCandidateService().promote(auth, "cand-1")).rejects.toMatchObject({ statusCode: 409 });
      expect(mockPrisma.costItem.create).not.toHaveBeenCalled();
    });

    it("cannot promote an approved candidate missing a named reviewer (defensive re-check of the promotion gate)", async () => {
      // Hand-crafted row bypassing the DB check constraint, the same
      // adversarial case candidateCostItem.ts's own test suite exercises
      // against isEligibleForCostbookPromotion() directly.
      transaction.costbookResearchCandidate.findFirst.mockResolvedValue(
        approvedRow({ reviewedByUserId: null, reviewedAt: null })
      );

      await expect(new CostbookCandidateService().promote(auth, "cand-1")).rejects.toMatchObject({ statusCode: 409 });
      expect(mockPrisma.costItem.create).not.toHaveBeenCalled();
    });

    it("cannot promote a candidate already promoted", async () => {
      transaction.costbookResearchCandidate.findFirst.mockResolvedValue(
        approvedRow({ promotedCostItemId: "existing-cost-item" })
      );

      await expect(new CostbookCandidateService().promote(auth, "cand-1")).rejects.toMatchObject({ statusCode: 409 });
      expect(mockPrisma.costItem.create).not.toHaveBeenCalled();
    });

    it("requires an existing subcategory matching the candidate's category and does not invent one", async () => {
      transaction.costbookResearchCandidate.findFirst.mockResolvedValue(approvedRow());
      mockPrisma.subcategory.findFirst.mockResolvedValue(null);

      await expect(new CostbookCandidateService().promote(auth, "cand-1")).rejects.toMatchObject({ statusCode: 422 });
      expect(mockPrisma.costItem.create).not.toHaveBeenCalled();
    });

    it("rejects equipment-only promotion before creating an unpriced equipment link", async () => {
      transaction.costbookResearchCandidate.findFirst.mockResolvedValue(
        approvedRow({ laborHours: null, equipmentCost: 15 })
      );
      mockPrisma.subcategory.findFirst.mockResolvedValue({ id: "subcategory-1" });

      await expect(new CostbookCandidateService().promote(auth, "cand-1")).rejects.toMatchObject({ statusCode: 422 });
      expect(mockPrisma.equipment.create).not.toHaveBeenCalled();
      expect(mockPrisma.costItem.create).not.toHaveBeenCalled();
    });

    it("promotes an approved, eligible candidate through the existing Costbook services and records promotion linkage", async () => {
      transaction.costbookResearchCandidate.findFirst.mockResolvedValue(
        approvedRow({ laborHours: 1.5, laborRateAssumption: 65, equipmentCost: 15 })
      );
      mockPrisma.subcategory.findFirst.mockResolvedValue({ id: "subcategory-1" });
      mockPrisma.material.create.mockResolvedValue({
        id: "material-1",
        orgId: "org-1",
        supplier: null,
        sku: null,
        name: "Roofing material",
        unitOfMeasure: "SQ",
        unitCost: 95,
        wasteFactorPct: 0,
        supplierId: null,
        lastPriceUpdate: new Date("2026-09-08T00:00:00.000Z"),
        createdAt: new Date("2026-09-08T00:00:00.000Z"),
        updatedAt: new Date("2026-09-08T00:00:00.000Z"),
      });
      mockPrisma.material.findFirst.mockResolvedValue({ id: "material-1" });
      mockPrisma.laborRate.create.mockResolvedValue({
        id: "labor-rate-1",
        orgId: "org-1",
        role: "Roofing",
        description: "Researched labor rate",
        hourlyCost: 65,
        billRate: 65,
        active: true,
        createdAt: new Date("2026-09-08T00:00:00.000Z"),
        updatedAt: new Date("2026-09-08T00:00:00.000Z"),
      });
      mockPrisma.laborRate.findFirst.mockResolvedValue({ id: "labor-rate-1" });
      mockPrisma.equipment.create.mockResolvedValue({
        id: "equipment-1",
        orgId: "org-1",
        name: "Roofing equipment",
        ownershipCostPerHour: 0,
        operatingCostPerHour: 15,
        dailyRate: null,
        createdAt: new Date("2026-09-08T00:00:00.000Z"),
        updatedAt: new Date("2026-09-08T00:00:00.000Z"),
      });
      mockPrisma.equipment.findFirst.mockResolvedValue({ id: "equipment-1" });
      mockPrisma.costItem.create.mockResolvedValue({
        id: "cost-item-1",
        orgId: "org-1",
        subcategoryId: "subcategory-1",
        code: "RC-CAND-1",
        name: "30-Year Architectural Shingle Installation",
        unitOfMeasure: "SQ",
        productionRate: null,
        laborRateId: "labor-rate-1",
        materialId: "material-1",
        equipmentId: "equipment-1",
        subcontractorId: null,
        isActive: true,
      });
      transaction.costbookResearchCandidate.updateMany.mockResolvedValue({ count: 1 });

      const result = await new CostbookCandidateService().promote(auth, "cand-1");

      expect(mockPrisma.material.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ orgId: "org-1", unitCost: 95 }) })
      );
      expect(mockPrisma.laborRate.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ orgId: "org-1", hourlyCost: 65, billRate: 65 }) })
      );
      expect(mockPrisma.equipment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ orgId: "org-1", operatingCostPerHour: 15 }) })
      );
      expect(mockPrisma.costItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orgId: "org-1",
            subcategoryId: "subcategory-1",
            laborRateId: "labor-rate-1",
            materialId: "material-1",
            equipmentId: "equipment-1",
          }),
        })
      );
      expect(transaction.costbookResearchCandidate.updateMany).toHaveBeenCalledWith({
        where: { id: "cand-1", orgId: "org-1", promotedCostItemId: null },
        data: expect.objectContaining({ promotedByUserId: "user-1", promotedCostItemId: "cost-item-1" }),
      });
      expect(result.promotedCostItemId).toBe("cost-item-1");
      expect(result.promotedByUserId).toBe("user-1");
    });

    it("does not duplicate the production record when promotion is attempted twice concurrently", async () => {
      transaction.costbookResearchCandidate.findFirst.mockResolvedValue(approvedRow());
      mockPrisma.subcategory.findFirst.mockResolvedValue({ id: "subcategory-1" });
      mockPrisma.costItem.create.mockResolvedValue({
        id: "cost-item-1",
        orgId: "org-1",
        subcategoryId: "subcategory-1",
        code: "RC-CAND-1",
        name: "30-Year Architectural Shingle Installation",
        unitOfMeasure: "SQ",
        productionRate: null,
        laborRateId: null,
        materialId: null,
        equipmentId: null,
        subcontractorId: null,
        isActive: true,
      });
      // Simulate the advisory-lock invariant being violated: a second
      // transaction's claim (updateMany) finds the row no longer null.
      transaction.costbookResearchCandidate.updateMany.mockResolvedValue({ count: 0 });

      await expect(new CostbookCandidateService().promote(auth, "cand-1")).rejects.toMatchObject({ statusCode: 409 });
    });

    it("cannot promote across organizations", async () => {
      transaction.costbookResearchCandidate.findFirst.mockResolvedValue(null);

      await expect(new CostbookCandidateService().promote(otherOrgAuth, "cand-1")).rejects.toMatchObject({ statusCode: 404 });
      expect(transaction.costbookResearchCandidate.findFirst).toHaveBeenCalledWith({
        where: { id: "cand-1", orgId: "org-2" },
      });
      expect(mockPrisma.costItem.create).not.toHaveBeenCalled();
    });

    it("preserves the candidate's source/evidence trail through promotion by referencing it in the CostItem notes", async () => {
      transaction.costbookResearchCandidate.findFirst.mockResolvedValue(approvedRow());
      mockPrisma.subcategory.findFirst.mockResolvedValue({ id: "subcategory-1" });
      mockPrisma.costItem.create.mockResolvedValue({
        id: "cost-item-1",
        orgId: "org-1",
        subcategoryId: "subcategory-1",
        code: "RC-CAND-1",
        name: "30-Year Architectural Shingle Installation",
        unitOfMeasure: "SQ",
        productionRate: null,
        laborRateId: null,
        materialId: null,
        equipmentId: null,
        subcontractorId: null,
        isActive: true,
      });
      transaction.costbookResearchCandidate.updateMany.mockResolvedValue({ count: 1 });

      await new CostbookCandidateService().promote(auth, "cand-1");

      expect(mockPrisma.costItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notes: expect.stringContaining("cand-1"),
          }),
        })
      );
    });
  });
});
