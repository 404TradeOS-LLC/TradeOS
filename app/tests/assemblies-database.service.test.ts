const mockPrisma = {
  $transaction: jest.fn(),
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

jest.mock("../db/client", () => ({ prisma: mockPrisma, basePrisma: mockPrisma }));

import { AssembliesDatabaseService } from "../modules/assemblies-database/service";

describe("AssembliesDatabaseService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (operation) => operation(mockPrisma));
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
          installedRecipeId: null,
          installedRecipeVersion: null,
          installedAt: null,
          currentRecipeVersion: null,
          updateAvailable: false,
          wasteOverridePct: null,
          productionRateFactor: null,
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
    it("publishes researched assemblies through the existing authenticated catalog API", () => {
      const result = new AssembliesDatabaseService().listStarterCatalog();
      expect(result.items).toHaveLength(107);
      expect(result.items.find((item) => item.id === "tradeos:roofing-shingles-arch-asphalt"))
        .toMatchObject({ nahbPhase: "4000", blockingReasons: [] });
      expect(result.coverage.some((group) => group.nahbGroup === "Full Enclosure (Dry-in)")).toBe(true);
      expect(result.items.find((item) => item.id === "openings:garage-door-section-steel"))
        .toMatchObject({ nahbPhase: "4000", blockingReasons: [] });
      expect(result.items.find((item) => item.id === "appliances:dishwasher-built-in-existing-ready"))
        .toMatchObject({ csiDivision: "11", blockingReasons: [] });
    });

    it("rejects unresolved research source evidence before accessing tenant data", async () => {
      await expect(new AssembliesDatabaseService().installStarterCatalogAssembly({
        orgId: "org-1",
        templateId: "tradeos:demo-cabinet-kitchen-base-wall",
        componentMappings: [{ componentKey: "unused", costItemId: "11111111-1111-4111-8111-111111111111" }],
      })).rejects.toThrow(/Research assembly cannot be installed.*SRC-0050/);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.assembly.create).not.toHaveBeenCalled();
    });

    it("installs a research recipe whose sources were repaired (DEV-23, #518 S1)", async () => {
      const ids = [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333",
      ];
      mockPrisma.assembly.findFirst.mockResolvedValue(null);
      mockPrisma.costItem.findMany.mockResolvedValue([
        { id: ids[0], unitOfMeasure: "HR", laborRateId: "labor-1", materialId: null, equipmentId: null, subcontractorId: null },
        { id: ids[1], unitOfMeasure: "HR", laborRateId: "labor-2", materialId: null, equipmentId: null, subcontractorId: null },
        { id: ids[2], unitOfMeasure: "HR", laborRateId: null, materialId: null, equipmentId: "equipment-1", subcontractorId: null },
      ]);
      mockPrisma.assembly.create.mockResolvedValue({
        id: "trench-1", orgId: "org-1",
        code: "31 23 16.13-TOS-R001", name: "Continuous Footing Trench Excavation via Mini-Excavator",
        unitOfMeasure: "CY", description: "with evidence",
        isTemplate: true, isActive: true,
      });
      mockPrisma.assemblyItem.createMany.mockResolvedValue({ count: 3 });
      const created = await new AssembliesDatabaseService().installStarterCatalogAssembly({
        orgId: "org-1",
        templateId: "tradeos:earthwork-trench-excavation-mini",
        componentMappings: [
          { componentKey: "labor_excavator_operator", costItemId: ids[0] },
          { componentKey: "labor_grade_trench_helper", costItemId: ids[1] },
          { componentKey: "equip_mini_excavator_3ton", costItemId: ids[2] },
        ],
      });
      expect(created.code).toBe("31 23 16.13-TOS-R001");
      expect(mockPrisma.assembly.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orgId: "org-1", code: "31 23 16.13-TOS-R001",
          description: expect.stringContaining("Research evidence: SRC-0006, SRC-0041"),
          isTemplate: true,
        }),
      });
    });

    it("installs a straight-run laminate countertop only with native LF material and labor mappings", async () => {
      const ids = [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ];
      mockPrisma.assembly.findFirst.mockResolvedValue(null);
      mockPrisma.costItem.findMany.mockResolvedValue([
        { id: ids[0], unitOfMeasure: "LF", laborRateId: null, materialId: "material-1", equipmentId: null, subcontractorId: null },
        { id: ids[1], unitOfMeasure: "LF", laborRateId: "labor-1", materialId: null, equipmentId: null, subcontractorId: null },
      ]);
      mockPrisma.assembly.create.mockResolvedValue({
        id: "kitchen-top-1", orgId: "org-1",
        code: "12 36 23-TOS-001", name: "Prefabricated Laminate Countertop — Straight Run",
        unitOfMeasure: "LF", description: "with evidence",
        isTemplate: true, isActive: true,
      });
      mockPrisma.assemblyItem.createMany.mockResolvedValue({ count: 2 });
      const created = await new AssembliesDatabaseService().installStarterCatalogAssembly({
        orgId: "org-1", templateId: "kitchen:laminate-countertop-straight",
        componentMappings: [
          { componentKey: "laminate-countertop-material", costItemId: ids[0] },
          { componentKey: "laminate-countertop-install", costItemId: ids[1] },
        ],
      });
      expect(created.code).toBe("12 36 23-TOS-001");
      expect(mockPrisma.assembly.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orgId: "org-1", code: "12 36 23-TOS-001",
          description: expect.stringContaining("Research evidence: SRC-0070"),
          isTemplate: true,
        }),
      });
      expect(mockPrisma.assemblyItem.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ costItemId: ids[0], quantityPerUnit: 1, sortOrder: 1 }),
          expect.objectContaining({ costItemId: ids[1], quantityPerUnit: 1, sortOrder: 2 }),
        ],
      });
    });

    it("rejects EA-priced prefabricated countertop material instead of pretending a piece is one LF", async () => {
      const ids = [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ];
      mockPrisma.assembly.findFirst.mockResolvedValue(null);
      mockPrisma.costItem.findMany.mockResolvedValue([
        { id: ids[0], unitOfMeasure: "EA", laborRateId: null, materialId: "material-1", equipmentId: null, subcontractorId: null },
        { id: ids[1], unitOfMeasure: "LF", laborRateId: "labor-1", materialId: null, equipmentId: null, subcontractorId: null },
      ]);
      await expect(new AssembliesDatabaseService().installStarterCatalogAssembly({
        orgId: "org-1", templateId: "kitchen:laminate-countertop-straight",
        componentMappings: [
          { componentKey: "laminate-countertop-material", costItemId: ids[0] },
          { componentKey: "laminate-countertop-install", costItemId: ids[1] },
        ],
      })).rejects.toThrow(/Prefabricated laminate countertop.*expects LF but Cost Item uses EA/);
      expect(mockPrisma.assembly.create).not.toHaveBeenCalled();
    });

    it("installs a fully mapped starter as a tenant-scoped reusable assembly", async () => {
      mockPrisma.assembly.findFirst.mockResolvedValue(null);
      mockPrisma.costItem.findMany.mockResolvedValue([
        { id: "11111111-1111-4111-8111-111111111111", unitOfMeasure: "CY", laborRateId: null, materialId: null, equipmentId: "equipment-1", subcontractorId: null },
        { id: "22222222-2222-4222-8222-222222222222", unitOfMeasure: "CY", laborRateId: null, materialId: null, equipmentId: null, subcontractorId: "sub-1" },
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
        select: { id: true, unitOfMeasure: true, laborRateId: true, materialId: true, equipmentId: true, subcontractorId: true },
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
      mockPrisma.costItem.findMany.mockResolvedValue([{ id: "11111111-1111-4111-8111-111111111111", unitOfMeasure: "CY", laborRateId: null, materialId: null, equipmentId: "equipment-1", subcontractorId: null }]);

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

    it("rejects one Cost Item mapped to multiple recipe slots", async () => {
      await expect(new AssembliesDatabaseService().installStarterCatalogAssembly({
        orgId: "org-1",
        templateId: "site-excavation",
        componentMappings: [
          { componentKey: "excavation", costItemId: "11111111-1111-4111-8111-111111111111" },
          { componentKey: "haul", costItemId: "11111111-1111-4111-8111-111111111111" },
        ],
      })).rejects.toThrow(/Cost Item may be mapped to only one recipe slot/);
      expect(mockPrisma.costItem.findMany).not.toHaveBeenCalled();
    });

    it("rejects mappings whose unit or component type does not match the recipe slot", async () => {
      mockPrisma.assembly.findFirst.mockResolvedValue(null);
      mockPrisma.costItem.findMany.mockResolvedValue([
        { id: "11111111-1111-4111-8111-111111111111", unitOfMeasure: "SF", laborRateId: "labor-1", materialId: null, equipmentId: null, subcontractorId: null },
        { id: "22222222-2222-4222-8222-222222222222", unitOfMeasure: "CY", laborRateId: null, materialId: null, equipmentId: null, subcontractorId: "sub-1" },
      ]);

      await expect(new AssembliesDatabaseService().installStarterCatalogAssembly({
        orgId: "org-1",
        templateId: "site-excavation",
        componentMappings: [
          { componentKey: "excavation", costItemId: "11111111-1111-4111-8111-111111111111" },
          { componentKey: "haul", costItemId: "22222222-2222-4222-8222-222222222222" },
        ],
      })).rejects.toThrow(/Excavation labor and equipment.*expects CY.*expects equipment, subcontractor, or composite/);
      expect(mockPrisma.assembly.create).not.toHaveBeenCalled();
    });

    it("keeps the assembly and all components in one transaction", async () => {
      mockPrisma.assembly.findFirst.mockResolvedValue(null);
      mockPrisma.costItem.findMany.mockResolvedValue([
        { id: "11111111-1111-4111-8111-111111111111", unitOfMeasure: "CY", laborRateId: null, materialId: null, equipmentId: "equipment-1", subcontractorId: null },
        { id: "22222222-2222-4222-8222-222222222222", unitOfMeasure: "CY", laborRateId: null, materialId: null, equipmentId: null, subcontractorId: "sub-1" },
      ]);
      mockPrisma.assembly.create.mockResolvedValue({
        id: "assembly-installed", orgId: "org-1", code: "31 23 16-TOS-001", name: "General excavation",
        unitOfMeasure: "CY", description: "classified", isTemplate: true, isActive: true,
      });
      mockPrisma.assemblyItem.createMany.mockResolvedValue({ count: 2 });

      await new AssembliesDatabaseService().installStarterCatalogAssembly({
        orgId: "org-1",
        templateId: "site-excavation",
        componentMappings: [
          { componentKey: "excavation", costItemId: "11111111-1111-4111-8111-111111111111" },
          { componentKey: "haul", costItemId: "22222222-2222-4222-8222-222222222222" },
        ],
      });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.assembly.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.assemblyItem.createMany).toHaveBeenCalledTimes(1);
    });
  });

  describe("install overrides (DEV-17 S10, issue #518)", () => {
    const excavationIds = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ];
    const excavationMappings = [
      { componentKey: "excavation", costItemId: excavationIds[0] },
      { componentKey: "haul", costItemId: excavationIds[1] },
    ];

    function mockExcavationMappings() {
      mockPrisma.assembly.findFirst.mockResolvedValue(null);
      mockPrisma.costItem.findMany.mockResolvedValue([
        { id: excavationIds[0], unitOfMeasure: "CY", laborRateId: null, materialId: null, equipmentId: "equipment-1", subcontractorId: null },
        { id: excavationIds[1], unitOfMeasure: "CY", laborRateId: null, materialId: null, equipmentId: null, subcontractorId: "sub-1" },
      ]);
      mockPrisma.assemblyItem.createMany.mockResolvedValue({ count: 2 });
    }

    it("stores waste and production overrides on the installed assembly", async () => {
      mockExcavationMappings();
      mockPrisma.assembly.create.mockResolvedValue({
        id: "assembly-installed", orgId: "org-1", code: "31 23 16-TOS-001", name: "General excavation",
        unitOfMeasure: "CY", description: "classified", isTemplate: true, isActive: true,
        wasteOverridePct: 15, productionRateFactor: 0.8,
      });

      const result = await new AssembliesDatabaseService().installStarterCatalogAssembly({
        orgId: "org-1",
        templateId: "site-excavation",
        componentMappings: excavationMappings,
        wasteOverridePct: 15,
        productionRateFactor: 0.8,
      });

      expect(mockPrisma.assembly.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ wasteOverridePct: 15, productionRateFactor: 0.8 }),
      });
      expect(result.wasteOverridePct).toBe(15);
      expect(result.productionRateFactor).toBe(0.8);
    });

    it("stores null overrides when none are supplied, and never rewrites recipe quantities", async () => {
      mockExcavationMappings();
      mockPrisma.assembly.create.mockResolvedValue({
        id: "assembly-installed", orgId: "org-1", code: "31 23 16-TOS-001", name: "General excavation",
        unitOfMeasure: "CY", description: "classified", isTemplate: true, isActive: true,
      });

      const result = await new AssembliesDatabaseService().installStarterCatalogAssembly({
        orgId: "org-1",
        templateId: "site-excavation",
        componentMappings: excavationMappings,
      });

      expect(mockPrisma.assembly.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ wasteOverridePct: null, productionRateFactor: null }),
      });
      expect(result.wasteOverridePct).toBeNull();
      expect(result.productionRateFactor).toBeNull();
      expect(mockPrisma.assemblyItem.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ costItemId: excavationIds[0], quantityPerUnit: 1, sortOrder: 1 }),
          expect.objectContaining({ costItemId: excavationIds[1], quantityPerUnit: 1, sortOrder: 2 }),
        ],
      });
    });

    it.each([
      [{ wasteOverridePct: 101 }, /wasteOverridePct must be between 0 and 100/],
      [{ wasteOverridePct: -1 }, /wasteOverridePct must be between 0 and 100/],
      [{ productionRateFactor: 0 }, /productionRateFactor must be greater than 0 and at most 10/],
      [{ productionRateFactor: 11 }, /productionRateFactor must be greater than 0 and at most 10/],
    ])("rejects out-of-range overrides %s before touching tenant data", async (overrides, message) => {
      await expect(new AssembliesDatabaseService().installStarterCatalogAssembly({
        orgId: "org-1",
        templateId: "site-excavation",
        componentMappings: excavationMappings,
        ...overrides,
      })).rejects.toThrow(message);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.assembly.create).not.toHaveBeenCalled();
    });

    it("prices material legs with the assembly waste override instead of the mapped item's waste", async () => {
      mockPrisma.assembly.findFirst.mockResolvedValue({ id: "assembly-1", orgId: "org-1", wasteOverridePct: 20, productionRateFactor: null });
      mockPrisma.assemblyItem.findMany.mockResolvedValue([
        { costItemId: "cost-item-1", childAssemblyId: null, quantityPerUnit: 1, sortOrder: 0 },
      ]);
      mockPrisma.costItem.findFirst.mockResolvedValue({
        id: "cost-item-1", orgId: "org-1", productionRate: null,
        laborRate: null,
        material: { unitCost: 100, wasteFactorPct: 5 },
        equipment: null,
      });

      const result = await new AssembliesDatabaseService().getAssemblyUnitCost("assembly-1", undefined, new Set(), "org-1");

      expect(result.unitCost).toBeCloseTo(120, 2);
    });

    it("prices material legs with the mapped item's waste when no override is stored", async () => {
      mockPrisma.assembly.findFirst.mockResolvedValue({ id: "assembly-1", orgId: "org-1", wasteOverridePct: null, productionRateFactor: null });
      mockPrisma.assemblyItem.findMany.mockResolvedValue([
        { costItemId: "cost-item-1", childAssemblyId: null, quantityPerUnit: 1, sortOrder: 0 },
      ]);
      mockPrisma.costItem.findFirst.mockResolvedValue({
        id: "cost-item-1", orgId: "org-1", productionRate: null,
        laborRate: null,
        material: { unitCost: 100, wasteFactorPct: 5 },
        equipment: null,
      });

      const result = await new AssembliesDatabaseService().getAssemblyUnitCost("assembly-1", undefined, new Set(), "org-1");

      expect(result.unitCost).toBeCloseTo(105, 2);
    });

    it("prices labor legs with the assembly production factor instead of the mapped item's rate", async () => {
      mockPrisma.assembly.findFirst.mockResolvedValue({ id: "assembly-1", orgId: "org-1", wasteOverridePct: null, productionRateFactor: 0.5 });
      mockPrisma.assemblyItem.findMany.mockResolvedValue([
        { costItemId: "cost-item-1", childAssemblyId: null, quantityPerUnit: 1, sortOrder: 0 },
      ]);
      mockPrisma.costItem.findFirst.mockResolvedValue({
        id: "cost-item-1", orgId: "org-1", productionRate: 10,
        laborRate: { baseHourlyRate: 40, burdenPct: 0, region: null },
        material: null,
        equipment: null,
      });

      const result = await new AssembliesDatabaseService().getAssemblyUnitCost("assembly-1", undefined, new Set(), "org-1");

      // Effective rate 10 x 0.5 = 5 units/hour: 1 unit takes 0.2h x $40 = $8.
      expect(result.unitCost).toBeCloseTo(8, 2);
    });

    it("never lets a parent override cascade into a child assembly", async () => {
      mockPrisma.assembly.findFirst.mockImplementation(({ where }) => {
        if (where.id === "assembly-parent") return Promise.resolve({ id: "assembly-parent", orgId: "org-1", wasteOverridePct: null, productionRateFactor: 0.5 });
        if (where.id === "assembly-child") return Promise.resolve({ id: "assembly-child", orgId: "org-1", wasteOverridePct: null, productionRateFactor: null });
        return Promise.resolve(null);
      });
      mockPrisma.assemblyItem.findMany.mockImplementation(({ where }) => {
        if (where.assemblyId === "assembly-parent") {
          return Promise.resolve([
            { costItemId: "labor-item", childAssemblyId: null, quantityPerUnit: 1, sortOrder: 0 },
            { costItemId: null, childAssemblyId: "assembly-child", quantityPerUnit: 1, sortOrder: 1 },
          ]);
        }
        if (where.assemblyId === "assembly-child") {
          return Promise.resolve([
            { costItemId: "labor-item-2", childAssemblyId: null, quantityPerUnit: 1, sortOrder: 0 },
          ]);
        }
        return Promise.resolve([]);
      });
      mockPrisma.costItem.findFirst.mockImplementation(({ where }) => Promise.resolve({
        id: where.id, orgId: "org-1", productionRate: 10,
        laborRate: { baseHourlyRate: 40, burdenPct: 0, region: null },
        material: null,
        equipment: null,
      }));

      const result = await new AssembliesDatabaseService().getAssemblyUnitCost("assembly-parent", undefined, new Set(), "org-1");

      // Parent direct labor at 0.5x: $8. Child labor at its own rate: $4. Total $12 (not $16).
      expect(result.unitCost).toBeCloseTo(12, 2);
    });

    it("sets overrides through the update path", async () => {
      mockPrisma.assembly.findFirst.mockResolvedValue({ id: "assembly-1", orgId: "org-1" });
      mockPrisma.assembly.update.mockResolvedValue({
        id: "assembly-1", orgId: "org-1", code: "A-1", name: "Custom Assembly",
        unitOfMeasure: "EA", description: null, isTemplate: true, isActive: true,
        wasteOverridePct: 12, productionRateFactor: 0.9,
      });

      const result = await new AssembliesDatabaseService().update("assembly-1", { wasteOverridePct: 12, productionRateFactor: 0.9 }, "org-1");

      expect(mockPrisma.assembly.update).toHaveBeenCalledWith({
        where: { id: "assembly-1" },
        data: expect.objectContaining({ wasteOverridePct: 12, productionRateFactor: 0.9 }),
      });
      expect(result.wasteOverridePct).toBe(12);
      expect(result.productionRateFactor).toBe(0.9);
    });

    it("clears overrides through the update path with explicit null", async () => {
      mockPrisma.assembly.findFirst.mockResolvedValue({ id: "assembly-1", orgId: "org-1" });
      mockPrisma.assembly.update.mockResolvedValue({
        id: "assembly-1", orgId: "org-1", code: "A-1", name: "Custom Assembly",
        unitOfMeasure: "EA", description: null, isTemplate: true, isActive: true,
        wasteOverridePct: null, productionRateFactor: null,
      });

      const result = await new AssembliesDatabaseService().update("assembly-1", { wasteOverridePct: null }, "org-1");

      expect(mockPrisma.assembly.update).toHaveBeenCalledWith({
        where: { id: "assembly-1" },
        data: expect.objectContaining({ wasteOverridePct: null }),
      });
      expect(result.wasteOverridePct).toBeNull();
    });
  });
});
