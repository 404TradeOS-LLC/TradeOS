const mockDb = {
  supplier: { findFirst: jest.fn() },
  supplierProduct: { findFirst: jest.fn(), count: jest.fn(), updateMany: jest.fn() },
  supplierPriceObservation: { count: jest.fn() },
  material: { count: jest.fn(), create: jest.fn() },
  activityEvent: { create: jest.fn() },
  $executeRaw: jest.fn(),
};
const actor = {
  userId: "22222222-2222-4222-8222-222222222222",
  orgId: "11111111-1111-4111-8111-111111111111",
  role: "owner",
  permissions: ["costbook.manage"],
};
jest.mock("../db/client", () => ({ basePrisma: mockDb, prisma: mockDb }));
jest.mock("../db/requestSession", () => ({
  runWithBackgroundDatabaseSession: jest.fn(async (
    _client: unknown, _input: unknown, action: (actor: typeof actor) => Promise<unknown>,
  ) => action(actor)),
}));

import { main } from "../scripts/activate-abc-supply-material";

const basic = [
  "--org-id=11111111-1111-4111-8111-111111111111",
  "--user-id=22222222-2222-4222-8222-222222222222",
  "--product-key=ABC-100012",
];
const apply = [
  ...basic, "--approved-unit-cost=125.50",
  "--confirm-sku=100012", "--confirm-unit=SQ",
  "--confirmation=ACTIVATE_ONE_ABC_MATERIAL", "--apply",
];

describe("ABC material activation operator workflow", () => {
  let logs: jest.SpyInstance;
  beforeEach(() => {
    jest.resetAllMocks();
    actor.role = "owner";
    actor.permissions = ["costbook.manage"];
    logs = jest.spyOn(console, "log").mockImplementation();
    mockDb.supplier.findFirst.mockResolvedValue({ id: "abc-supplier", name: "ABC Supply" });
    mockDb.supplierProduct.findFirst.mockResolvedValue({
      id: "abc-product", name: "Roofing shingle", sku: "100012",
      purchaseUnit: "SQ", canonicalMaterialKey: "SHINGLE-ARCH",
      isActive: true, materialId: null, sourceFile: "verified-47802-source",
      supplierProductKey: "ABC-100012",
    });
    mockDb.supplierProduct.count.mockResolvedValue(1);
    mockDb.material.count.mockResolvedValue(0);
    mockDb.supplierPriceObservation.count.mockResolvedValue(1);
    mockDb.supplierProduct.updateMany.mockResolvedValue({ count: 1 });
    mockDb.material.create.mockResolvedValue({ id: "new-material" });
    mockDb.activityEvent.create.mockResolvedValue({ id: "audit-event" });
  });
  afterEach(() => { logs.mockRestore(); });

  it("previews the exact product without any material or audit writes", async () => {
    await main(basic);
    expect(mockDb.supplier.findFirst).toHaveBeenCalledWith({
      where: { orgId: actor.orgId, apiIntegrationKey: "ABC_SUPPLY" },
      select: { id: true, name: true },
    });
    expect(mockDb.supplierProduct.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ orgId: actor.orgId, supplierId: "abc-supplier", supplierProductKey: "ABC-100012" }),
    }));
    expect(mockDb.material.create).not.toHaveBeenCalled();
    expect(mockDb.supplierProduct.updateMany).not.toHaveBeenCalled();
    expect(mockDb.activityEvent.create).not.toHaveBeenCalled();
    expect(JSON.parse(logs.mock.calls[0][0])).toMatchObject({
      status: "dry-run", writes: false, liveAbcPricingVerified: false,
    });
  });

  it("activates one manually approved baseline and logs provenance without approving live quotes", async () => {
    await main(apply);
    expect(mockDb.material.create).toHaveBeenCalledTimes(1);
    expect(mockDb.material.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: actor.orgId, supplierId: "abc-supplier", sku: "100012",
        name: "Roofing shingle", unitOfMeasure: "SQ",
        unitCost: "125.50", isActive: true,
      }),
      select: { id: true },
    });
    expect(mockDb.supplierProduct.updateMany).toHaveBeenCalledWith({
      where: { id: "abc-product", orgId: actor.orgId, supplierId: "abc-supplier", materialId: null },
      data: { materialId: "new-material" },
    });
    expect(mockDb.activityEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: actor.orgId, entityType: "material",
        entityId: "new-material", actorUserId: actor.userId,
        metadataJson: expect.objectContaining({
          initialCostSource: "explicit-operator-approved-cost", requiresPriceReview: true,
        }),
      }),
    });
    expect(JSON.parse(logs.mock.calls[0][0])).toMatchObject({
      status: "activated", materialId: "new-material",
      liveAbcPricingVerified: false, pendingPriceApprovalRequired: true,
    });
  });

  it("rejects duplicate SKUs before any write", async () => {
    mockDb.supplierProduct.count.mockResolvedValue(2);
    await expect(main(apply)).rejects.toThrow("ambiguous");
    expect(mockDb.material.create).not.toHaveBeenCalled();
  });

  it("rejects an actor who is not an authorized Costbook manager", async () => {
    actor.permissions = [];
    await expect(main(apply)).rejects.toThrow("Only an active owner/admin");
    expect(mockDb.supplier.findFirst).not.toHaveBeenCalled();
    expect(mockDb.material.create).not.toHaveBeenCalled();
  });

  it("refuses a concurrent link conflict instead of claiming success", async () => {
    mockDb.supplierProduct.updateMany.mockResolvedValue({ count: 0 });
    await expect(main(apply)).rejects.toThrow("rolling back");
    expect(mockDb.activityEvent.create).not.toHaveBeenCalled();
  });
});
