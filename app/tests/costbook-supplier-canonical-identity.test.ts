import {
  canonicalIdentityConflictsWithProductText,
  canonicalMaterialKeysEquivalent,
  extractSupplierIdentityTextAttributes,
  parseTradeOsCanonicalMaterialIdentity,
  resolveTradeOsCanonicalMaterialKey,
  supplierCanonicalAliasesForTradeOsIdentity,
} from "../modules/costbook/supplierCanonicalIdentity";

describe("Costbook supplier canonical identity", () => {
  it.each([
    ["LUMBER-SPF-2X4-92_5_8-STUD", "LUMBER.SPF.STUD.2X4.92_5_8IN"],
    ["LUMBER-SPF-2X4-92-5_8IN-STUD", "LUMBER.SPF.STUD.2X4.92_5_8IN"],
    ["STUD-SPF-2X4-92_5_8", "LUMBER.SPF.STUD.2X4.92_5_8IN"],
    ["LUMBER-SPF-STUD-2X4-92_58", "LUMBER.SPF.STUD.2X4.92_5_8IN"],
  ])("maps supplier vocabulary %s into one TradeOS identity", (sourceKey, expected) => {
    expect(resolveTradeOsCanonicalMaterialKey(sourceKey)).toBe(expected);
  });

  it("keeps materially different precut lengths as different canonical identities", () => {
    expect(canonicalMaterialKeysEquivalent(
      "LUMBER-SPF-2X4-92_5_8-STUD",
      "STUD-SPF-2X4-104_5_8"
    )).toBe(false);

    expect(resolveTradeOsCanonicalMaterialKey("STUD-SPF-2X4-104_5_8"))
      .toBe("LUMBER.SPF.STUD.2X4.104_5_8IN");
  });

  it("parses the canonical identity into comparison attributes", () => {
    expect(parseTradeOsCanonicalMaterialIdentity("LUMBER.SPF.STUD.2X4.92_5_8IN"))
      .toEqual({
        canonicalMaterialKey: "LUMBER.SPF.STUD.2X4.92_5_8IN",
        family: "LUMBER",
        species: "SPF",
        productType: "STUD",
        nominalSize: "2X4",
        lengthInches: 92.625,
        comparisonUnit: "EACH",
      });
  });

  it("treats 104-5/8 text as a hard conflict for a 92-5/8 canonical stud", () => {
    expect(canonicalIdentityConflictsWithProductText(
      "LUMBER.SPF.STUD.2X4.92_5_8IN",
      "2 in. x 4 in. x 104-5/8 in. #2 Stud Grade KD-HT Precut Stud"
    )).toBe(true);
  });

  it("accepts a compatible 92-5/8 SPF stud title", () => {
    expect(canonicalIdentityConflictsWithProductText(
      "LUMBER.SPF.STUD.2X4.92_5_8IN",
      "2-in x 4-in x 92-5/8 in Spruce-Pine-Fir Framing Lumber"
    )).toBe(false);
  });

  it("treats nominal-size and species conflicts as hard exclusions", () => {
    expect(canonicalIdentityConflictsWithProductText(
      "LUMBER.SPF.STUD.2X4.92_5_8IN",
      "2 in. x 6 in. x 92-5/8 in. SPF Stud"
    )).toBe(true);
    expect(canonicalIdentityConflictsWithProductText(
      "LUMBER.SPF.STUD.2X4.92_5_8IN",
      "2 in. x 4 in. x 92-5/8 in. Southern Yellow Pine Stud"
    )).toBe(true);
  });

  it("extracts normalized nominal size and mixed-fraction length", () => {
    expect(extractSupplierIdentityTextAttributes(
      "2 in. x 4 in. x 92-5/8 in. Prime SPF Stud"
    )).toMatchObject({
      nominalSize: "2X4",
      lengthInches: 92.625,
      speciesConflict: false,
    });
  });

  it("extracts the final length dimension after normalization", () => {
    expect(extractSupplierIdentityTextAttributes(
      "2in x 4in x 92.625in SPF precut stud"
    )).toMatchObject({
      nominalSize: "2X4",
      lengthInches: 92.625,
      speciesConflict: false,
    });
  });

  it("rejects abbreviated pressure-treated product text", () => {
    expect(canonicalIdentityConflictsWithProductText(
      "LUMBER.SPF.STUD.2X4.92_5_8IN",
      "2x4 x 92-5/8 PT stud"
    )).toBe(true);
  });

  it("returns null instead of throwing for unsupported fractional alias lengths", () => {
    expect(() => resolveTradeOsCanonicalMaterialKey(
      "LUMBER-SPF-2X4-92_1_3-STUD"
    )).not.toThrow();
    expect(resolveTradeOsCanonicalMaterialKey(
      "LUMBER-SPF-2X4-92_1_3-STUD"
    )).toBeNull();
  });

  it("rejects SPF stud identities outside the governed cross-supplier registry", () => {
    expect(resolveTradeOsCanonicalMaterialKey("LUMBER-SPF-2X4-84-STUD")).toBeNull();
    expect(resolveTradeOsCanonicalMaterialKey("LUMBER.SPF.STUD.2X4.84IN")).toBeNull();
  });

  it("rejects quoted decimal-inch length conflicts", () => {
    expect(canonicalIdentityConflictsWithProductText(
      "LUMBER.SPF.STUD.2X4.92_5_8IN",
      '2 in. x 4 in. x 104.625" SPF stud'
    )).toBe(true);
  });

  it("enumerates reviewed legacy aliases for database lookup", () => {
    expect(supplierCanonicalAliasesForTradeOsIdentity(
      "LUMBER.SPF.STUD.2X4.92_5_8IN"
    )).toEqual(expect.arrayContaining([
      "LUMBER.SPF.STUD.2X4.92_5_8IN",
      "LUMBER-SPF-2X4-92_5_8-STUD",
      "LUMBER-SPF-2X4-92-5_8IN-STUD",
      "STUD-SPF-2X4-92_5_8",
      "LUMBER-SPF-STUD-2X4-92_58",
    ]));
  });

  it("fails closed for source key vocabularies with no governed crosswalk", () => {
    expect(resolveTradeOsCanonicalMaterialKey("ROOFING-SHINGLE-UNKNOWN-VARIANT")).toBeNull();
  });
});
