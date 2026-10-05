const observationFindFirst = jest.fn();
const observationFindMany = jest.fn();

jest.mock("../db/client", () => ({
  basePrisma: {},
  prisma: {
    supplierPriceObservation: {
      findFirst: observationFindFirst,
      findMany: observationFindMany,
      groupBy: jest.fn(),
    },
    supplierProduct: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock("../db/requestSession", () => ({
  runInDatabaseTransaction: jest.fn(),
}));

import { RegionalSupplierEvidenceService } from "../modules/regional-supplier-evidence/service";

describe("RegionalSupplierEvidenceService list paging", () => {
  beforeEach(() => jest.clearAllMocks());

  it("uses an organization-scoped continuation cursor and preserves stored currency", async () => {
    const cursorId = "11111111-1111-4111-8111-111111111111";
    const observedAt = new Date("2026-10-04T12:00:00.000Z");

    observationFindFirst.mockResolvedValue({ id: cursorId, observedAt });
    observationFindMany.mockResolvedValue([{
      id: "22222222-2222-4222-8222-222222222222",
      observationKey: "obs-cad-1",
      marketCode: "47802",
      storeName: "Regional supplier",
      observedAt: new Date("2026-10-03T12:00:00.000Z"),
      currency: "CAD",
      priceStatus: "priced",
      regularPrice: 12.5,
      effectivePrice: 12.5,
      normalizedUnitPrice: 6.25,
      normalizedUnit: "EACH",
      sourceFile: "regional.csv",
      sourceRow: 2,
      supplierProduct: {
        id: "33333333-3333-4333-8333-333333333333",
        supplierProductKey: "SKU-CAD-1",
        name: "Example Canadian-priced material",
        canonicalMaterialKey: null,
        supplierId: "44444444-4444-4444-8444-444444444444",
        supplier: { name: "Regional Supplier" },
      },
    }]);

    const result = await new RegionalSupplierEvidenceService().list("org-a", {
      cursor: cursorId,
      q: "Example",
      limit: 2,
    });

    expect(observationFindFirst).toHaveBeenCalledWith({
      where: { id: cursorId, orgId: "org-a" },
      select: { id: true, observedAt: true },
    });
    expect(observationFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        orgId: "org-a",
        AND: [{
          OR: [
            { observedAt: { lt: observedAt } },
            { observedAt, id: { lt: cursorId } },
          ],
        }],
      }),
      orderBy: [{ observedAt: "desc" }, { id: "desc" }],
      take: 2,
    }));
    expect(result).toEqual([
      expect.objectContaining({
        id: "22222222-2222-4222-8222-222222222222",
        supplierProductId: "33333333-3333-4333-8333-333333333333",
        currency: "CAD",
        normalizedUnitPrice: 6.25,
      }),
    ]);
  });

  it("rejects a cursor that is not visible in the authenticated organization", async () => {
    observationFindFirst.mockResolvedValue(null);

    await expect(new RegionalSupplierEvidenceService().list("org-a", {
      cursor: "11111111-1111-4111-8111-111111111111",
    })).rejects.toMatchObject({ statusCode: 400 });

    expect(observationFindMany).not.toHaveBeenCalled();
  });
});
