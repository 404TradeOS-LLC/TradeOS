const mockPrisma = {
  costbookWorkspace: {
    findUnique: jest.fn(),
  },
  division: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  category: {
    count: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  subcategory: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  costItem: {
    count: jest.fn(),
  },
  laborRate: {
    count: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  material: {
    count: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  materialPriceAudit: {
    create: jest.fn(),
  },
  supplier: {
    findFirst: jest.fn(),
  },
  equipment: {
    count: jest.fn(),
  },
  assembly: {
    count: jest.fn(),
  },
};

const basePrisma = {
  $transaction: jest.fn((operation: (client: typeof mockPrisma) => unknown) => operation(mockPrisma)),
};

jest.mock("../db/client", () => ({ prisma: mockPrisma, basePrisma }));

import { CostbookService } from "../modules/costbook";

describe("CostbookService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.costbookWorkspace.findUnique.mockResolvedValue(null);
    mockPrisma.division.findMany.mockResolvedValue([]);
    mockPrisma.division.findFirst.mockResolvedValue(null);
    mockPrisma.division.create.mockResolvedValue(divisionRow());
    mockPrisma.division.update.mockResolvedValue(divisionRow());
    mockPrisma.category.findMany.mockResolvedValue([]);
    mockPrisma.category.findFirst.mockResolvedValue(null);
    mockPrisma.category.create.mockResolvedValue(categoryRow());
    mockPrisma.category.update.mockResolvedValue(categoryRow());
    mockPrisma.subcategory.findMany.mockResolvedValue([]);
    mockPrisma.subcategory.findFirst.mockResolvedValue(null);
    mockPrisma.subcategory.create.mockResolvedValue(subcategoryRow());
    mockPrisma.subcategory.update.mockResolvedValue(subcategoryRow());
    mockPrisma.category.count.mockResolvedValue(6);
    mockPrisma.costItem.count.mockResolvedValue(8);
    mockPrisma.laborRate.count.mockResolvedValue(3);
    mockPrisma.laborRate.findMany.mockResolvedValue([]);
    mockPrisma.laborRate.findFirst.mockResolvedValue(null);
    mockPrisma.laborRate.create.mockResolvedValue(laborRateRow());
    mockPrisma.laborRate.update.mockResolvedValue(laborRateRow());
    mockPrisma.material.count.mockResolvedValue(5);
    mockPrisma.material.findMany.mockResolvedValue([]);
    mockPrisma.material.findFirst.mockResolvedValue(null);
    mockPrisma.material.create.mockResolvedValue(materialRow());
    mockPrisma.material.update.mockResolvedValue(materialRow());
    mockPrisma.supplier.findFirst.mockResolvedValue({ id: "supplier-1" });
    mockPrisma.equipment.count.mockResolvedValue(1);
    mockPrisma.assembly.count.mockResolvedValue(4);
    mockPrisma.materialPriceAudit.create.mockResolvedValue({});
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
        categories: 6,
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
    expect(mockPrisma.category.count).toHaveBeenCalledWith({ where: { division: { orgId: "org-tenant-a" }, isActive: true } });
    expect(mockPrisma.costItem.count).toHaveBeenCalledWith({ where: { orgId: "org-tenant-a", isActive: true } });
    expect(mockPrisma.laborRate.count).toHaveBeenCalledWith({ where: { orgId: "org-tenant-a", active: true } });
    expect(mockPrisma.material.count).toHaveBeenCalledWith({ where: { orgId: "org-tenant-a" } });
    expect(mockPrisma.equipment.count).toHaveBeenCalledWith({ where: { orgId: "org-tenant-a" } });
    expect(mockPrisma.assembly.count).toHaveBeenCalledWith({ where: { orgId: "org-tenant-a", isActive: true } });
  });

  it("lists materials through the authenticated organization scope", async () => {
    mockPrisma.material.findMany.mockResolvedValue([
      materialRow({ id: "material-1", orgId: "org-tenant-a", name: "Ready Mix Concrete", supplier: { id: "supplier-1", name: "Acme Supply" } }),
    ]);

    const rows = await new CostbookService().listMaterials({
      userId: "user-1",
      orgId: "org-tenant-a",
      role: "dispatcher",
    });

    expect(mockPrisma.material.findMany).toHaveBeenCalledWith({
      where: { orgId: "org-tenant-a" },
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: [{ name: "asc" }, { sku: "asc" }],
    });
    expect(rows).toEqual([
      expect.objectContaining({
        id: "material-1",
        organizationId: "org-tenant-a",
        name: "Ready Mix Concrete",
        supplierName: "Acme Supply",
      }),
    ]);
  });

  it("lists labor rates through the authenticated organization scope", async () => {
    mockPrisma.laborRate.findMany.mockResolvedValue([
      laborRateRow({ id: "labor-rate-1", orgId: "org-tenant-a", role: "Lead Carpenter", hourlyCost: 42.5, billRate: 85 }),
    ]);

    const rows = await new CostbookService().listLaborRates({
      userId: "user-1",
      orgId: "org-tenant-a",
      role: "technician",
    });

    expect(mockPrisma.laborRate.findMany).toHaveBeenCalledWith({
      where: { orgId: "org-tenant-a" },
      orderBy: [{ active: "desc" }, { role: "asc" }, { createdAt: "asc" }],
    });
    expect(rows).toEqual([
      expect.objectContaining({
        id: "labor-rate-1",
        organizationId: "org-tenant-a",
        role: "Lead Carpenter",
        hourlyCost: 42.5,
        billRate: 85,
      }),
    ]);
  });

  it("creates a labor rate only inside the authenticated organization", async () => {
    await new CostbookService().createLaborRate(
      { userId: "admin-1", orgId: "org-tenant-a", role: "admin" },
      { role: "Lead Carpenter", description: "Finish trim labor", hourlyCost: 42.5, billRate: 85 }
    );

    expect(mockPrisma.laborRate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: "org-tenant-a",
        role: "Lead Carpenter",
        description: "Finish trim labor",
        hourlyCost: 42.5,
        billRate: 85,
        active: true,
        trade: "Lead Carpenter",
        baseHourlyRate: 42.5,
        burdenPct: 0,
      }),
    });
  });

  it("updates a labor rate by id and org", async () => {
    mockPrisma.laborRate.findFirst.mockResolvedValue(laborRateRow({ id: "labor-rate-1", orgId: "org-tenant-a" }));
    mockPrisma.laborRate.update.mockResolvedValue(laborRateRow({ id: "labor-rate-1", orgId: "org-tenant-a", billRate: 92 }));

    await new CostbookService().updateLaborRate(
      { userId: "admin-1", orgId: "org-tenant-a", role: "admin" },
      "labor-rate-1",
      { billRate: 92 }
    );

    expect(mockPrisma.laborRate.findFirst).toHaveBeenCalledWith({ where: { id: "labor-rate-1", orgId: "org-tenant-a" } });
    expect(mockPrisma.laborRate.update).toHaveBeenCalledWith({
      where: { id: "labor-rate-1" },
      data: expect.objectContaining({ billRate: 92, trade: "Lead Carpenter", baseHourlyRate: 42.5 }),
    });
  });

  it("returns not found instead of updating a cross-organization labor rate", async () => {
    mockPrisma.laborRate.findFirst.mockResolvedValue(null);

    await expect(
      new CostbookService().updateLaborRate(
        { userId: "admin-1", orgId: "org-tenant-a", role: "admin" },
        "labor-rate-from-org-b",
        { role: "Cross Org" }
      )
    ).rejects.toThrow("Labor rate labor-rate-from-org-b not found");

    expect(mockPrisma.laborRate.update).not.toHaveBeenCalled();
  });

  it("deactivates a labor rate only inside the authenticated organization", async () => {
    mockPrisma.laborRate.findFirst.mockResolvedValue(laborRateRow({ id: "labor-rate-1", orgId: "org-tenant-a" }));

    await new CostbookService().deactivateLaborRate(
      { userId: "admin-1", orgId: "org-tenant-a", role: "admin" },
      "labor-rate-1"
    );

    expect(mockPrisma.laborRate.update).toHaveBeenCalledWith({
      where: { id: "labor-rate-1" },
      data: { active: false },
    });
  });

  it("creates a material only inside the authenticated organization", async () => {
    await new CostbookService().createMaterial(
      { userId: "admin-1", orgId: "org-tenant-a", role: "admin" },
      { sku: "CONC-4000", name: "Concrete", unitOfMeasure: "CY", unitCost: 150, wasteFactorPct: 5, supplierId: "supplier-1" }
    );

    expect(mockPrisma.supplier.findFirst).toHaveBeenCalledWith({
      where: { id: "supplier-1", orgId: "org-tenant-a" },
      select: { id: true },
    });
    expect(mockPrisma.material.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: "org-tenant-a",
        sku: "CONC-4000",
        name: "Concrete",
        unitOfMeasure: "CY",
        unitCost: 150,
        wasteFactorPct: 5,
        supplierId: "supplier-1",
      }),
      include: { supplier: { select: { id: true, name: true } } },
    });
  });

  it("rejects a supplier from another organization before creating a material", async () => {
    mockPrisma.supplier.findFirst.mockResolvedValue(null);

    await expect(
      new CostbookService().createMaterial(
        { userId: "admin-1", orgId: "org-tenant-a", role: "admin" },
        { name: "Concrete", unitOfMeasure: "CY", unitCost: 150, supplierId: "supplier-from-org-b" }
      )
    ).rejects.toThrow("Supplier must belong to the authenticated organization");

    expect(mockPrisma.material.create).not.toHaveBeenCalled();
  });

  it("updates a material by id and org and audits unit-cost changes", async () => {
    mockPrisma.material.findFirst.mockResolvedValue(materialRow({ id: "material-1", orgId: "org-tenant-a", unitCost: 150 }));
    mockPrisma.material.update.mockResolvedValue(materialRow({ id: "material-1", orgId: "org-tenant-a", unitCost: 165 }));

    await new CostbookService().updateMaterial(
      { userId: "admin-1", orgId: "org-tenant-a", role: "admin" },
      "material-1",
      { unitCost: 165 }
    );

    expect(mockPrisma.material.findFirst).toHaveBeenCalledWith({ where: { id: "material-1", orgId: "org-tenant-a" } });
    expect(mockPrisma.material.update).toHaveBeenCalledWith({
      where: { id: "material-1" },
      data: expect.objectContaining({ unitCost: 165 }),
      include: { supplier: { select: { id: true, name: true } } },
    });
    expect(mockPrisma.materialPriceAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: "org-tenant-a",
        materialId: "material-1",
        oldUnitCost: 150,
        newUnitCost: 165,
        source: "costbook.materials",
        actorUserId: "admin-1",
        actorRole: "admin",
      }),
    });
  });

  it("returns not found instead of updating a cross-organization material", async () => {
    mockPrisma.material.findFirst.mockResolvedValue(null);

    await expect(
      new CostbookService().updateMaterial(
        { userId: "admin-1", orgId: "org-tenant-a", role: "admin" },
        "material-from-org-b",
        { name: "Cross Org" }
      )
    ).rejects.toThrow("Material material-from-org-b not found");

    expect(mockPrisma.material.update).not.toHaveBeenCalled();
  });

  it("creates a division only inside the authenticated organization", async () => {
    await new CostbookService().createDivision(
      { userId: "admin-1", orgId: "org-tenant-a", role: "admin" },
      { code: "ELEC", name: "Electrical", sortOrder: 1 }
    );

    expect(mockPrisma.division.create).toHaveBeenCalledWith({
      data: { orgId: "org-tenant-a", code: "ELEC", name: "Electrical", sortOrder: 1 },
    });
  });

  it("updates a division by id and org", async () => {
    mockPrisma.division.findFirst.mockResolvedValue(divisionRow({ id: "division-1", orgId: "org-tenant-a" }));

    await new CostbookService().updateDivision(
      { userId: "admin-1", orgId: "org-tenant-a", role: "admin" },
      "division-1",
      { name: "Electrical Systems" }
    );

    expect(mockPrisma.division.findFirst).toHaveBeenCalledWith({ where: { id: "division-1", orgId: "org-tenant-a" } });
    expect(mockPrisma.division.update).toHaveBeenCalledWith({
      where: { id: "division-1" },
      data: { code: undefined, name: "Electrical Systems", sortOrder: undefined, isActive: undefined },
    });
  });

  it("returns not found instead of updating a cross-organization division", async () => {
    mockPrisma.division.findFirst.mockResolvedValue(null);

    await expect(
      new CostbookService().updateDivision(
        { userId: "admin-1", orgId: "org-tenant-a", role: "admin" },
        "division-from-org-b",
        { name: "Cross Org" }
      )
    ).rejects.toThrow("Division division-from-org-b not found");

    expect(mockPrisma.division.update).not.toHaveBeenCalled();
  });

  it("deactivates a division only inside the authenticated organization", async () => {
    mockPrisma.division.findFirst.mockResolvedValue(divisionRow({ id: "division-1", orgId: "org-tenant-a" }));

    await new CostbookService().deactivateDivision(
      { userId: "admin-1", orgId: "org-tenant-a", role: "admin" },
      "division-1"
    );

    expect(mockPrisma.division.update).toHaveBeenCalledWith({
      where: { id: "division-1" },
      data: { isActive: false },
    });
  });

  it("creates a category only when the division belongs to the authenticated organization", async () => {
    mockPrisma.division.findFirst.mockResolvedValue({ id: "division-1" });

    await new CostbookService().createCategory(
      { userId: "admin-1", orgId: "org-tenant-a", role: "admin" },
      { divisionId: "division-1", code: "WIRE", name: "Wiring", sortOrder: 2 }
    );

    expect(mockPrisma.division.findFirst).toHaveBeenCalledWith({
      where: { id: "division-1", orgId: "org-tenant-a" },
      select: { id: true },
    });
    expect(mockPrisma.category.create).toHaveBeenCalledWith({
      data: { divisionId: "division-1", code: "WIRE", name: "Wiring", sortOrder: 2 },
      include: { division: { select: { orgId: true } } },
    });
  });

  it("rejects a division from another organization before creating a category", async () => {
    mockPrisma.division.findFirst.mockResolvedValue(null);

    await expect(
      new CostbookService().createCategory(
        { userId: "admin-1", orgId: "org-tenant-a", role: "admin" },
        { divisionId: "division-from-org-b", code: "WIRE", name: "Wiring" }
      )
    ).rejects.toThrow("Division must belong to the authenticated organization");

    expect(mockPrisma.category.create).not.toHaveBeenCalled();
  });

  it("returns not found instead of updating a cross-organization category", async () => {
    mockPrisma.category.findFirst.mockResolvedValue(null);

    await expect(
      new CostbookService().updateCategory(
        { userId: "admin-1", orgId: "org-tenant-a", role: "admin" },
        "category-from-org-b",
        { name: "Cross Org" }
      )
    ).rejects.toThrow("Category category-from-org-b not found");

    expect(mockPrisma.category.update).not.toHaveBeenCalled();
  });

  it("creates a subcategory only when the category belongs to the authenticated organization", async () => {
    mockPrisma.category.findFirst.mockResolvedValue({ id: "category-1" });

    await new CostbookService().createSubcategory(
      { userId: "admin-1", orgId: "org-tenant-a", role: "admin" },
      { categoryId: "category-1", code: "ROMEX", name: "Romex" }
    );

    expect(mockPrisma.category.findFirst).toHaveBeenCalledWith({
      where: { id: "category-1", division: { orgId: "org-tenant-a" } },
      select: { id: true },
    });
    expect(mockPrisma.subcategory.create).toHaveBeenCalledWith({
      data: { categoryId: "category-1", code: "ROMEX", name: "Romex", sortOrder: 0 },
      include: { category: { include: { division: { select: { orgId: true } } } } },
    });
  });

  it("rejects a category from another organization before creating a subcategory", async () => {
    mockPrisma.category.findFirst.mockResolvedValue(null);

    await expect(
      new CostbookService().createSubcategory(
        { userId: "admin-1", orgId: "org-tenant-a", role: "admin" },
        { categoryId: "category-from-org-b", code: "ROMEX", name: "Romex" }
      )
    ).rejects.toThrow("Category must belong to the authenticated organization");

    expect(mockPrisma.subcategory.create).not.toHaveBeenCalled();
  });

  it("returns not found instead of updating a cross-organization subcategory", async () => {
    mockPrisma.subcategory.findFirst.mockResolvedValue(null);

    await expect(
      new CostbookService().updateSubcategory(
        { userId: "admin-1", orgId: "org-tenant-a", role: "admin" },
        "subcategory-from-org-b",
        { name: "Cross Org" }
      )
    ).rejects.toThrow("Subcategory subcategory-from-org-b not found");

    expect(mockPrisma.subcategory.update).not.toHaveBeenCalled();
  });

  it("deactivates a subcategory only inside the authenticated organization", async () => {
    mockPrisma.subcategory.findFirst.mockResolvedValue(subcategoryRow({ id: "subcategory-1" }));

    await new CostbookService().deactivateSubcategory(
      { userId: "admin-1", orgId: "org-tenant-a", role: "admin" },
      "subcategory-1"
    );

    expect(mockPrisma.subcategory.update).toHaveBeenCalledWith({
      where: { id: "subcategory-1" },
      data: { isActive: false },
    });
  });
});

function materialRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "material-1",
    orgId: "org-tenant-a",
    sku: null,
    name: "Concrete",
    unitOfMeasure: "CY",
    unitCost: 150,
    wasteFactorPct: 0,
    supplierId: null,
    supplier: null,
    lastPriceUpdate: new Date("2026-08-11T00:00:00.000Z"),
    createdAt: new Date("2026-08-10T00:00:00.000Z"),
    updatedAt: new Date("2026-08-11T00:00:00.000Z"),
    ...overrides,
  };
}

function laborRateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "labor-rate-1",
    orgId: "org-tenant-a",
    role: "Lead Carpenter",
    description: "Finish trim labor",
    hourlyCost: 42.5,
    billRate: 85,
    active: true,
    trade: "Lead Carpenter",
    baseHourlyRate: 42.5,
    burdenPct: 0,
    createdAt: new Date("2026-08-10T00:00:00.000Z"),
    updatedAt: new Date("2026-08-11T00:00:00.000Z"),
    ...overrides,
  };
}

function divisionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "division-1",
    orgId: "org-tenant-a",
    code: "ELEC",
    name: "Electrical",
    sortOrder: 0,
    isActive: true,
    createdAt: new Date("2026-08-10T00:00:00.000Z"),
    ...overrides,
  };
}

function categoryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "category-1",
    divisionId: "division-1",
    code: "WIRE",
    name: "Wiring",
    sortOrder: 0,
    isActive: true,
    createdAt: new Date("2026-08-10T00:00:00.000Z"),
    division: { orgId: "org-tenant-a" },
    ...overrides,
  };
}

function subcategoryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "subcategory-1",
    categoryId: "category-1",
    code: "ROMEX",
    name: "Romex",
    sortOrder: 0,
    isActive: true,
    createdAt: new Date("2026-08-10T00:00:00.000Z"),
    category: { division: { orgId: "org-tenant-a" } },
    ...overrides,
  };
}
