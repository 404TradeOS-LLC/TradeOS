const supplierFindFirst = jest.fn();
const materialFindMany = jest.fn();
const supplierProductUpsert = jest.fn();
const observationFindUnique = jest.fn();
const observationCreate = jest.fn();

const mockTransaction = {
  supplier: { findFirst: supplierFindFirst },
  material: { findMany: materialFindMany },
  supplierProduct: { upsert: supplierProductUpsert },
  supplierPriceObservation: {
    findUnique: observationFindUnique,
    create: observationCreate,
  },
};

jest.mock("../db/client", () => ({
  basePrisma: {},
  prisma: {
    supplierPriceObservation: { findMany: jest.fn(), groupBy: jest.fn() },
    supplierProduct: { findMany: jest.fn() },
  },
}));

jest.mock("../db/requestSession", () => ({
  runInDatabaseTransaction: jest.fn((_client, operation: (tx: typeof mockTransaction) => unknown) => operation(mockTransaction)),
}));

import { RegionalSupplierEvidenceService } from "../modules/regional-supplier-evidence/service";

const input = {
  orgId: "org-a",
  supplierId: "supplier-a",
  sourceFile: "manual-validation.csv",
  products: [{
    supplierProductKey: "SKU-1",
    name: "2x4x8 SPF Stud",
    canonicalMaterialKey: "LUMBER.SPF.2X4.8FT.STUD",
  }],
  observations: [{
    observationKey: "lowes-0215-2026-10-02-SKU-1",
    supplierProductKey: "SKU-1",
    marketCode: "47802",
    storeName: "Terre Haute #0215",
    postalCode: "47802",
    observedAt: new Date("2026-10-02T12:00:00.000Z"),
    priceStatus: "priced" as const,
    effectivePrice: 4.18,
    normalizedUnitPrice: 4.18,
    normalizedUnit: "EACH",
    sourceConfidence: "high" as const,
  }],
};

describe("RegionalSupplierEvidenceService immutable observation history", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supplierFindFirst.mockResolvedValue({ id: "supplier-a" });
    materialFindMany.mockResolvedValue([]);
    supplierProductUpsert.mockResolvedValue({ id: "product-1" });
  });

  it("auto-links only an unambiguous pilot product during supplier evidence import", async () => {
    observationFindUnique.mockResolvedValue(null);
    observationCreate.mockResolvedValue({ id: "obs-1" });

    await new RegionalSupplierEvidenceService().ingest({
      ...input,
      products: [{
        supplierProductKey: "SKU-1",
        name: "2x4 x 8 ft SPF stud",
      }],
    });

    expect(supplierProductUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        orgId: "org-a",
        supplierProductKey: "SKU-1",
        canonicalMaterialKey: "LUMBER.SPF.2X4.8FT.STUD",
      }),
      update: expect.not.objectContaining({
        canonicalMaterialKey: expect.anything(),
      }),
    }));
  });

  it("creates a new observation and never mutates an existing history row", async () => {
    observationFindUnique.mockResolvedValue(null);
    observationCreate.mockResolvedValue({ id: "obs-1" });

    await new RegionalSupplierEvidenceService().ingest(input);

    expect(observationCreate).toHaveBeenCalledTimes(1);
    expect(observationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: "org-a",
        supplierProductId: "product-1",
        observationKey: "lowes-0215-2026-10-02-SKU-1",
        effectivePrice: 4.18,
      }),
    });
  });

  it("treats an exact replay as idempotent without writing", async () => {
    observationFindUnique.mockResolvedValue({
      id: "obs-1",
      orgId: "org-a",
      supplierProductId: "product-1",
      observationKey: "lowes-0215-2026-10-02-SKU-1",
      marketCode: "47802",
      storeName: "Terre Haute #0215",
      city: null,
      state: null,
      postalCode: "47802",
      observedAt: new Date("2026-10-02T12:00:00.000Z"),
      sourceUrl: null,
      sourceFile: "manual-validation.csv",
      sourceRow: null,
      currency: "USD",
      priceStatus: "priced",
      regularPrice: null,
      salePrice: null,
      rebatePrice: null,
      effectivePrice: 4.18,
      purchaseUnit: null,
      packageQuantity: null,
      normalizedUnitPrice: 4.18,
      normalizedUnit: "EACH",
      eligibilityReason: null,
      sourceConfidence: "high",
    });

    await new RegionalSupplierEvidenceService().ingest(input);
    expect(observationCreate).not.toHaveBeenCalled();
  });

  it("rejects changed evidence under the same observation key", async () => {
    observationFindUnique.mockResolvedValue({
      orgId: "org-a",
      supplierProductId: "product-1",
      observationKey: "lowes-0215-2026-10-02-SKU-1",
      marketCode: "47802",
      storeName: "Terre Haute #0215",
      city: null,
      state: null,
      postalCode: "47802",
      observedAt: new Date("2026-10-02T12:00:00.000Z"),
      sourceUrl: null,
      sourceFile: "manual-validation.csv",
      sourceRow: null,
      currency: "USD",
      priceStatus: "priced",
      regularPrice: null,
      salePrice: null,
      rebatePrice: null,
      effectivePrice: 3.99,
      purchaseUnit: null,
      packageQuantity: null,
      normalizedUnitPrice: 3.99,
      normalizedUnit: "EACH",
      eligibilityReason: null,
      sourceConfidence: "high",
    });

    await expect(new RegionalSupplierEvidenceService().ingest(input)).rejects.toMatchObject({ statusCode: 409 });
    expect(observationCreate).not.toHaveBeenCalled();
  });
});
