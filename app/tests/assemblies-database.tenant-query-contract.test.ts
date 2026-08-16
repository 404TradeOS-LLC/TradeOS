const mockPrisma = {
  assembly: { findFirst: jest.fn() },
  assemblyItem: { findMany: jest.fn() },
  costItem: { findFirst: jest.fn() },
};
const mockCostDatabase = { getUnitCost: jest.fn() };

jest.mock("../db/client", () => ({ prisma: mockPrisma }));
jest.mock("../modules/cost-database/service", () => ({
  CostDatabaseService: jest.fn().mockImplementation(() => mockCostDatabase),
}));

import { AssembliesDatabaseService } from "../modules/assemblies-database/service";

describe("AssembliesDatabaseService tenant query contract", () => {
  beforeEach(() => jest.clearAllMocks());

  it("scopes parent and recursive child component queries to the organization", async () => {
    mockPrisma.assembly.findFirst.mockImplementation(({ where }) => Promise.resolve({ id: where.id, orgId: where.orgId }));
    mockPrisma.assemblyItem.findMany.mockImplementation(({ where }) => {
      if (where.assemblyId === "assembly-parent") {
        return Promise.resolve([{ costItemId: null, childAssemblyId: "assembly-child", quantityPerUnit: 1, sortOrder: 0 }]);
      }
      if (where.assemblyId === "assembly-child") {
        return Promise.resolve([{ costItemId: "cost-item-1", childAssemblyId: null, quantityPerUnit: 1, sortOrder: 0 }]);
      }
      return Promise.resolve([]);
    });
    mockCostDatabase.getUnitCost.mockResolvedValue({ totalUnitCost: 10 });

    await new AssembliesDatabaseService().getAssemblyUnitCost("assembly-parent", undefined, new Set(), "org-1");

    expect(mockPrisma.assemblyItem.findMany).toHaveBeenCalledWith({
      where: { assemblyId: "assembly-parent", assembly: { orgId: "org-1" } },
      orderBy: { sortOrder: "asc" },
    });
    expect(mockPrisma.assemblyItem.findMany).toHaveBeenCalledWith({
      where: { assemblyId: "assembly-child", assembly: { orgId: "org-1" } },
      orderBy: { sortOrder: "asc" },
    });
  });
});
