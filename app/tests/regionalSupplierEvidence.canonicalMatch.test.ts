const productFindFirst = jest.fn();
const productUpdateMany = jest.fn();
const activityCreate = jest.fn();
const materialUpdate = jest.fn();
const mockTransaction = {
  supplierProduct: {
    findFirst: productFindFirst,
    updateMany: productUpdateMany,
  },
  material: { update: materialUpdate },
  activityEvent: { create: activityCreate },
};

jest.mock("../db/client", () => ({
  basePrisma: {},
  prisma: {
    supplierProduct: {
      findFirst: productFindFirst,
      updateMany: productUpdateMany,
      findMany: jest.fn(),
    },
    supplierPriceObservation: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));
jest.mock("../db/requestSession", () => ({
  runInDatabaseTransaction: jest.fn((_client, operation: (tx: typeof mockTransaction) => unknown) => operation(mockTransaction)),
}));

import { RegionalSupplierEvidenceService, prepareRegionalSupplierEvidence } from "../modules/regional-supplier-evidence/service";

describe("Regional supplier canonical match review", () => {
  beforeEach(() => jest.clearAllMocks());

  it("previews a deterministic pilot match without mutating the product", async () => {
    productFindFirst.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      name: "2x4 x 8 ft SPF stud",
      description: null,
      packageDescription: null,
      purchaseUnit: "EA",
      canonicalMaterialKey: null,
      sku: "STUD-248",
      manufacturerPartNumber: null,
    });

    const result = await new RegionalSupplierEvidenceService().previewCanonicalMatch(
      "org-a",
      "11111111-1111-4111-8111-111111111111"
    );

    expect(productFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "11111111-1111-4111-8111-111111111111", orgId: "org-a" },
    }));
    expect(productUpdateMany).not.toHaveBeenCalled();
    expect(result.match).toMatchObject({
      action: "AUTO_LINK",
      canonicalMaterialKey: "LUMBER.SPF.2X4.8FT.STUD",
    });
  });

  it("reads persisted supplier codes and rejects a conflicting commodity classification", async () => {
    productFindFirst.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      name: "architectural shingles bundle",
      description: null,
      packageDescription: null,
      purchaseUnit: "BUNDLE",
      canonicalMaterialKey: null,
      sku: "SHINGLE-001",
      manufacturerPartNumber: null,
      omniclass23: null,
      unspsc: "30151703",
    });

    const result = await new RegionalSupplierEvidenceService().previewCanonicalMatch(
      "org-a", "11111111-1111-4111-8111-111111111111"
    );
    expect(productFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({ unspsc: true, omniclass23: true }),
    }));
    expect(result.match.action).toBe("HUMAN_REVIEW");
    expect(result.match.rationale).toContain("never silently merged");
  });

  it("validates supplier classification even for imports not originating in the HTTP controller", () => {
    expect(() => prepareRegionalSupplierEvidence({
      orgId: "org-a",
      supplierId: "supplier-a",
      products: [{ supplierProductKey: "key-1", name: "Shingle", unspsc: "123" }],
      observations: [],
    })).toThrow("expected an 8-digit commodity code");
  });

  it("requires an explicit reviewed pilot key and scopes the write to the tenant", async () => {
    productFindFirst.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      name: "2x4 x 8 ft SPF stud",
      description: null,
      packageDescription: null,
      purchaseUnit: "EA",
      canonicalMaterialKey: null,
      sku: "STUD-248",
      manufacturerPartNumber: null,
    });
    productUpdateMany.mockResolvedValue({ count: 1 });

    const result = await new RegionalSupplierEvidenceService().reviewCanonicalMatch(
      "org-a",
      "user-a",
      "11111111-1111-4111-8111-111111111111",
      "LUMBER.SPF.2X4.8FT.STUD"
    );

    expect(productUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "11111111-1111-4111-8111-111111111111",
        orgId: "org-a",
        name: "2x4 x 8 ft SPF stud",
        description: null,
        packageDescription: null,
        purchaseUnit: "EA",
        canonicalMaterialKey: null,
        sku: "STUD-248",
        manufacturerPartNumber: null,
      },
      data: { canonicalMaterialKey: "LUMBER.SPF.2X4.8FT.STUD" },
    });
    expect(result).toMatchObject({
      canonicalMaterialKey: "LUMBER.SPF.2X4.8FT.STUD",
      reviewedByUserId: "user-a",
      reviewed: true,
    });
    expect(activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: "org-a",
        entityType: "supplier_product",
        entityId: "11111111-1111-4111-8111-111111111111",
        eventType: "costbook.supplier_product.canonical_match_reviewed",
        actorUserId: "user-a",
      }),
    });
    expect(materialUpdate).not.toHaveBeenCalled();
  });

  it("rejects a governed key that is not the fresh matcher suggestion", async () => {
    productFindFirst.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      name: "1/2 in drywall 4x8 sheet",
      description: "regular gypsum wallboard",
      packageDescription: null,
      purchaseUnit: "SHEET",
      canonicalMaterialKey: null,
      sku: "DRY-12-48",
      manufacturerPartNumber: null,
    });

    await expect(new RegionalSupplierEvidenceService().reviewCanonicalMatch(
      "org-a",
      "user-a",
      "11111111-1111-4111-8111-111111111111",
      "LUMBER.SPF.2X4.8FT.STUD"
    )).rejects.toMatchObject({ statusCode: 422 });

    expect(productUpdateMany).not.toHaveBeenCalled();
    expect(materialUpdate).not.toHaveBeenCalled();
    expect(activityCreate).not.toHaveBeenCalled();
  });

  it("prevents changing an already-linked product to a different canonical key", async () => {
    productFindFirst.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      name: "2x4 x 8 ft SPF stud",
      description: null,
      packageDescription: null,
      purchaseUnit: "EA",
      canonicalMaterialKey: "LUMBER.SPF.2X4.8FT.STUD",
      sku: "STUD-248",
      manufacturerPartNumber: null,
    });

    await expect(new RegionalSupplierEvidenceService().reviewCanonicalMatch(
      "org-a",
      "user-a",
      "11111111-1111-4111-8111-111111111111",
      "DRYWALL.REG.0_5IN.4X8.SHEET"
    )).rejects.toMatchObject({ statusCode: 409 });

    expect(productUpdateMany).not.toHaveBeenCalled();
    expect(materialUpdate).not.toHaveBeenCalled();
    expect(activityCreate).not.toHaveBeenCalled();
  });

  it("fails closed when another reviewer changes the canonical key first", async () => {
    productFindFirst.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      name: "2x4 x 8 ft SPF stud",
      description: null,
      packageDescription: null,
      purchaseUnit: "EA",
      canonicalMaterialKey: null,
      sku: "STUD-248",
      manufacturerPartNumber: null,
    });
    productUpdateMany.mockResolvedValue({ count: 0 });

    await expect(new RegionalSupplierEvidenceService().reviewCanonicalMatch(
      "org-a",
      "user-a",
      "11111111-1111-4111-8111-111111111111",
      "LUMBER.SPF.2X4.8FT.STUD"
    )).rejects.toMatchObject({ statusCode: 409 });

    expect(productUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "11111111-1111-4111-8111-111111111111",
        orgId: "org-a",
        name: "2x4 x 8 ft SPF stud",
        description: null,
        packageDescription: null,
        purchaseUnit: "EA",
        canonicalMaterialKey: null,
        sku: "STUD-248",
        manufacturerPartNumber: null,
      },
      data: { canonicalMaterialKey: "LUMBER.SPF.2X4.8FT.STUD" },
    });
    expect(activityCreate).not.toHaveBeenCalled();
  });

  it("rejects arbitrary caller-supplied canonical keys", async () => {
    await expect(new RegionalSupplierEvidenceService().reviewCanonicalMatch(
      "org-a",
      "user-a",
      "11111111-1111-4111-8111-111111111111",
      "NOT.A.GOVERNED.KEY"
    )).rejects.toMatchObject({ statusCode: 422 });
    expect(productFindFirst).not.toHaveBeenCalled();
    expect(productUpdateMany).not.toHaveBeenCalled();
  });
});
