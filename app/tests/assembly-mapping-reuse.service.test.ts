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

describe("AssembliesDatabaseService.suggestCatalogMappingReuse (DEV-17 S9)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (operation) => operation(mockPrisma));
  });

  const service = new AssembliesDatabaseService();

  function costItemRow(overrides: Record<string, unknown>) {
    return {
      id: "ci-1",
      orgId: "org-1",
      code: "ITEM",
      name: "Item",
      unitOfMeasure: "CY",
      subcategoryId: "sub-1",
      productionRate: null,
      isActive: true,
      laborRateId: null,
      materialId: null,
      equipmentId: null,
      subcontractorId: null,
      ...overrides,
    };
  }

  it("rejects an unknown template with 404", async () => {
    await expect(service.suggestCatalogMappingReuse({
      orgId: "org-1",
      templateId: "no-such-template",
      sourceAssemblyId: "assembly-1",
    })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects a source-blocked research template with 422", async () => {
    await expect(service.suggestCatalogMappingReuse({
      orgId: "org-1",
      templateId: "tradeos:demo-roofing-shingle-tearoff-2layers",
      sourceAssemblyId: "assembly-1",
    })).rejects.toMatchObject({ statusCode: 422 });
  });

  it("rejects a missing source assembly with 404", async () => {
    mockPrisma.assembly.findFirst.mockResolvedValue(null);
    await expect(service.suggestCatalogMappingReuse({
      orgId: "org-1",
      templateId: "site-excavation",
      sourceAssemblyId: "assembly-1",
    })).rejects.toMatchObject({ statusCode: 404 });
    expect(mockPrisma.assembly.findFirst).toHaveBeenCalledWith({ where: { id: "assembly-1", orgId: "org-1" } });
  });

  it("suggests the source assembly's compatible items for the target template", async () => {
    mockPrisma.assembly.findFirst.mockResolvedValue({ id: "assembly-1", orgId: "org-1", name: "Site excavation" });
    mockPrisma.assemblyItem.findMany.mockResolvedValue([
      { costItem: costItemRow({ id: "ci-exc", code: "EXC", name: "Excavation crew", unitOfMeasure: "CY", equipmentId: "eq-1" }) },
      { costItem: costItemRow({ id: "ci-haul", code: "HAUL", name: "Haul allowance", unitOfMeasure: "CY" }) },
    ]);

    const result = await service.suggestCatalogMappingReuse({
      orgId: "org-1",
      templateId: "site-excavation",
      sourceAssemblyId: "assembly-1",
    });

    expect(result.templateId).toBe("site-excavation");
    expect(result.sourceAssemblyName).toBe("Site excavation");
    expect(result.mappedCount).toBe(2);
    expect(result.suggestions[0]).toEqual(expect.objectContaining({ componentKey: "excavation", costItemId: "ci-exc", orgId: "org-1" }));
    expect(result.suggestions[1]).toEqual(expect.objectContaining({ componentKey: "haul", costItemId: "ci-haul", orgId: "org-1" }));
  });

  it("skips inactive, child-assembly, and foreign-org source items", async () => {
    mockPrisma.assembly.findFirst.mockResolvedValue({ id: "assembly-1", orgId: "org-1", name: "Site excavation" });
    mockPrisma.assemblyItem.findMany.mockResolvedValue([
      { costItem: costItemRow({ id: "ci-inactive", code: "OLD", name: "Inactive", unitOfMeasure: "CY", equipmentId: "eq-1", isActive: false }) },
      { costItem: null },
      { costItem: costItemRow({ id: "ci-foreign", orgId: "org-2", code: "FRN", name: "Foreign", unitOfMeasure: "CY", equipmentId: "eq-2" }) },
      { costItem: costItemRow({ id: "ci-exc", code: "EXC", name: "Excavation crew", unitOfMeasure: "CY", equipmentId: "eq-1" }) },
    ]);

    const result = await service.suggestCatalogMappingReuse({
      orgId: "org-1",
      templateId: "site-excavation",
      sourceAssemblyId: "assembly-1",
    });

    expect(result.mappedCount).toBe(1);
    expect(result.suggestions[0].costItemId).toBe("ci-exc");
    expect(result.suggestions[1]).toEqual(expect.objectContaining({ componentKey: "haul", costItemId: null }));
    expect(JSON.stringify(result)).not.toContain("ci-foreign");
  });

  it("returns every slot unmapped when the source assembly has no usable items", async () => {
    mockPrisma.assembly.findFirst.mockResolvedValue({ id: "assembly-1", orgId: "org-1", name: "Empty assembly" });
    mockPrisma.assemblyItem.findMany.mockResolvedValue([]);

    const result = await service.suggestCatalogMappingReuse({
      orgId: "org-1",
      templateId: "site-excavation",
      sourceAssemblyId: "assembly-1",
    });

    expect(result.mappedCount).toBe(0);
    expect(result.unmappedComponentKeys).toEqual(["excavation", "haul"]);
  });
});
