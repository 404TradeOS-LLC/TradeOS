const mockPrisma = {
  costItem: {
    findFirst: jest.fn(),
  },
  region: {
    findUnique: jest.fn(),
  },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { CostDatabaseService } from "../modules/cost-database/service";

describe("CostDatabaseService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rolls labor, material, and equipment into a per-unit cost", async () => {
    mockPrisma.costItem.findFirst.mockResolvedValue({
      id: "cost-item-1",
      orgId: "org-1",
      subcategoryId: "sub-1",
      code: "02-200-10-001",
      name: "Excavation Per Cubic Yard",
      unitOfMeasure: "CY",
      productionRate: 10,
      laborRate: {
        baseHourlyRate: 30,
        burdenPct: 25,
        active: true,
        region: { laborIndex: 1.1 },
      },
      material: {
        unitCost: 5,
        wasteFactorPct: 10,
      },
      equipment: {
        ownershipCostPerHour: 20,
        operatingCostPerHour: 10,
        dailyRate: null,
      },
    });

    const service = new CostDatabaseService();
    const breakdown = await service.getUnitCost("cost-item-1", 20, undefined, "org-1");

    expect(breakdown.laborCostPerUnit).toBeCloseTo(4.13, 2);
    expect(breakdown.materialCostPerUnit).toBeCloseTo(5.5, 2);
    expect(breakdown.equipmentCostPerUnit).toBeCloseTo(3, 2);
    expect(breakdown.totalUnitCost).toBeCloseTo(12.63, 2);
  });

  it("does not price future unit costs from inactive labor rates", async () => {
    mockPrisma.costItem.findFirst.mockResolvedValue({
      id: "cost-item-1",
      orgId: "org-1",
      subcategoryId: "sub-1",
      code: "02-200-10-001",
      name: "Excavation Per Cubic Yard",
      unitOfMeasure: "CY",
      productionRate: 10,
      laborRate: {
        baseHourlyRate: 30,
        burdenPct: 25,
        active: false,
        region: { laborIndex: 1.1 },
      },
      material: null,
      equipment: null,
    });

    const service = new CostDatabaseService();
    const breakdown = await service.getUnitCost("cost-item-1", 20, undefined, "org-1");

    expect(breakdown.laborCostPerUnit).toBe(0);
    expect(breakdown.totalUnitCost).toBe(0);
  });
});
