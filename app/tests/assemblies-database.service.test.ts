const mockPrisma = {
  assembly: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  assemblyItem: {
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    delete: jest.fn(),
  },
  costItem: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { AssembliesDatabaseService } from "../modules/assemblies-database/service";

describe("AssembliesDatabaseService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("recursively rolls up nested assemblies", async () => {
    mockPrisma.assembly.findFirst.mockImplementation(({ where }) => Promise.resolve({ id: where.id, orgId: where.orgId }));
    mockPrisma.assemblyItem.findMany.mockImplementation(({ where }) => {
      if (where.assemblyId === "assembly-parent") {
        return Promise.resolve([
          { costItemId: null, childAssemblyId: "assembly-child", quantityPerUnit: 2, sortOrder: 0 },
        ]);
      }
      if (where.assemblyId === "assembly-child") {
        return Promise.resolve([
          { costItemId: "cost-item-1", childAssemblyId: null, quantityPerUnit: 3, sortOrder: 0 },
        ]);
      }
      return Promise.resolve([]);
    });

    mockPrisma.costItem.findFirst.mockResolvedValue({
      id: "cost-item-1",
      orgId: "org-1",
      subcategoryId: "sub-1",
      code: "02-200-10-001",
      name: "Leaf Cost Item",
      unitOfMeasure: "EA",
      productionRate: 1,
      laborRate: {
        baseHourlyRate: 10,
        burdenPct: 0,
        region: null,
      },
      material: null,
      equipment: null,
    });

    const service = new AssembliesDatabaseService();
    const result = await service.getAssemblyUnitCost("assembly-parent", undefined, new Set(), "org-1");

    expect(mockPrisma.assembly.findFirst).toHaveBeenCalledWith({ where: { id: "assembly-parent", orgId: "org-1" } });
    expect(mockPrisma.assembly.findFirst).toHaveBeenCalledWith({ where: { id: "assembly-child", orgId: "org-1" } });
    expect(result.unitCost).toBeCloseTo(60, 2);
    expect(result.componentCount).toBe(1);
  });

  it("rejects circular assembly references", async () => {
    mockPrisma.assembly.findFirst.mockImplementation(({ where }) => Promise.resolve({ id: where.id, orgId: where.orgId }));
    mockPrisma.assemblyItem.findMany.mockImplementation(({ where }) => {
      if (where.assemblyId === "assembly-parent") {
        return Promise.resolve([
          { costItemId: null, childAssemblyId: "assembly-child", quantityPerUnit: 1, sortOrder: 0 },
        ]);
      }
      if (where.assemblyId === "assembly-child") {
        return Promise.resolve([
          { costItemId: null, childAssemblyId: "assembly-parent", quantityPerUnit: 1, sortOrder: 0 },
        ]);
      }
      return Promise.resolve([]);
    });

    const service = new AssembliesDatabaseService();

    await expect(service.getAssemblyUnitCost("assembly-parent", undefined, new Set(), "org-1")).rejects.toThrow(
      /Circular assembly reference/
    );
  });

  describe("templates", () => {
    it("lists only active, template-flagged assemblies for the organization", async () => {
      mockPrisma.assembly.findMany.mockResolvedValue([
        {
          id: "assembly-template-1",
          orgId: "org-1",
          code: "TPL-01",
          name: "Standard Bathroom Remodel",
          unitOfMeasure: "EA",
          description: null,
          isTemplate: true,
          isActive: true,
        },
      ]);

      const result = await new AssembliesDatabaseService().listTemplates("org-1");

      expect(mockPrisma.assembly.findMany).toHaveBeenCalledWith({
        where: { orgId: "org-1", isTemplate: true, isActive: true },
        orderBy: { name: "asc" },
      });
      expect(result).toEqual([
        {
          id: "assembly-template-1",
          orgId: "org-1",
          code: "TPL-01",
          name: "Standard Bathroom Remodel",
          unitOfMeasure: "EA",
          description: null,
          isTemplate: true,
          isActive: true,
        },
      ]);
    });

    it("defaults isTemplate to false when creating an assembly without it", async () => {
      mockPrisma.assembly.create.mockResolvedValue({
        id: "assembly-1",
        orgId: "org-1",
        code: "A-1",
        name: "Custom Assembly",
        unitOfMeasure: "EA",
        description: null,
        isTemplate: false,
        isActive: true,
      });

      await new AssembliesDatabaseService().create({
        orgId: "org-1",
        code: "A-1",
        name: "Custom Assembly",
        unitOfMeasure: "EA",
      });

      expect(mockPrisma.assembly.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isTemplate: false }),
      });
    });

    it("marks an assembly as a template when requested on create", async () => {
      mockPrisma.assembly.create.mockResolvedValue({
        id: "assembly-2",
        orgId: "org-1",
        code: "TPL-02",
        name: "200 SF Deck",
        unitOfMeasure: "EA",
        description: null,
        isTemplate: true,
        isActive: true,
      });

      await new AssembliesDatabaseService().create({
        orgId: "org-1",
        code: "TPL-02",
        name: "200 SF Deck",
        unitOfMeasure: "EA",
        isTemplate: true,
      });

      expect(mockPrisma.assembly.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isTemplate: true }),
      });
    });

    it("updates the isTemplate flag on an existing assembly", async () => {
      mockPrisma.assembly.findFirst.mockResolvedValue({ id: "assembly-1", orgId: "org-1" });
      mockPrisma.assembly.update.mockResolvedValue({
        id: "assembly-1",
        orgId: "org-1",
        code: "A-1",
        name: "Custom Assembly",
        unitOfMeasure: "EA",
        description: null,
        isTemplate: true,
        isActive: true,
      });

      const result = await new AssembliesDatabaseService().update("assembly-1", { isTemplate: true }, "org-1");

      expect(mockPrisma.assembly.update).toHaveBeenCalledWith({
        where: { id: "assembly-1" },
        data: expect.objectContaining({ isTemplate: true }),
      });
      expect(result.isTemplate).toBe(true);
    });
  });

  describe("starter catalog", () => {
    it("installs a fully mapped starter as a tenant-scoped reusable assembly", async () => {
      mockPrisma.assembly.findFirst.mockResolvedValue(null);
      mockPrisma.costItem.findMany.mockResolvedValue([
        { id: "11111111-1111-4111-8111-111111111111" },
        { id: "22222222-2222-4222-8222-222222222222" },
      ]);
      mockPrisma.assembly.create.mockResolvedValue({
        id: "assembly-installed",
        orgId: "org-1",
        code: "31 23 16-TOS-001",
        name: "General excavation",
        unitOfMeasure: "CY",
        description: "classified",
        isTemplate: true,
        isActive: true,
      });
      mockPrisma.assemblyItem.createMany.mockResolvedValue({ count: 2 });

      const result = await new AssembliesDatabaseService().installStarterCatalogAssembly({
        orgId: "org-1",
        templateId: "site-excavation",
        componentMappings: [
          { componentKey: "excavation", costItemId: "11111111-1111-4111-8111-111111111111" },
          { componentKey: "haul", costItemId: "22222222-2222-4222-8222-222222222222" },
        ],
      });

      expect(mockPrisma.costItem.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"] },
          orgId: "org-1",
          isActive: true,
        },
        select: { id: true },
      });
      expect(mockPrisma.assemblyItem.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ costItemId: "11111111-1111-4111-8111-111111111111", quantityPerUnit: 1, sortOrder: 1 }),
          expect.objectContaining({ costItemId: "22222222-2222-4222-8222-222222222222", quantityPerUnit: 1, sortOrder: 2 }),
        ],
      });
      expect(result).toEqual(expect.objectContaining({ code: "31 23 16-TOS-001", isTemplate: true }));
    });

    it("fails closed when a required recipe slot is not mapped", async () => {
      await expect(new AssembliesDatabaseService().installStarterCatalogAssembly({
        orgId: "org-1",
        templateId: "site-excavation",
        componentMappings: [
          { componentKey: "excavation", costItemId: "11111111-1111-4111-8111-111111111111" },
        ],
      })).rejects.toThrow(/Missing mappings: Haul and disposal allowance/);
      expect(mockPrisma.assembly.create).not.toHaveBeenCalled();
    });

    it("rejects cross-organization or inactive mapped Cost Items", async () => {
      mockPrisma.assembly.findFirst.mockResolvedValue(null);
      mockPrisma.costItem.findMany.mockResolvedValue([{ id: "11111111-1111-4111-8111-111111111111" }]);

      await expect(new AssembliesDatabaseService().installStarterCatalogAssembly({
        orgId: "org-1",
        templateId: "site-excavation",
        componentMappings: [
          { componentKey: "excavation", costItemId: "11111111-1111-4111-8111-111111111111" },
          { componentKey: "haul", costItemId: "22222222-2222-4222-8222-222222222222" },
        ],
      })).rejects.toThrow(/inactive or outside this organization/);
      expect(mockPrisma.assembly.create).not.toHaveBeenCalled();
    });
  });
});
