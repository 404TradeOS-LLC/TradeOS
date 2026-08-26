const mockPrisma = {
  supplier: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { SupplierDatabaseService } from "../modules/supplier-database/service";

describe("SupplierDatabaseService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const row = {
    id: "supplier-1",
    orgId: "org-1",
    name: "Acme Building Supply",
    contactEmail: "sales@acme.example",
    contactPhone: "555-0100",
    website: "https://acme.example",
    apiIntegrationKey: "secret-key-value",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  it("never returns the raw API integration key, only whether one is set", async () => {
    mockPrisma.supplier.findFirst.mockResolvedValue(row);

    const result = await new SupplierDatabaseService().getById("supplier-1", "org-1");

    expect(result.hasApiIntegrationKey).toBe(true);
    expect(result).not.toHaveProperty("apiIntegrationKey");
  });

  it("reports no API integration key when none is stored", async () => {
    mockPrisma.supplier.findFirst.mockResolvedValue({ ...row, apiIntegrationKey: null });

    const result = await new SupplierDatabaseService().getById("supplier-1", "org-1");

    expect(result.hasApiIntegrationKey).toBe(false);
  });

  it("creates a supplier scoped to the organization", async () => {
    mockPrisma.supplier.create.mockResolvedValue(row);

    await new SupplierDatabaseService().create({ orgId: "org-1", name: "Acme Building Supply" });

    expect(mockPrisma.supplier.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ orgId: "org-1", name: "Acme Building Supply" }),
    });
  });

  it("throws a 404 when updating a supplier outside the organization", async () => {
    mockPrisma.supplier.findFirst.mockResolvedValue(null);

    await expect(
      new SupplierDatabaseService().update("supplier-other-org", { name: "Renamed" }, "org-1")
    ).rejects.toThrow("not found");
    expect(mockPrisma.supplier.update).not.toHaveBeenCalled();
  });

  it("throws a 404 when deleting a supplier outside the organization", async () => {
    mockPrisma.supplier.findFirst.mockResolvedValue(null);

    await expect(new SupplierDatabaseService().delete("supplier-other-org", "org-1")).rejects.toThrow("not found");
    expect(mockPrisma.supplier.delete).not.toHaveBeenCalled();
  });
});
