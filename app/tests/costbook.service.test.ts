const mockPrisma = {
  costbookWorkspace: {
    findUnique: jest.fn(),
  },
  division: {
    count: jest.fn(),
  },
  costItem: {
    count: jest.fn(),
  },
  laborRate: {
    count: jest.fn(),
  },
  material: {
    count: jest.fn(),
  },
  equipment: {
    count: jest.fn(),
  },
  assembly: {
    count: jest.fn(),
  },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { CostbookService } from "../modules/costbook";

describe("CostbookService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.costbookWorkspace.findUnique.mockResolvedValue(null);
    mockPrisma.division.count.mockResolvedValue(2);
    mockPrisma.costItem.count.mockResolvedValue(8);
    mockPrisma.laborRate.count.mockResolvedValue(3);
    mockPrisma.material.count.mockResolvedValue(5);
    mockPrisma.equipment.count.mockResolvedValue(1);
    mockPrisma.assembly.count.mockResolvedValue(4);
  });

  it("returns a read-only foundation summary for a dispatcher-scoped estimator role", async () => {
    const summary = await new CostbookService().getWorkspace({
      userId: "user-1",
      orgId: "org-1",
      role: "dispatcher",
    });

    expect(summary).toMatchObject({
      organizationId: "org-1",
      initialized: false,
      status: "foundation",
      permissions: {
        canRead: true,
        canWrite: false,
        canManage: false,
      },
      counts: {
        categories: 2,
        costItems: 8,
        laborRates: 3,
        materials: 5,
        equipment: 1,
        assemblies: 4,
      },
    });
  });

  it("scopes every inventory lookup to the authenticated organization", async () => {
    await new CostbookService().getWorkspace({
      userId: "user-1",
      orgId: "org-tenant-a",
      role: "owner",
    });

    expect(mockPrisma.costbookWorkspace.findUnique).toHaveBeenCalledWith({
      where: { organizationId: "org-tenant-a" },
    });
    expect(mockPrisma.division.count).toHaveBeenCalledWith({ where: { orgId: "org-tenant-a" } });
    expect(mockPrisma.costItem.count).toHaveBeenCalledWith({ where: { orgId: "org-tenant-a", isActive: true } });
    expect(mockPrisma.laborRate.count).toHaveBeenCalledWith({ where: { orgId: "org-tenant-a" } });
    expect(mockPrisma.material.count).toHaveBeenCalledWith({ where: { orgId: "org-tenant-a" } });
    expect(mockPrisma.equipment.count).toHaveBeenCalledWith({ where: { orgId: "org-tenant-a" } });
    expect(mockPrisma.assembly.count).toHaveBeenCalledWith({ where: { orgId: "org-tenant-a", isActive: true } });
  });
});
