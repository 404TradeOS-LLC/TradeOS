const mockPrisma = {
  estimate: { findFirst: jest.fn(), update: jest.fn(), count: jest.fn(), create: jest.fn() },
  costItem: { findFirst: jest.fn(), findMany: jest.fn() },
  assembly: { findFirst: jest.fn() },
  assemblyItem: { findMany: jest.fn() },
  estimateLineItem: {
    aggregate: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
};

const mockCostDatabase = { getUnitCost: jest.fn() };
const mockAssembliesDatabase = { getAssemblyUnitCost: jest.fn() };

jest.mock("../db/client", () => ({ prisma: mockPrisma }));
jest.mock("../modules/cost-database/service", () => ({
  CostDatabaseService: jest.fn().mockImplementation(() => mockCostDatabase),
}));
jest.mock("../modules/assemblies-database/service", () => ({
  AssembliesDatabaseService: jest.fn().mockImplementation(() => mockAssembliesDatabase),
}));

import { EstimateEngineService } from "../modules/estimate-engine/service";
import {
  attachLinePriceReadiness,
  deriveLinePriceReadiness,
  type LinePriceEvidence,
} from "../modules/estimate-engine/priceReadiness";

const NOW = new Date("2026-11-23T12:00:00.000Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

function evidence(partial: Partial<LinePriceEvidence>): LinePriceEvidence {
  return { unitCost: 50, hasPricedComponent: false, materialPriceDates: [], ...partial };
}

describe("deriveLinePriceReadiness (DES-10-F3)", () => {
  it("flags a $0 line with no priced component as missing", () => {
    expect(deriveLinePriceReadiness(evidence({ unitCost: 0 }), NOW)).toBe("missing");
  });

  it("does not flag an intentional $0: a priced component behind the zero means the price was recorded", () => {
    expect(
      deriveLinePriceReadiness(
        evidence({ unitCost: 0, hasPricedComponent: true, materialPriceDates: [daysAgo(10)] }),
        NOW,
      ),
    ).toBe("current");
  });

  it("returns null when no supplier material price backs the line", () => {
    expect(deriveLinePriceReadiness(evidence({}), NOW)).toBeNull();
    expect(
      deriveLinePriceReadiness(evidence({ unitCost: 0, hasPricedComponent: true }), NOW),
    ).toBeNull();
  });

  it("flags a material price with no recorded update date as unverified", () => {
    expect(
      deriveLinePriceReadiness(evidence({ materialPriceDates: [null] }), NOW),
    ).toBe("unverified");
  });

  it("flags a null date even when another backing price is rejected", () => {
    expect(
      deriveLinePriceReadiness(evidence({ materialPriceDates: [null, daysAgo(120)] }), NOW),
    ).toBe("unverified");
  });

  it.each([
    [10, "current"],
    [30, "current"],
    [31, "warn"],
    [60, "warn"],
    [61, "refresh"],
    [90, "refresh"],
    [91, "reject"],
    [120, "reject"],
  ] as const)("applies the RECENT_RETAIL_VALIDATION tiers: %i days old is %s", (days, expected) => {
    expect(
      deriveLinePriceReadiness(evidence({ materialPriceDates: [daysAgo(days)] }), NOW),
    ).toBe(expected);
  });

  it("reports the worst freshness across backing materials", () => {
    expect(
      deriveLinePriceReadiness(evidence({ materialPriceDates: [daysAgo(10), daysAgo(120)] }), NOW),
    ).toBe("reject");
    expect(
      deriveLinePriceReadiness(evidence({ materialPriceDates: [daysAgo(10), daysAgo(45)] }), NOW),
    ).toBe("warn");
  });
});

describe("EstimateEngineService.getById price readiness (DES-10-F3)", () => {
  beforeEach(() => jest.clearAllMocks());

  const estimateRow = (lineItems: Array<Record<string, unknown>>) => ({
    id: "estimate-1",
    orgId: "org-1",
    projectId: "project-1",
    version: 1,
    status: "draft",
    overheadPct: 10,
    profitPct: 20,
    targetMarginPct: null,
    subtotalCost: 0,
    totalPrice: 0,
    lineItems,
  });

  const line = (partial: Record<string, unknown>) => ({
    id: "line-1",
    estimateId: "estimate-1",
    costItemId: null,
    assemblyId: null,
    description: "Line",
    quantity: 1,
    unitOfMeasure: "EA",
    unitCost: 50,
    lineCost: 50,
    sortOrder: 0,
    sourceKey: null,
    section: "General",
    costType: "material",
    taxable: false,
    ...partial,
  });

  it("attaches per-line readiness from cost-item material dates", async () => {
    mockPrisma.estimate.findFirst.mockResolvedValue(
      estimateRow([
        line({ id: "line-current", costItemId: "cost-item-current", description: "Current pipe" }),
        line({ id: "line-stale", costItemId: "cost-item-stale", description: "Stale paint" }),
        line({ id: "line-undated", costItemId: "cost-item-undated", description: "Undated sink" }),
        line({ id: "line-labor", costItemId: "cost-item-labor", costType: "labor", description: "Labor" }),
        line({ id: "line-custom-zero", unitCost: 0, lineCost: 0, description: "TBD custom" }),
      ]),
    );
    mockPrisma.costItem.findMany.mockResolvedValue([
      {
        id: "cost-item-current",
        productionRate: null,
        laborRate: null,
        material: { lastPriceUpdate: daysAgo(10) },
        equipment: null,
      },
      {
        id: "cost-item-stale",
        productionRate: null,
        laborRate: null,
        material: { lastPriceUpdate: daysAgo(120) },
        equipment: null,
      },
      {
        id: "cost-item-undated",
        productionRate: null,
        laborRate: null,
        material: { lastPriceUpdate: null },
        equipment: null,
      },
      {
        id: "cost-item-labor",
        productionRate: 2,
        laborRate: { active: true },
        material: null,
        equipment: null,
      },
    ]);
    mockPrisma.assemblyItem.findMany.mockResolvedValue([]);

    const service = new EstimateEngineService();
    const detail = await service.getById("estimate-1", "org-1");
    const byId = new Map(detail.lineItems.map((item) => [item.id, item.priceReadiness]));
    expect(byId.get("line-current")).toBe("current");
    expect(byId.get("line-stale")).toBe("reject");
    expect(byId.get("line-undated")).toBe("unverified");
    expect(byId.get("line-labor")).toBeNull();
    expect(byId.get("line-custom-zero")).toBe("missing");
  });

  it("aggregates assembly readiness across leaf cost items and skips circular references", async () => {
    mockPrisma.estimate.findFirst.mockResolvedValue(
      estimateRow([
        line({ id: "line-assembly", assemblyId: "assembly-1", description: "Assembly" }),
      ]),
    );
    mockPrisma.costItem.findMany.mockResolvedValue([
      {
        id: "cost-item-current",
        productionRate: null,
        laborRate: null,
        material: { lastPriceUpdate: daysAgo(10) },
        equipment: null,
      },
      {
        id: "cost-item-stale",
        productionRate: null,
        laborRate: null,
        material: { lastPriceUpdate: daysAgo(75) },
        equipment: null,
      },
    ]);
    mockPrisma.assemblyItem.findMany.mockImplementation(({ where }: { where: { assemblyId: string } }) => {
      if (where.assemblyId === "assembly-1") {
        return Promise.resolve([
          { costItemId: "cost-item-current", childAssemblyId: null },
          { costItemId: null, childAssemblyId: "assembly-2" },
          // Circular reference back to the parent: contributes nothing new.
          { costItemId: null, childAssemblyId: "assembly-1" },
        ]);
      }
      return Promise.resolve([{ costItemId: "cost-item-stale", childAssemblyId: null }]);
    });

    const service = new EstimateEngineService();
    const detail = await service.getById("estimate-1", "org-1");
    // Worst leaf freshness wins: 75 days is refresh.
    expect(detail.lineItems[0]?.priceReadiness).toBe("refresh");
  });

  it("still returns the estimate when the readiness lookup fails", async () => {
    mockPrisma.estimate.findFirst.mockResolvedValue(
      estimateRow([
        line({ id: "line-1", costItemId: "cost-item-1", description: "Pipe" }),
      ]),
    );
    mockPrisma.costItem.findMany.mockRejectedValue(new Error("readiness lookup down"));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const service = new EstimateEngineService();
    const detail = await service.getById("estimate-1", "org-1");
    expect(detail.lineItems).toHaveLength(1);
    expect(detail.lineItems[0]?.priceReadiness).toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("attaches readiness through the exported loader for an intentional $0 material line", async () => {
    mockPrisma.costItem.findMany.mockResolvedValue([
      {
        id: "cost-item-zero",
        productionRate: null,
        laborRate: null,
        material: { lastPriceUpdate: daysAgo(5) },
        equipment: null,
      },
    ]);
    mockPrisma.assemblyItem.findMany.mockResolvedValue([]);
    const lines = await attachLinePriceReadiness(
      [
        {
          id: "line-zero",
          estimateId: "estimate-1",
          costItemId: "cost-item-zero",
          assemblyId: null,
          description: "Owner-supplied $0 material",
          quantity: 1,
          unitOfMeasure: "EA",
          unitCost: 0,
          lineCost: 0,
          sortOrder: 0,
          sourceKey: null,
          section: "General",
          costType: "material",
          taxable: false,
        },
      ],
      "org-1",
    );
    expect(lines[0]?.priceReadiness).toBe("current");
  });
});
