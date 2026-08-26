const mockPrisma = {
  estimate: {
    findFirst: jest.fn(),
  },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));
jest.mock("../modules/cost-database/service", () => ({
  CostDatabaseService: jest.fn().mockImplementation(() => ({ getUnitCost: jest.fn() })),
}));
jest.mock("../modules/assemblies-database/service", () => ({
  AssembliesDatabaseService: jest.fn().mockImplementation(() => ({ getAssemblyUnitCost: jest.fn() })),
}));
jest.mock("../modules/athena-events/service", () => ({
  getDefaultAthenaEventService: jest.fn(() => ({ publish: jest.fn() })),
}));

import { EstimateEngineService } from "../modules/estimate-engine/service";

function estimate(overrides: Record<string, unknown>) {
  return {
    id: "estimate-1",
    orgId: "org-1",
    projectId: "project-1",
    version: 1,
    status: "draft",
    overheadPct: 0,
    profitPct: 0,
    targetMarginPct: null,
    subtotalCost: 100,
    totalPrice: 150,
    lineItems: [{
      id: "line-1",
      estimateId: "estimate-1",
      costItemId: "cost-1",
      assemblyId: null,
      description: "Line",
      quantity: 1,
      unitOfMeasure: "ea",
      unitCost: 100,
      lineCost: 100,
      sortOrder: 1,
      sourceKey: null,
    }],
    ...overrides,
  };
}

describe("EstimateEngineService.compareEstimates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("includes overhead in each comparison margin and the margin delta", async () => {
    mockPrisma.estimate.findFirst
      .mockResolvedValueOnce(estimate({ id: "base", version: 1, overheadPct: 20, subtotalCost: 100, totalPrice: 150 }))
      .mockResolvedValueOnce(estimate({ id: "candidate", version: 2, overheadPct: 0, subtotalCost: 100, totalPrice: 150 }));

    const result = await new EstimateEngineService().compareEstimates("base", "candidate", "org-1");

    expect(result.base.marginPct).toBe(20);
    expect(result.candidate.marginPct).toBe(33.33);
    expect(result.delta.marginPct).toBe(13.33);
  });
});
