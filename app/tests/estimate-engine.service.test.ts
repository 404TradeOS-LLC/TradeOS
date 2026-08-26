const mockPrisma = {
  project: {
    findFirst: jest.fn(),
  },
  estimate: {
    count: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  costItem: {
    findFirst: jest.fn(),
  },
  assembly: {
    findFirst: jest.fn(),
  },
  estimateLineItem: {
    aggregate: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
};

const mockCostDatabase = {
  getUnitCost: jest.fn(),
};

const mockAssembliesDatabase = {
  getAssemblyUnitCost: jest.fn(),
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));
jest.mock("../modules/cost-database/service", () => ({
  CostDatabaseService: jest.fn().mockImplementation(() => mockCostDatabase),
}));
jest.mock("../modules/assemblies-database/service", () => ({
  AssembliesDatabaseService: jest.fn().mockImplementation(() => mockAssembliesDatabase),
}));

import { EstimateEngineService } from "../modules/estimate-engine/service";

describe("EstimateEngineService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("snapshots unit cost when adding a line item and recalculates totals", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });
    mockPrisma.estimate.count.mockResolvedValue(0);
    mockPrisma.estimate.create.mockResolvedValue({
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
    });
    mockPrisma.costItem.findFirst.mockResolvedValue({
      id: "cost-item-1",
      orgId: "org-1",
      unitOfMeasure: "CY",
      name: "Excavation",
    });
    mockCostDatabase.getUnitCost.mockResolvedValue({ totalUnitCost: 12.5 });
    mockPrisma.estimateLineItem.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
    mockPrisma.estimateLineItem.create.mockResolvedValue({
      id: "line-1",
      estimateId: "estimate-1",
      costItemId: "cost-item-1",
      assemblyId: null,
      description: "Excavation",
      quantity: 2,
      unitOfMeasure: "CY",
      unitCost: 12.5,
      lineCost: 25,
      sortOrder: 1,
    });
    mockPrisma.estimate.findFirst.mockResolvedValue({
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
      lineItems: [{ lineCost: 25 }],
    });
    mockPrisma.estimate.update.mockResolvedValue({
      id: "estimate-1",
      orgId: "org-1",
      projectId: "project-1",
      version: 1,
      status: "draft",
      overheadPct: 10,
      profitPct: 20,
      targetMarginPct: null,
      subtotalCost: 25,
      totalPrice: 33,
    });

    const service = new EstimateEngineService();
    const lineItem = await service.addLineItem({
      estimateId: "estimate-1",
      orgId: "org-1",
      costItemId: "cost-item-1",
      quantity: 2,
    });

    expect(lineItem.unitCost).toBe(12.5);
    expect(lineItem.lineCost).toBe(25);
    expect(mockPrisma.estimate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "estimate-1" },
        data: expect.objectContaining({ subtotalCost: 25, totalPrice: 33 }),
      })
    );
  });

  it("uses sourceKey to make idempotent line insertion replay-safe", async () => {
    mockPrisma.costItem.findFirst.mockResolvedValue({
      id: "cost-item-1",
      orgId: "org-1",
      unitOfMeasure: "EA",
      name: "Panel replacement",
    });
    mockCostDatabase.getUnitCost.mockResolvedValue({ totalUnitCost: 250 });
    mockPrisma.estimateLineItem.aggregate.mockResolvedValue({ _max: { sortOrder: 3 } });
    mockPrisma.estimateLineItem.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.estimateLineItem.findFirst.mockResolvedValue({
      id: "line-existing",
      estimateId: "estimate-1",
      costItemId: "cost-item-1",
      assemblyId: null,
      description: "Panel replacement",
      quantity: 1,
      unitOfMeasure: "EA",
      unitCost: 250,
      lineCost: 250,
      sortOrder: 4,
      sourceKey: "ai-estimator:v1:abc",
    });
    mockPrisma.estimate.findFirst.mockResolvedValue({
      id: "estimate-1",
      orgId: "org-1",
      projectId: "project-1",
      version: 1,
      status: "draft",
      overheadPct: 0,
      profitPct: 0,
      targetMarginPct: null,
      subtotalCost: 250,
      totalPrice: 250,
      lineItems: [{ lineCost: 250 }],
    });

    const lineItem = await new EstimateEngineService().addLineItem({
      estimateId: "estimate-1",
      orgId: "org-1",
      costItemId: "cost-item-1",
      quantity: 1,
      description: "Panel replacement",
      sourceKey: "ai-estimator:v1:abc",
    });

    expect(mockPrisma.estimateLineItem.createMany).toHaveBeenCalledWith({
      data: expect.objectContaining({ sourceKey: "ai-estimator:v1:abc" }),
      skipDuplicates: true,
    });
    expect(mockPrisma.estimate.update).not.toHaveBeenCalled();
    expect(lineItem.id).toBe("line-existing");
    expect(lineItem.sourceKey).toBe("ai-estimator:v1:abc");
  });

  it("recalculates totals after the first sourceKey-backed line insertion", async () => {
    mockPrisma.costItem.findFirst.mockResolvedValue({
      id: "cost-item-1",
      orgId: "org-1",
      unitOfMeasure: "EA",
      name: "Panel replacement",
    });
    mockCostDatabase.getUnitCost.mockResolvedValue({ totalUnitCost: 250 });
    mockPrisma.estimateLineItem.aggregate.mockResolvedValue({ _max: { sortOrder: 3 } });
    mockPrisma.estimateLineItem.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.estimateLineItem.findFirst.mockResolvedValue({
      id: "line-new",
      estimateId: "estimate-1",
      costItemId: "cost-item-1",
      assemblyId: null,
      description: "Panel replacement",
      quantity: 1,
      unitOfMeasure: "EA",
      unitCost: 250,
      lineCost: 250,
      sortOrder: 4,
      sourceKey: "ai-estimator:v1:first",
    });
    mockPrisma.estimate.findFirst.mockResolvedValue({
      id: "estimate-1",
      orgId: "org-1",
      projectId: "project-1",
      version: 1,
      status: "draft",
      overheadPct: 0,
      profitPct: 0,
      targetMarginPct: null,
      subtotalCost: 250,
      totalPrice: 250,
      lineItems: [{ lineCost: 250 }],
    });
    mockPrisma.estimate.update.mockResolvedValue({
      id: "estimate-1",
      orgId: "org-1",
      projectId: "project-1",
      version: 1,
      status: "draft",
      overheadPct: 0,
      profitPct: 0,
      targetMarginPct: null,
      subtotalCost: 250,
      totalPrice: 250,
    });

    const lineItem = await new EstimateEngineService().addLineItem({
      estimateId: "estimate-1",
      orgId: "org-1",
      costItemId: "cost-item-1",
      quantity: 1,
      description: "Panel replacement",
      sourceKey: "ai-estimator:v1:first",
    });

    expect(mockPrisma.estimateLineItem.createMany).toHaveBeenCalledWith({
      data: expect.objectContaining({ sourceKey: "ai-estimator:v1:first", sortOrder: 4 }),
      skipDuplicates: true,
    });
    expect(mockPrisma.estimate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "estimate-1" },
        data: expect.objectContaining({ subtotalCost: 250, totalPrice: 250 }),
      })
    );
    expect(lineItem.id).toBe("line-new");
  });

  it("finalizes an estimate after recalculating totals", async () => {
    mockPrisma.estimate.findFirst.mockResolvedValue({
      id: "estimate-1",
      orgId: "org-1",
      projectId: "project-1",
      version: 1,
      status: "draft",
      overheadPct: 10,
      profitPct: 20,
      targetMarginPct: null,
      subtotalCost: 25,
      totalPrice: 33,
      lineItems: [{ lineCost: 25 }],
    });
    mockPrisma.estimate.update
      .mockResolvedValueOnce({
        id: "estimate-1",
        orgId: "org-1",
        projectId: "project-1",
        version: 1,
        status: "draft",
        overheadPct: 10,
        profitPct: 20,
        targetMarginPct: null,
        subtotalCost: 25,
        totalPrice: 33,
      })
      .mockResolvedValueOnce({
        id: "estimate-1",
        orgId: "org-1",
        projectId: "project-1",
        version: 1,
        status: "ready",
        overheadPct: 10,
        profitPct: 20,
        targetMarginPct: null,
        subtotalCost: 25,
        totalPrice: 33,
      });

    const service = new EstimateEngineService();
    const estimate = await service.finalize("estimate-1", "org-1");

    expect(estimate.status).toBe("ready");
    expect(mockPrisma.estimate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "estimate-1" },
        data: { status: "ready" },
      })
    );
  });

  it("duplicates an estimate into the next draft version with copied line items", async () => {
    mockPrisma.estimate.findFirst
      .mockResolvedValueOnce({
        id: "estimate-1",
        orgId: "org-1",
        projectId: "project-1",
        version: 1,
        status: "sent",
        overheadPct: 10,
        profitPct: 20,
        targetMarginPct: null,
        subtotalCost: 25,
        totalPrice: 33,
        lineItems: [
          {
            costItemId: "cost-item-1",
            assemblyId: null,
            description: "Excavation",
            quantity: 2,
            unitOfMeasure: "CY",
            unitCost: 12.5,
            lineCost: 25,
            sortOrder: 1,
          },
        ],
      })
      .mockResolvedValueOnce({
        id: "estimate-2",
        orgId: "org-1",
        projectId: "project-1",
        version: 2,
        status: "draft",
        overheadPct: 10,
        profitPct: 20,
        targetMarginPct: null,
        subtotalCost: 25,
        totalPrice: 33,
        lineItems: [
          {
            id: "line-2",
            estimateId: "estimate-2",
            costItemId: "cost-item-1",
            assemblyId: null,
            description: "Excavation",
            quantity: 2,
            unitOfMeasure: "CY",
            unitCost: 12.5,
            lineCost: 25,
            sortOrder: 1,
          },
        ],
      });
    mockPrisma.estimate.count.mockResolvedValue(1);
    mockPrisma.estimate.create.mockResolvedValue({
      id: "estimate-2",
      orgId: "org-1",
      projectId: "project-1",
      version: 2,
      status: "draft",
      overheadPct: 10,
      profitPct: 20,
      targetMarginPct: null,
      subtotalCost: 25,
      totalPrice: 33,
    });

    const service = new EstimateEngineService();
    const duplicate = await service.duplicateFromVersion("estimate-1", "org-1");

    expect(mockPrisma.estimate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project-1",
          version: 2,
          status: "draft",
          lineItems: {
            create: [
              expect.objectContaining({
                description: "Excavation",
                quantity: 2,
                lineCost: 25,
              }),
            ],
          },
        }),
      })
    );
    expect(duplicate.version).toBe(2);
    expect(duplicate.status).toBe("draft");
    expect(duplicate.lineItems).toHaveLength(1);
  });
});
