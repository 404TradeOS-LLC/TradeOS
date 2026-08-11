const mockPrisma = {
  costbookWorkspace: {
    findUnique: jest.fn(),
  },
  category: {
    count: jest.fn(),
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
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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
    mockPrisma.equipment.findMany.mockResolvedValue([]);
    mockPrisma.equipment.findFirst.mockResolvedValue(null);
    mockPrisma.equipment.create.mockResolvedValue(equipmentRow());
    mockPrisma.equipment.update.mockResolvedValue(equipmentRow());
    mockPrisma.equipment.delete.mockResolvedValue(equipmentRow());
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
    expect(mockPrisma.category.count).toHaveBeenCalledWith({ where: { division: { orgId: "org-tenant-a" } } });
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

  it("lists equipment through the authenticated organization scope", async () => {
    mockPrisma.equipment.findMany.mockResolvedValue([
      equipmentRow({ id: "equipment-1", orgId: "org-tenant-a", name: "Scissor Lift", ownershipCostPerHour: 28.5, operatingCostPerHour: 11.25, dailyRate: 325 }),
    ]);

    const rows = await new CostbookService().listEquipment({
      userId: "user-1",
      orgId: "org-tenant-a",
      role: "technician",
    });

    expect(mockPrisma.equipment.findMany).toHaveBeenCalledWith({
      where: { orgId: "org-tenant-a" },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    });
    expect(rows).toEqual([
      expect.objectContaining({
        id: "equipment-1",
        organizationId: "org-tenant-a",
        name: "Scissor Lift",
        ownershipCostPerHour: 28.5,
        operatingCostPerHour: 11.25,
        dailyRate: 325,
        hourlyCost: 39.75,
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

  it("creates equipment only inside the authenticated organization", async () => {
    await new CostbookService().createEquipment(
      { userId: "admin-1", orgId: "org-tenant-a", role: "admin" },
      { name: "Scissor Lift", ownershipCostPerHour: 28.5, operatingCostPerHour: 11.25, dailyRate: 325 }
    );

    expect(mockPrisma.equipment.create).toHaveBeenCalledWith({
      data: {
        orgId: "org-tenant-a",
        name: "Scissor Lift",
        ownershipCostPerHour: 28.5,
        operatingCostPerHour: 11.25,
        dailyRate: 325,
      },
    });
  });

  it("updates equipment by id and org", async () => {
    mockPrisma.equipment.findFirst.mockResolvedValue(equipmentRow({ id: "equipment-1", orgId: "org-tenant-a" }));
    mockPrisma.equipment.update.mockResolvedValue(equipmentRow({ id: "equipment-1", orgId: "org-tenant-a", dailyRate: 350 }));

    await new CostbookService().updateEquipment(
      { userId: "admin-1", orgId: "org-tenant-a", role: "admin" },
      "equipment-1",
      { dailyRate: 350 }
    );

    expect(mockPrisma.equipment.findFirst).toHaveBeenCalledWith({ where: { id: "equipment-1", orgId: "org-tenant-a" } });
    expect(mockPrisma.equipment.update).toHaveBeenCalledWith({
      where: { id: "equipment-1" },
      data: expect.objectContaining({ dailyRate: 350 }),
    });
  });

  it("clears equipment dailyRate when the update input explicitly sets null", async () => {
    mockPrisma.equipment.findFirst.mockResolvedValue(equipmentRow({ id: "equipment-1", orgId: "org-tenant-a", dailyRate: 325 }));
    mockPrisma.equipment.update.mockResolvedValue(equipmentRow({ id: "equipment-1", orgId: "org-tenant-a", dailyRate: null }));

    await new CostbookService().updateEquipment(
      { userId: "admin-1", orgId: "org-tenant-a", role: "admin" },
      "equipment-1",
      { dailyRate: null }
    );

    expect(mockPrisma.equipment.update).toHaveBeenCalledWith({
      where: { id: "equipment-1" },
      data: expect.objectContaining({ dailyRate: null }),
    });
  });

  it("returns not found instead of updating cross-organization equipment", async () => {
    mockPrisma.equipment.findFirst.mockResolvedValue(null);

    await expect(
      new CostbookService().updateEquipment(
        { userId: "admin-1", orgId: "org-tenant-a", role: "admin" },
        "equipment-from-org-b",
        { name: "Cross Org Lift" }
      )
    ).rejects.toThrow("Equipment equipment-from-org-b not found");

    expect(mockPrisma.equipment.update).not.toHaveBeenCalled();
  });

  it("deletes equipment only inside the authenticated organization", async () => {
    mockPrisma.equipment.findFirst.mockResolvedValue(equipmentRow({ id: "equipment-1", orgId: "org-tenant-a" }));

    await new CostbookService().removeEquipment(
      { userId: "admin-1", orgId: "org-tenant-a", role: "admin" },
      "equipment-1"
    );

    expect(mockPrisma.equipment.delete).toHaveBeenCalledWith({
      where: { id: "equipment-1" },
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

function equipmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "equipment-1",
    orgId: "org-tenant-a",
    name: "Scissor Lift",
    ownershipCostPerHour: 28.5,
    operatingCostPerHour: 11.25,
    dailyRate: 325,
    createdAt: new Date("2026-08-10T00:00:00.000Z"),
    updatedAt: new Date("2026-08-11T00:00:00.000Z"),
    ...overrides,
  };
}
