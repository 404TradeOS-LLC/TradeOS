const transaction = {
  material: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  materialPriceAudit: {
    create: jest.fn(),
  },
};
const basePrisma = {
  $transaction: jest.fn((operation: (client: typeof transaction) => unknown) => operation(transaction)),
};

jest.mock("../db/client", () => ({
  prisma: {},
  basePrisma,
}));

import { MaterialDatabaseService } from "../modules/material-database/service";

describe("material price auditing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("writes an immutable audit row when unit cost changes", async () => {
    transaction.material.findFirst.mockResolvedValue({
      id: "material-1",
      orgId: "org-1",
      name: "Ready Mix Concrete",
      sku: null,
      unitOfMeasure: "CY",
      unitCost: 150,
      wasteFactorPct: 0,
      supplierId: null,
      lastPriceUpdate: new Date("2026-01-01T00:00:00.000Z"),
    });
    transaction.material.update.mockResolvedValue({
      id: "material-1",
      orgId: "org-1",
      name: "Ready Mix Concrete",
      sku: null,
      unitOfMeasure: "CY",
      unitCost: 165,
      wasteFactorPct: 0,
      supplierId: null,
      lastPriceUpdate: new Date("2026-06-24T00:00:00.000Z"),
    });

    await new MaterialDatabaseService().update(
      "material-1",
      { unitCost: 165 },
      "org-1",
      { actor: { userId: "admin-1", orgId: "org-1", role: "admin" }, source: "manual" }
    );

    expect(transaction.materialPriceAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: "org-1",
        materialId: "material-1",
        materialName: "Ready Mix Concrete",
        oldUnitCost: 150,
        newUnitCost: 165,
        source: "manual",
        actorUserId: "admin-1",
        actorRole: "admin",
      }),
    });
  });

  it("does not create price history for metadata-only changes", async () => {
    transaction.material.findFirst.mockResolvedValue({
      id: "material-1",
      orgId: "org-1",
      name: "Concrete",
      unitCost: 150,
    });
    transaction.material.update.mockResolvedValue({
      id: "material-1",
      orgId: "org-1",
      name: "Concrete 4000 PSI",
      sku: null,
      unitOfMeasure: "CY",
      unitCost: 150,
      wasteFactorPct: 0,
      supplierId: null,
      lastPriceUpdate: null,
    });

    await new MaterialDatabaseService().update(
      "material-1",
      { name: "Concrete 4000 PSI" },
      "org-1",
      { actor: { userId: "admin-1", orgId: "org-1", role: "admin" } }
    );

    expect(transaction.materialPriceAudit.create).not.toHaveBeenCalled();
  });
});
