import {
  COSTBOOK_PILOT_CANONICAL_ITEMS,
  matchPilotCanonicalProduct,
  normalizeCostbookUnit,
  normalizeSupplierProductText,
} from "../modules/costbook/canonicalProductMatcher";

describe("Costbook canonical pilot matcher", () => {
  it("ships the exact 12-item pilot catalog without creating a second database catalog", () => {
    expect(COSTBOOK_PILOT_CANONICAL_ITEMS).toHaveLength(12);
    expect(new Set(COSTBOOK_PILOT_CANONICAL_ITEMS.map((item) => item.canonicalMaterialKey)).size).toBe(12);
  });

  it.each([
    ["2x4 x 8 ft SPF stud", "LUMBER.SPF.2X4.8FT.STUD"],
    ["7/16 OSB 4 x 8 sheet", "SHEATHING.OSB.7_16IN.4X8.SHEET"],
    ["1/2 drywall 4x8 gypsum sheet", "DRYWALL.REG.0_5IN.4X8.SHEET"],
    ["5/8 Type X drywall 4x8", "DRYWALL.TYPE_X.0_625IN.4X8.SHEET"],
    ["80 lb concrete mix bag", "CONCRETE.MIX.80LB.BAG"],
    ["12/2 NM-B Romex roll", "ELECTRICAL.NMB.12_2.ROLL"],
    ["1/2 PEX coil", "PLUMBING.PEX.0_5IN.COIL"],
    ["3 in PVC DWV stick", "PLUMBING.PVC.DWV.3IN.STICK"],
    ["R-13 fiberglass insulation batt", "INSULATION.FIBERGLASS.R13.BATT"],
    ["architectural shingles bundle", "ROOFING.SHINGLE.ARCHITECTURAL.BUNDLE"],
    ["interior wall paint gallon", "PAINT.INTERIOR.WALL.GALLON"],
    ["construction adhesive tube", "ADHESIVE.CONSTRUCTION.TUBE"],
  ])("auto-links an unambiguous pilot identity: %s", (name, expectedKey) => {
    const result = matchPilotCanonicalProduct({ name });
    expect(result.action).toBe("AUTO_LINK");
    expect(result.canonicalMaterialKey).toBe(expectedKey);
    expect(result.score).toBeGreaterThanOrEqual(0.97);
  });

  it("routes a near-match into human review instead of auto-linking it", () => {
    const result = matchPilotCanonicalProduct({ name: "2x4 x 8 ft framing material" });
    expect(result).toMatchObject({
      action: "HUMAN_REVIEW",
      canonicalMaterialKey: "LUMBER.SPF.2X4.8FT.STUD",
      score: 0.9,
    });
  });

  it("does not auto-link a fitting that only shares PEX size text", () => {
    const result = matchPilotCanonicalProduct({
      name: "1/2 PEX coupling",
      purchaseUnit: "BOX",
    });
    expect(result.action).toBe("CREATE_NEW_CANDIDATE");
    expect(result.canonicalMaterialKey).toBeNull();
  });

  it("routes a complete text match with a conflicting purchase unit to human review", () => {
    const result = matchPilotCanonicalProduct({
      name: "1/2 PEX coil",
      purchaseUnit: "BOX",
    });
    expect(result).toMatchObject({
      action: "HUMAN_REVIEW",
      canonicalMaterialKey: "PLUMBING.PEX.0_5IN.COIL",
      score: 0.9,
    });
    expect(result.rationale).toContain("purchase unit BOX conflicts with canonical unit COIL");
  });

  it("fails closed on a dimension conflict instead of fuzzy-linking 2x6 as 2x4", () => {
    const result = matchPilotCanonicalProduct({ name: "2x6 x 8 ft SPF stud" });
    expect(result.action).toBe("CREATE_NEW_CANDIDATE");
    expect(result.canonicalMaterialKey).toBeNull();
  });

  it("honors an existing canonical key as the strongest governed identity", () => {
    const result = matchPilotCanonicalProduct({
      name: "Supplier marketing title",
      canonicalMaterialKey: "CONCRETE.MIX.80LB.BAG",
    });
    expect(result).toMatchObject({
      action: "AUTO_LINK",
      canonicalMaterialKey: "CONCRETE.MIX.80LB.BAG",
      score: 1,
    });
  });

  it("normalizes units and common product text deterministically", () => {
    expect(normalizeCostbookUnit("sq ft")).toBe("SQ_FT");
    expect(normalizeCostbookUnit("gal.")).toBe("GALLON");
    expect(normalizeCostbookUnit(null)).toBe("UNKNOWN");
    expect(normalizeSupplierProductText({ name: '2 x 4 x 96" SPF Stud' })).toContain("2x4");
    expect(normalizeSupplierProductText({ name: '2 x 4 x 96" SPF Stud' })).toContain("96in");
  });
});
