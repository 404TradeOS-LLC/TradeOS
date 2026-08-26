const mockPrisma = {
  materialPriceAudit: { findMany: jest.fn() },
  estimateLineItem: { findMany: jest.fn() },
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
