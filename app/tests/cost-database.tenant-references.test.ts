const mockPrisma = {
  costItem: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  subcategory: { findFirst: jest.fn() },
  laborRate: { findFirst: jest.fn() },
  material: { findFirst: jest.fn() },
  equipment: { findFirst: jest.fn() },
  subcontractor: { findFirst: jest.fn() },
  region: { findFirst: jest.fn() },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { CostDatabaseService } from "../modules/cost-database/service";

describe("CostDatabaseService cost-item tenant references", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.subcategory.findFirst.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
    mockPrisma.laborRate.findFirst.mockResolvedValue({ id: "22222222-2222-4222-8222-222222222222" });
    mockPrisma.material.findFirst.mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" });
    mockPrisma.equipment.findFirst.mockResolvedValue({ id: "44444444-4444-4444-8444-444444444444" });
    mockPrisma.subcontractor.findFirst.mockResolvedValue({ id: "55555555-5555-4555-8555-555555555555" });
  });

  it("rejects a cost item whose subcategory is outside the authenticated organization", async () => {
    mockPrisma.subcategory.findFirst.mockResolvedValue(null);
    const service = new CostDatabaseService();

    await expect(service.create({
      orgId: "org-1",
      subcategoryId: "11111111-1111-4111-8111-111111111111",
      code: "CI-1",
      name: "Tenant-safe item",
      unitOfMeasure: "EA",
    })).rejects.toMatchObject({ statusCode: 400 });

    expect(mockPrisma.costItem.create).not.toHaveBeenCalled();
  });

  it("rejects a linked catalog record outside the authenticated organization", async () => {
    mockPrisma.material.findFirst.mockResolvedValue(null);
    const service = new CostDatabaseService();

    await expect(service.create({
      orgId: "org-1",
      subcategoryId: "11111111-1111-4111-8111-111111111111",
      materialId: "33333333-3333-4333-8333-333333333333",
      code: "CI-2",
      name: "Material-linked item",
      unitOfMeasure: "EA",
    })).rejects.toMatchObject({ statusCode: 400 });

    expect(mockPrisma.material.findFirst).toHaveBeenCalledWith({
      where: { id: "33333333-3333-4333-8333-333333333333", orgId: "org-1" },
      select: { id: true },
    });
    expect(mockPrisma.costItem.create).not.toHaveBeenCalled();
  });

  it("creates only after all supplied references resolve inside the authenticated organization", async () => {
    mockPrisma.costItem.create.mockResolvedValue({
      id: "66666666-6666-4666-8666-666666666666",
      orgId: "org-1",
      subcategoryId: "11111111-1111-4111-8111-111111111111",
      code: "CI-3",
      name: "Complete item",
      unitOfMeasure: "EA",
      productionRate: null,
      laborRateId: "22222222-2222-4222-8222-222222222222",
      materialId: "33333333-3333-4333-8333-333333333333",
      equipmentId: "44444444-4444-4444-8444-444444444444",
      subcontractorId: "55555555-5555-4555-8555-555555555555",
      isActive: true,
    });
    const service = new CostDatabaseService();

    const result = await service.create({
      orgId: "org-1",
      subcategoryId: "11111111-1111-4111-8111-111111111111",
      laborRateId: "22222222-2222-4222-8222-222222222222",
      materialId: "33333333-3333-4333-8333-333333333333",
      equipmentId: "44444444-4444-4444-8444-444444444444",
      subcontractorId: "55555555-5555-4555-8555-555555555555",
      code: "CI-3",
      name: "Complete item",
      unitOfMeasure: "EA",
    });

    expect(result.id).toBe("66666666-6666-4666-8666-666666666666");
    expect(mockPrisma.costItem.create).toHaveBeenCalledTimes(1);
  });

  it("rejects an update that links a record from another organization", async () => {
    mockPrisma.costItem.findFirst.mockResolvedValue({ id: "cost-item-1", orgId: "org-1" });
    mockPrisma.material.findFirst.mockResolvedValue(null);

    await expect(new CostDatabaseService().update(
      "cost-item-1",
      { materialId: "33333333-3333-4333-8333-333333333333" },
      "org-1"
    )).rejects.toMatchObject({ statusCode: 400 });

    expect(mockPrisma.material.findFirst).toHaveBeenCalledWith({
      where: { id: "33333333-3333-4333-8333-333333333333", orgId: "org-1" },
      select: { id: true },
    });
    expect(mockPrisma.costItem.update).not.toHaveBeenCalled();
  });

  it("allows an update to explicitly clear a nullable catalog reference without a lookup", async () => {
    mockPrisma.costItem.findFirst.mockResolvedValue({ id: "cost-item-1", orgId: "org-1" });
    mockPrisma.costItem.update.mockResolvedValue({
      id: "cost-item-1",
      orgId: "org-1",
      subcategoryId: "11111111-1111-4111-8111-111111111111",
      code: "CI-4",
      name: "Cleared material",
      unitOfMeasure: "EA",
      productionRate: null,
      laborRateId: null,
      materialId: null,
      equipmentId: null,
      subcontractorId: null,
      isActive: true,
    });

    const result = await new CostDatabaseService().update("cost-item-1", { materialId: null }, "org-1");

    expect(mockPrisma.material.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.costItem.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "cost-item-1" },
      data: expect.objectContaining({ materialId: null }),
    }));
    expect(result.materialId).toBeNull();
  });

  it("keeps bulk-import rows pinned to the service-boundary organization", async () => {
    const service = new CostDatabaseService();
    const create = jest.spyOn(service, "create").mockResolvedValue({} as never);

    await service.bulkImport("org-1", [{
      orgId: "org-other",
      subcategoryId: "11111111-1111-4111-8111-111111111111",
      code: "CI-BULK",
      name: "Imported item",
      unitOfMeasure: "EA",
    } as never]);

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ orgId: "org-1", code: "CI-BULK" }));
  });

  it("scopes subcategory cost-item reads to the authenticated organization", async () => {
    mockPrisma.costItem.findMany.mockResolvedValue([]);
    const service = new CostDatabaseService();

    await service.listSubcategoryCostItems("11111111-1111-4111-8111-111111111111", "org-1");

    expect(mockPrisma.costItem.findMany).toHaveBeenCalledWith({
      where: {
        subcategoryId: "11111111-1111-4111-8111-111111111111",
        orgId: "org-1",
      },
      orderBy: { code: "asc" },
    });
  });
});
