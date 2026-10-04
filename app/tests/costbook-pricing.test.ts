const mockPrisma = {
  materialPriceAudit: { findMany: jest.fn() },
  estimateLineItem: { findMany: jest.fn() },
  supplierPriceObservation: { findMany: jest.fn() },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { CostbookPricingService } from "../modules/costbook/pricing";

describe("CostbookPricingService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reuses Estimate Engine markup formulas without persisting anything", () => {
    const result = new CostbookPricingService().preview({
      jobCost: 100,
      directOverhead: 10,
      overheadPct: 10,
      mode: "markup",
      markupPct: 20,
    });
    expect(result.totalCost).toBe(121);
    expect(result.sellPrice).toBe(145.2);
    expect(result.grossProfit).toBe(24.2);
    expect(result.markupPct).toBe(20);
    expect(result.marginPct).toBeCloseTo(16.67, 2);
  });

  it("uses target-margin conversion consistently", () => {
    const result = new CostbookPricingService().preview({ jobCost: 75, mode: "targetMargin", targetMarginPct: 25 });
    expect(result.totalCost).toBe(75);
    expect(result.sellPrice).toBe(100);
    expect(result.grossProfit).toBe(25);
    expect(result.marginPct).toBe(25);
    expect(result.markupPct).toBeCloseTo(33.33, 2);
  });

  it("keeps audited changes distinct from estimate consumption snapshots", async () => {
    mockPrisma.materialPriceAudit.findMany.mockResolvedValue([{
      id: "audit-1",
      materialId: "material-1",
      materialName: "Wire",
      oldUnitCost: 10,
      newUnitCost: 12,
      source: "manual",
      actorUserId: "user-1",
      actorRole: "owner",
      createdAt: new Date("2026-08-14T00:00:00Z"),
    }]);
    mockPrisma.estimateLineItem.findMany.mockResolvedValue([{
      id: "line-1",
      estimateId: "estimate-1",
      costItemId: "cost-item-1",
      assemblyId: null,
      description: "Install wire",
      quantity: 2,
      unitOfMeasure: "EA",
      unitCost: 15,
      lineCost: 30,
      createdAt: new Date("2026-08-14T01:00:00Z"),
    }]);

    const history = await new CostbookPricingService().listHistory("org-1", { limit: 20 });
    expect(mockPrisma.materialPriceAudit.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { orgId: "org-1" }, take: 20 }));
    expect(mockPrisma.estimateLineItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ estimate: { orgId: "org-1" } }), take: 20 }));
    expect(history.materialChanges[0]).toMatchObject({ oldUnitCost: 10, newUnitCost: 12 });
    expect(history.estimateSnapshots[0]).toMatchObject({ sourceType: "cost_item", sourceId: "cost-item-1", unitCost: 15, lineCost: 30 });
  });
  it("resolves only tenant-scoped canonical supplier evidence and returns provenance", async () => {
    mockPrisma.supplierPriceObservation.findMany.mockResolvedValue([{
      id: "obs-1",
      normalizedUnitPrice: 4.18,
      effectivePrice: 4.18,
      salePrice: null,
      regularPrice: 4.49,
      currency: "USD",
      normalizedUnit: "EACH",
      purchaseUnit: "EA",
      sourceConfidence: "high",
      observedAt: new Date("2026-09-28T14:02:00.000Z"),
      storeName: "Terre Haute #0215",
      postalCode: "47802",
      sourceUrl: "https://example.test/2x4",
      supplierProduct: {
        purchaseUnit: "EA",
        supplier: { id: "supplier-1", name: "Example Supplier" },
      },
    }]);

    const resolved = await new CostbookPricingService().resolveCanonicalPrice("org-1", {
      canonicalMaterialKey: "LUMBER.SPF.2X4.8FT.STUD",
      postalCode: "47802",
      unit: "EACH",
      now: new Date("2026-10-02T12:00:00.000Z"),
    });

    expect(mockPrisma.supplierPriceObservation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        orgId: "org-1",
        priceStatus: "priced",
        supplierProduct: { canonicalMaterialKey: "LUMBER.SPF.2X4.8FT.STUD" },
      },
    }));
    expect(resolved).toMatchObject({
      selectedPrice: 4.18,
      unit: "EACH",
      supplierName: "Example Supplier",
      storeName: "Terre Haute #0215",
      confidence: "HIGH",
      evidenceTier: "RECENT_RETAIL_VALIDATION",
      verifiedVsInferred: "observed",
      freshness: "current",
    });
  });

  it("never pairs a raw package price with a normalized unit", async () => {
    mockPrisma.supplierPriceObservation.findMany.mockResolvedValue([{
      id: "obs-case",
      normalizedUnitPrice: null,
      effectivePrice: 100,
      salePrice: null,
      regularPrice: 110,
      currency: "USD",
      normalizedUnit: "EACH",
      purchaseUnit: "CASE",
      sourceConfidence: "high",
      observedAt: new Date("2026-09-28T14:02:00.000Z"),
      storeName: "Terre Haute",
      postalCode: "47802",
      sourceUrl: "https://example.test/case",
      supplierProduct: {
        purchaseUnit: "CASE",
        supplier: { id: "supplier-1", name: "Example Supplier" },
      },
    }]);

    const service = new CostbookPricingService();
    await expect(service.resolveCanonicalPrice("org-1", {
      canonicalMaterialKey: "ADHESIVE.CONSTRUCTION.TUBE",
      unit: "CASE",
      now: new Date("2026-10-02T12:00:00.000Z"),
    })).resolves.toMatchObject({
      selectedPrice: 100,
      unit: "CASE",
    });

    await expect(service.resolveCanonicalPrice("org-1", {
      canonicalMaterialKey: "ADHESIVE.CONSTRUCTION.TUBE",
      unit: "EACH",
      now: new Date("2026-10-02T12:00:00.000Z"),
    })).resolves.toBeNull();
  });

  it("returns no resolved price when the tenant has no eligible evidence", async () => {
    mockPrisma.supplierPriceObservation.findMany.mockResolvedValue([]);
    await expect(new CostbookPricingService().resolveCanonicalPrice("org-a", {
      canonicalMaterialKey: "CONCRETE.MIX.80LB.BAG",
    })).resolves.toBeNull();
  });

  it("applies tenant-scoped material, estimate, source, and date filters", async () => {
    mockPrisma.materialPriceAudit.findMany.mockResolvedValue([]);
    mockPrisma.estimateLineItem.findMany.mockResolvedValue([]);
    const from = new Date("2026-08-01T00:00:00Z");
    const to = new Date("2026-08-14T23:59:59Z");

    await new CostbookPricingService().listHistory("org-1", {
      limit: 25,
      materialId: "11111111-1111-4111-8111-111111111111",
      estimateId: "22222222-2222-4222-8222-222222222222",
      sourceType: "assembly",
      from,
      to,
    });

    expect(mockPrisma.materialPriceAudit.findMany).toHaveBeenCalledWith({
      where: {
        orgId: "org-1",
        materialId: "11111111-1111-4111-8111-111111111111",
        createdAt: { gte: from, lte: to },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    });
    expect(mockPrisma.estimateLineItem.findMany).toHaveBeenCalledWith({
      where: {
        estimate: { orgId: "org-1" },
        estimateId: "22222222-2222-4222-8222-222222222222",
        createdAt: { gte: from, lte: to },
        OR: [{ assemblyId: { not: null } }],
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    });
  });
});
