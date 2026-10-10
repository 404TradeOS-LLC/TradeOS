import {
  buildMaterialRow,
  shouldFillUnitCost,
} from "../scripts/backfill-abc-materials";

describe("backfill-abc-materials mapping", () => {
  const product = {
    id: "prod-1",
    sku: "  02BPEV4SC ",
    name: "Owens Corning Duration Shingle",
    purchaseUnit: "BNDL",
    manufacturerPartNumber: "TD01",
    materialId: null,
  };

  it("trims the SKU and maps purchase unit to unit of measure", () => {
    const row = buildMaterialRow(product, 44.47);
    expect(row).toEqual({
      name: "Owens Corning Duration Shingle",
      unitOfMeasure: "BNDL",
      unitCost: 44.47,
      sku: "02BPEV4SC",
    });
  });

  it("defaults unit of measure to EA and cost to 0 without observations", () => {
    const row = buildMaterialRow({ ...product, purchaseUnit: null }, null);
    expect(row.unitOfMeasure).toBe("EA");
    expect(row.unitCost).toBe(0);
  });

  it("treats blank purchase units as EA", () => {
    const row = buildMaterialRow({ ...product, purchaseUnit: "   " }, 10);
    expect(row.unitOfMeasure).toBe("EA");
  });
});

describe("shouldFillUnitCost", () => {
  it("fills when the existing material has no price", () => {
    expect(shouldFillUnitCost(0)).toBe(true);
    expect(shouldFillUnitCost("0")).toBe(true);
    expect(shouldFillUnitCost(null)).toBe(true);
    expect(shouldFillUnitCost(undefined)).toBe(true);
  });

  it("never clobbers human-set pricing", () => {
    expect(shouldFillUnitCost(44.47)).toBe(false);
    expect(shouldFillUnitCost("44.47")).toBe(false);
  });
});
