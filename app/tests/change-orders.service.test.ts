const mockPrisma = {
  project: {
    findFirst: jest.fn(),
  },
  estimate: {
    findFirst: jest.fn(),
  },
  changeOrder: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    aggregate: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  changeOrderLineItem: {
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  costItem: {
    findFirst: jest.fn(),
  },
};

const mockCostDatabase = {
  getUnitCost: jest.fn(),
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));
jest.mock("../modules/cost-database/service", () => ({
  CostDatabaseService: jest.fn().mockImplementation(() => mockCostDatabase),
}));

import { ChangeOrdersService } from "../modules/change-orders/service";

describe("ChangeOrdersService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a project-scoped change order and numbers it sequentially", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });
    mockPrisma.estimate.findFirst.mockResolvedValue({ id: "estimate-1", projectId: "project-1", orgId: "org-1" });
    mockPrisma.changeOrder.aggregate.mockResolvedValue({ _max: { coNumber: 3 } });
    mockPrisma.changeOrder.create.mockResolvedValue({
      id: "co-1",
      projectId: "project-1",
      estimateId: "estimate-1",
      coNumber: 4,
      description: "Scope bump",
      status: "draft",
      amount: 0,
    });

    const service = new ChangeOrdersService();
    const changeOrder = await service.create({
      orgId: "org-1",
      projectId: "project-1",
      estimateId: "estimate-1",
      description: "Scope bump",
    });

    expect(changeOrder.coNumber).toBe(4);
  });

  it("adds a priced line item and recalculates the change order amount", async () => {
    mockPrisma.changeOrder.findFirst.mockResolvedValue({
      id: "co-1",
      projectId: "project-1",
      estimateId: null,
      coNumber: 1,
      description: "Change order",
      status: "draft",
      amount: 0,
      lineItems: [{ sortOrder: 1, lineCost: 50 }],
      project: { orgId: "org-1" },
    });
    mockPrisma.costItem.findFirst.mockResolvedValue({
      id: "cost-item-1",
      orgId: "org-1",
      name: "Additional excavation",
    });
    mockCostDatabase.getUnitCost.mockResolvedValue({ totalUnitCost: 25 });
    mockPrisma.changeOrderLineItem.create.mockResolvedValue({
      id: "co-li-1",
      changeOrderId: "co-1",
      costItemId: "cost-item-1",
      description: "Additional excavation",
      quantity: 2,
      unitCost: 25,
      lineCost: 50,
      sortOrder: 2,
    });
    mockPrisma.changeOrderLineItem.create.mockResolvedValueOnce({
      id: "co-li-1",
      changeOrderId: "co-1",
      costItemId: "cost-item-1",
      description: "Additional excavation",
      quantity: 2,
      unitCost: 25,
      lineCost: 50,
      sortOrder: 2,
    });
    mockPrisma.changeOrder.update.mockResolvedValue({
      id: "co-1",
      projectId: "project-1",
      estimateId: null,
      coNumber: 1,
      description: "Change order",
      status: "draft",
      amount: 50,
    });

    const service = new ChangeOrdersService();
    const lineItem = await service.addLineItem({
      orgId: "org-1",
      changeOrderId: "co-1",
      costItemId: "cost-item-1",
      quantity: 2,
    });

    expect(lineItem.lineCost).toBe(50);
    expect(mockPrisma.changeOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "co-1" },
        data: { amount: 50 },
      })
    );
  });

  it("approves a change order after recalculating totals", async () => {
    mockPrisma.changeOrder.findFirst.mockResolvedValue({
      id: "co-1",
      projectId: "project-1",
      estimateId: null,
      coNumber: 1,
      description: "Change order",
      status: "draft",
      amount: 50,
      lineItems: [{ lineCost: 50 }],
      project: { orgId: "org-1" },
    });
    mockPrisma.changeOrder.update.mockResolvedValue({
      id: "co-1",
      projectId: "project-1",
      estimateId: null,
      coNumber: 1,
      description: "Change order",
      status: "approved",
      amount: 50,
    });

    const service = new ChangeOrdersService();
    const changeOrder = await service.approve("co-1", "org-1");

    expect(changeOrder.status).toBe("approved");
  });

  it("removes a draft change order line item and updates the amount", async () => {
    let changeOrderFindCount = 0;
    mockPrisma.changeOrder.findFirst.mockImplementation(({ where }) => {
      if (where.id === "co-1") {
        changeOrderFindCount += 1;
        return Promise.resolve({
          id: "co-1",
          projectId: "project-1",
          estimateId: null,
          coNumber: 1,
          description: "Change order",
          status: "draft",
          amount: changeOrderFindCount > 1 ? 0 : 50,
          lineItems: changeOrderFindCount > 1 ? [] : [{ lineCost: 50 }],
          project: { orgId: "org-1" },
        });
      }
      if (where.id === "co-li-1") {
        return Promise.resolve({
          id: "co-li-1",
          changeOrderId: "co-1",
          costItemId: "cost-item-1",
          description: "Additional excavation",
          quantity: 2,
          unitCost: 25,
          lineCost: 50,
          sortOrder: 1,
        });
      }
      return Promise.resolve(null);
    });
    mockPrisma.changeOrderLineItem.findFirst.mockResolvedValue({
      id: "co-li-1",
      changeOrderId: "co-1",
      costItemId: "cost-item-1",
      description: "Additional excavation",
      quantity: 2,
      unitCost: 25,
      lineCost: 50,
      sortOrder: 1,
    });
    mockPrisma.changeOrder.update.mockResolvedValue({
      id: "co-1",
      projectId: "project-1",
      estimateId: null,
      coNumber: 1,
      description: "Change order",
      status: "draft",
      amount: 0,
    });

    const service = new ChangeOrdersService();
    await service.removeLineItem("co-1", "co-li-1", "org-1");

    expect(mockPrisma.changeOrderLineItem.delete).toHaveBeenCalledWith({ where: { id: "co-li-1" } });
    expect(mockPrisma.changeOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "co-1" },
        data: { amount: 0 },
      })
    );
  });
});
