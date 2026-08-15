const mockPrisma = {
  estimate: { findFirst: jest.fn(), update: jest.fn(), count: jest.fn(), create: jest.fn() },
  costItem: { findFirst: jest.fn() },
  assembly: { findFirst: jest.fn() },
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

describe("Estimate Costbook historical pricing contract", () => {
  beforeEach(() => jest.clearAllMocks());

  it("recalculates from persisted line snapshots without rereading changed Costbook prices", async () => {
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
      lineItems: [
        {
          costItemId: "cost-item-1",
          assemblyId: null,
          unitCost: 12.5,
          lineCost: 25,
        },
        {
          costItemId: null,
          assemblyId: "assembly-1",
          unitCost: 30,
          lineCost: 30,
        },
      ],
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
      subtotalCost: 55,
      totalPrice: 72.6,
    });

    await new EstimateEngineService().recalculate("estimate-1", "org-1");

    expect(mockCostDatabase.getUnitCost).not.toHaveBeenCalled();
    expect(mockAssembliesDatabase.getAssemblyUnitCost).not.toHaveBeenCalled();
    expect(mockPrisma.estimate.update).toHaveBeenCalledWith({
      where: { id: "estimate-1" },
      data: { subtotalCost: 55, totalPrice: 72.6 },
    });
  });

  it("copies persisted CostItem and Assembly snapshots when duplicating an estimate version", async () => {
    const source = {
      id: "estimate-1",
      orgId: "org-1",
      projectId: "project-1",
      version: 1,
      status: "ready",
      overheadPct: 10,
      profitPct: 20,
      targetMarginPct: null,
      subtotalCost: 55,
      totalPrice: 72.6,
      lineItems: [
        {
          id: "line-cost-item",
          costItemId: "cost-item-1",
          assemblyId: null,
          description: "Material",
          quantity: 2,
          unitOfMeasure: "EA",
          unitCost: 12.5,
          lineCost: 25,
          sortOrder: 1,
        },
        {
          id: "line-assembly",
          costItemId: null,
          assemblyId: "assembly-1",
          description: "Wall Assembly",
          quantity: 1,
          unitOfMeasure: "EA",
          unitCost: 30,
          lineCost: 30,
          sortOrder: 2,
        },
      ],
    };
    mockPrisma.estimate.findFirst
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce({ ...source, id: "estimate-2", version: 2, status: "draft" });
    mockPrisma.estimate.count.mockResolvedValue(1);
    mockPrisma.estimate.create.mockResolvedValue({ id: "estimate-2" });

    await new EstimateEngineService().duplicateFromVersion("estimate-1", "org-1");

    expect(mockPrisma.estimate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: "org-1",
        projectId: "project-1",
        version: 2,
        status: "draft",
        subtotalCost: 55,
        totalPrice: 72.6,
        lineItems: {
          create: [
            expect.objectContaining({ costItemId: "cost-item-1", assemblyId: null, unitCost: 12.5, lineCost: 25 }),
            expect.objectContaining({ costItemId: null, assemblyId: "assembly-1", unitCost: 30, lineCost: 30 }),
          ],
        },
      }),
    });
    expect(mockCostDatabase.getUnitCost).not.toHaveBeenCalled();
    expect(mockAssembliesDatabase.getAssemblyUnitCost).not.toHaveBeenCalled();
  });

  it("captures the current CostItem price only when a new line is created", async () => {
    mockPrisma.estimate.findFirst
      .mockResolvedValueOnce({ id: "estimate-1", orgId: "org-1", status: "draft" })
      .mockResolvedValueOnce({
        id: "estimate-1",
        orgId: "org-1",
        projectId: "project-1",
        version: 1,
        status: "draft",
        overheadPct: 0,
        profitPct: 0,
        targetMarginPct: null,
        subtotalCost: 0,
        totalPrice: 0,
        lineItems: [{ lineCost: 40 }],
      });
    mockPrisma.costItem.findFirst.mockResolvedValue({ id: "cost-item-1", orgId: "org-1", name: "Material", unitOfMeasure: "EA" });
    mockCostDatabase.getUnitCost.mockResolvedValue({ totalUnitCost: 20 });
    mockPrisma.estimateLineItem.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
    mockPrisma.estimateLineItem.create.mockResolvedValue({
      id: "line-new",
      estimateId: "estimate-1",
      costItemId: "cost-item-1",
      assemblyId: null,
      description: "Material",
      quantity: 2,
      unitOfMeasure: "EA",
      unitCost: 20,
      lineCost: 40,
      sortOrder: 1,
      sourceKey: null,
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
      subtotalCost: 40,
      totalPrice: 40,
    });

    const line = await new EstimateEngineService().addLineItem({
      estimateId: "estimate-1",
      orgId: "org-1",
      costItemId: "cost-item-1",
      quantity: 2,
    });

    expect(mockCostDatabase.getUnitCost).toHaveBeenCalledTimes(1);
    expect(line.costItemId).toBe("cost-item-1");
    expect(line.unitCost).toBe(20);
    expect(line.lineCost).toBe(40);
  });

  it("captures the current Assembly price only when a new assembly line is created", async () => {
    mockPrisma.estimate.findFirst
      .mockResolvedValueOnce({ id: "estimate-1", orgId: "org-1", status: "draft" })
      .mockResolvedValueOnce({
        id: "estimate-1",
        orgId: "org-1",
        projectId: "project-1",
        version: 1,
        status: "draft",
        overheadPct: 0,
        profitPct: 0,
        targetMarginPct: null,
        subtotalCost: 0,
        totalPrice: 0,
        lineItems: [{ lineCost: 90 }],
      });
    mockPrisma.assembly.findFirst.mockResolvedValue({ id: "assembly-1", orgId: "org-1", name: "Wall Assembly", unitOfMeasure: "EA" });
    mockAssembliesDatabase.getAssemblyUnitCost.mockResolvedValue({ unitCost: 45, componentCount: 3 });
    mockPrisma.estimateLineItem.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
    mockPrisma.estimateLineItem.create.mockResolvedValue({
      id: "line-assembly",
      estimateId: "estimate-1",
      costItemId: null,
      assemblyId: "assembly-1",
      description: "Wall Assembly",
      quantity: 2,
      unitOfMeasure: "EA",
      unitCost: 45,
      lineCost: 90,
      sortOrder: 1,
      sourceKey: null,
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
      subtotalCost: 90,
      totalPrice: 90,
    });

    const line = await new EstimateEngineService().addLineItem({
      estimateId: "estimate-1",
      orgId: "org-1",
      assemblyId: "assembly-1",
      quantity: 2,
    });

    expect(mockAssembliesDatabase.getAssemblyUnitCost).toHaveBeenCalledTimes(1);
    expect(line.assemblyId).toBe("assembly-1");
    expect(line.unitCost).toBe(45);
    expect(line.lineCost).toBe(90);
  });
});
