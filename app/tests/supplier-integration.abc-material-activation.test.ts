import {
  ABC_MATERIAL_CONFIRMATION,
  parseAbcMaterialActivationArgs,
  validateAbcMaterialCandidate,
} from "../modules/supplier-integration/abcMaterialActivation";

const orgId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const basic = [`--org-id=${orgId}`, `--user-id=${userId}`, "--product-key=ABC-100012"];
const approved = [
  ...basic,
  "--approved-unit-cost=125.5000",
  "--confirm-sku=100012",
  "--confirm-unit=SQ",
  `--confirmation=${ABC_MATERIAL_CONFIRMATION}`,
  "--apply",
];

const candidate = {
  name: "Verified ABC roofing product",
  sku: "100012",
  purchaseUnit: "SQ",
  canonicalMaterialKey: "ROOFING-SHINGLE",
  isActive: true,
  materialId: null,
  matchingSupplierProductCount: 1,
  matchingMaterialCount: 0,
  observationCount: 1,
};

describe("ABC single-material activation gates", () => {
  it("defaults to a read-only preview with no assumed cost or approval", () => {
    expect(parseAbcMaterialActivationArgs(basic)).toMatchObject({
      orgId, userId, productKey: "ABC-100012",
      apply: false, approvedUnitCost: null,
    });
  });

  it("only enables writes when actor supplies every separate approval gate", () => {
    expect(parseAbcMaterialActivationArgs(approved)).toMatchObject({
      approvedUnitCost: "125.5000", confirmedSku: "100012",
      confirmedUnit: "SQ", apply: true,
    });
    expect(() => parseAbcMaterialActivationArgs([...basic, "--apply"])).toThrow("Writing requires");
    expect(() => parseAbcMaterialActivationArgs([...approved, "--approval=YES"])).toThrow();
    expect(() => parseAbcMaterialActivationArgs([...approved, "--confirmed=NO"])).toThrow();
    expect(() => parseAbcMaterialActivationArgs([...approved, "--approved-unit-cost=125"])).toThrow("repeated");
  });

  it("rejects unbounded, zero, negative, or overly precise costs", () => {
    for (const invalid of ["0", "-5", "2.12345", "100000000", "NaN", "Infinity"]) {
      expect(() => parseAbcMaterialActivationArgs([
        ...basic, `--approved-unit-cost=${invalid}`,
      ])).toThrow("--approved-unit-cost");
    }
  });

  it("requires exact source SKU and purchase unit, without conversion", () => {
    expect(validateAbcMaterialCandidate(candidate, {
      apply: true, confirmedSku: "100012", confirmedUnit: "SQ",
    })).toEqual({ sku: "100012", unit: "SQ" });
    expect(() => validateAbcMaterialCandidate(candidate, {
      apply: true, confirmedSku: "100012", confirmedUnit: "EA",
    })).toThrow("match source evidence");
    expect(() => validateAbcMaterialCandidate(candidate, {
      apply: true, confirmedSku: "OTHER", confirmedUnit: "SQ",
    })).toThrow("match source evidence");
  });

  it("fails closed on missing identity, duplicate SKUs, missing evidence, and existing links", () => {
    for (const override of [
      { sku: null }, { purchaseUnit: null },
      { canonicalMaterialKey: null }, { isActive: false },
      { materialId: "already-linked" },
      { matchingSupplierProductCount: 2 },
      { matchingMaterialCount: 1 }, { observationCount: 0 },
    ]) {
      expect(() => validateAbcMaterialCandidate({ ...candidate, ...override }, {
        apply: false, confirmedSku: null, confirmedUnit: null,
      })).toThrow();
    }
  });
});
