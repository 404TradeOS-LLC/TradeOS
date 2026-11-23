import {
  ASSEMBLY_CATALOG,
  type AssemblyCatalogUnit,
} from "../modules/assemblies-database/catalog";
import {
  EXPANDED_ASSEMBLY_CATALOG,
  getExpandedCatalogTemplate,
} from "../modules/assemblies-database/tradeosCatalogAdapter";
import {
  MAX_DECIMAL_12_4_QUANTITY,
  TAKEOFF_FAMILIES,
  assessTemplateMeasurement,
  convertArea,
  deriveAssemblyQuantity,
  familyForTemplateOutput,
  familyForUnit,
  type MeasurableTemplate,
} from "../modules/assemblies-database/measurement";

describe("measurement families", () => {
  it("classifies every catalog unit into exactly one family", () => {
    const units: AssemblyCatalogUnit[] = [
      "CY", "EA", "GAL", "HR", "LF", "LS", "SF", "SQ", "TON", "BAG", "BF", "BD",
      "BOX", "BTL", "CAN", "DAY", "KIT", "LB", "PAIR", "ROLL", "SET", "SHT",
      "SY", "TUB", "TUBE",
    ];
    for (const unit of units) {
      expect(typeof familyForUnit(unit)).toBe("string");
    }
    expect(familyForUnit("SF")).toBe("area");
    expect(familyForUnit("SQ")).toBe("area");
    expect(familyForUnit("SY")).toBe("area");
    expect(familyForUnit("LF")).toBe("linear");
    expect(familyForUnit("EA")).toBe("count");
    expect(familyForUnit("SET")).toBe("count");
    expect(familyForUnit("CY")).toBe("volume");
    expect(familyForUnit("GAL")).toBe("volume");
    expect(familyForUnit("BF")).toBe("volume");
    expect(familyForUnit("LS")).toBe("allowance");
    expect(familyForUnit("TON")).toBe("mass");
    expect(familyForUnit("LB")).toBe("mass");
    expect(familyForUnit("HR")).toBe("time");
    expect(familyForUnit("DAY")).toBe("time");
  });

  it("keeps the takeoff families to the five triage families", () => {
    expect([...TAKEOFF_FAMILIES].sort()).toEqual(["allowance", "area", "count", "linear", "volume"]);
  });

  it("maps template output units to their takeoff family", () => {
    expect(familyForTemplateOutput("CY")).toBe("volume");
    expect(familyForTemplateOutput("EA")).toBe("count");
    expect(familyForTemplateOutput("LF")).toBe("linear");
    expect(familyForTemplateOutput("SF")).toBe("area");
    expect(familyForTemplateOutput("SQ")).toBe("area");
  });

  it("converts area units exactly and only within area", () => {
    expect(convertArea(1, "SQ", "SF")).toBe(100);
    expect(convertArea(9, "SY", "SF")).toBe(81);
    expect(convertArea(100, "SF", "SQ")).toBe(1);
    expect(convertArea(1, "SQ", "SY")).toBeCloseTo(100 / 9, 10);
    expect(convertArea(5, "SF", "SF")).toBe(5);
  });
});

describe("template measurement contracts across the catalog", () => {
  it("holds for every reviewed starter template", () => {
    for (const template of ASSEMBLY_CATALOG) {
      const assessment = assessTemplateMeasurement(template);
      expect(assessment.valid).toBe(true);
      expect(assessment.reasons).toEqual([]);
      expect(assessment.family).toBe(familyForTemplateOutput(template.unitOfMeasure));
    }
  });

  it("holds for every expanded catalog template (107), adding no new install blocks", () => {
    for (const template of EXPANDED_ASSEMBLY_CATALOG) {
      const assessment = assessTemplateMeasurement(template);
      expect(assessment.valid).toBe(true);
      expect(assessment.reasons).toEqual([]);
    }
    // The only blocked recipes remain the two source-blocked ones (S1), and
    // their blocking reasons are source reasons only — the measurement
    // contract adds no new install block anywhere in the catalog.
    for (const template of EXPANDED_ASSEMBLY_CATALOG) {
      if (!("blockingReasons" in template)) continue;
      for (const reason of template.blockingReasons as string[]) {
        expect(reason).not.toMatch(/Measurement contract/);
      }
    }
    expect(getExpandedCatalogTemplate("tradeos:demo-roofing-shingle-tearoff-2layers"))
      .toMatchObject({ blockingReasons: [expect.stringContaining("SRC-0049")] });
    expect(getExpandedCatalogTemplate("tradeos:demo-cabinet-kitchen-base-wall"))
      .toMatchObject({ blockingReasons: [expect.stringContaining("SRC-0050")] });
  });

  it("records the right output and component families per template", () => {
    // Starter labor is denominated in the output unit (SF), not hours, so the
    // slab's families are volume + area; the time family appears only in
    // research recipes, whose labor components are HR-denominated rates.
    const slab = assessTemplateMeasurement(getExpandedCatalogTemplate("slab-four-inch")!);
    expect(slab.family).toBe("area");
    expect(slab.componentFamilies).toEqual(["volume", "area"]);

    const roof = assessTemplateMeasurement(getExpandedCatalogTemplate("roof-asphalt-shingle")!);
    expect(roof.family).toBe("area");
    expect(roof.componentFamilies).toEqual(["area"]);

    const receptacle = assessTemplateMeasurement(getExpandedCatalogTemplate("receptacle")!);
    expect(receptacle.family).toBe("count");
    expect(receptacle.componentFamilies).toEqual(["count"]);

    const excavation = assessTemplateMeasurement(getExpandedCatalogTemplate("site-excavation")!);
    expect(excavation.family).toBe("volume");

    const demo = assessTemplateMeasurement(getExpandedCatalogTemplate("tradeos:demo-drywall-stud-bare")!);
    expect(demo.family).toBe("area");
    expect(demo.componentFamilies).toEqual(["time", "count", "mass", "area"]);
  });

  it("rejects templates that break the contract, with reasons", () => {
    const base: MeasurableTemplate = {
      id: "test-template",
      unitOfMeasure: "SF",
      measurementBasis: "Square foot of wall surface area.",
      components: [
        { key: "material", quantityPerUnit: 1.1, compatibleUnits: ["SF"], allowedCostItemKinds: ["material"] },
        { key: "labor", quantityPerUnit: 1, compatibleUnits: ["SF"], allowedCostItemKinds: ["labor"] },
      ],
    };
    expect(assessTemplateMeasurement(base).valid).toBe(true);

    expect(assessTemplateMeasurement({ ...base, measurementBasis: "  " }).reasons)
      .toEqual(expect.arrayContaining([expect.stringMatching(/measurementBasis is empty/)]));
    expect(assessTemplateMeasurement({ ...base, unitOfMeasure: "FT" }).reasons)
      .toEqual(expect.arrayContaining([expect.stringMatching(/not a catalog measurement unit/)]));
    expect(assessTemplateMeasurement({ ...base, unitOfMeasure: "SQ", measurementBasis: "Roofing square." }).reasons)
      .toEqual(expect.arrayContaining([expect.stringMatching(/100-SF definition/)]));
    expect(assessTemplateMeasurement({ ...base, unitOfMeasure: "SQ", measurementBasis: "One roofing square equals 1000 SF." }).reasons)
      .toEqual(expect.arrayContaining([expect.stringMatching(/100-SF definition/)]));
    expect(assessTemplateMeasurement({ ...base, unitOfMeasure: "SQ", measurementBasis: "Roofing square (100 SF)." }).valid).toBe(true);
    expect(assessTemplateMeasurement({
      ...base,
      components: [{ key: "material", quantityPerUnit: 0, compatibleUnits: ["SF"], allowedCostItemKinds: ["material"] }],
    }).reasons).toEqual(expect.arrayContaining([expect.stringMatching(/finite positive number/)]));
    expect(assessTemplateMeasurement({
      ...base,
      components: [{ key: "material", quantityPerUnit: 1, compatibleUnits: ["FURLONG"], allowedCostItemKinds: ["material"] }],
    }).reasons).toEqual(expect.arrayContaining([expect.stringMatching(/not a recognized catalog unit/)]));
    expect(assessTemplateMeasurement({ ...base, components: [] }).reasons)
      .toEqual(expect.arrayContaining([expect.stringMatching(/no components/)]));
  });

  it("requires allowance components to be lump-sum, one per assembly unit", () => {
    const allowance: MeasurableTemplate = {
      id: "test-allowance",
      unitOfMeasure: "SF",
      measurementBasis: "Square foot of wall surface area.",
      components: [
        { key: "trim", quantityPerUnit: 1, compatibleUnits: ["SF", "LS"], allowedCostItemKinds: ["allowance", "material"] },
      ],
    };
    expect(assessTemplateMeasurement(allowance).valid).toBe(true);

    expect(assessTemplateMeasurement({
      ...allowance,
      components: [{ key: "trim", quantityPerUnit: 1, compatibleUnits: ["SF"], allowedCostItemKinds: ["allowance"] }],
    }).reasons).toEqual(expect.arrayContaining([expect.stringMatching(/lump-sum \(LS\) denominated/)]));
    expect(assessTemplateMeasurement({
      ...allowance,
      components: [{ key: "trim", quantityPerUnit: 2, compatibleUnits: ["SF", "LS"], allowedCostItemKinds: ["allowance"] }],
    }).reasons).toEqual(expect.arrayContaining([expect.stringMatching(/exactly 1 per assembly unit/)]));
  });
});

describe("takeoff quantity derivation", () => {
  const wall = { id: "wall-2x4-16oc", unitOfMeasure: "SF" };
  const roof = { id: "roof-asphalt-shingle", unitOfMeasure: "SQ" };
  const receptacle = { id: "receptacle", unitOfMeasure: "EA" };
  const excavation = { id: "site-excavation", unitOfMeasure: "CY" };

  it("derives assembly quantity from a same-unit verified takeoff", () => {
    expect(deriveAssemblyQuantity(wall, { value: 2400, unit: "SF", verified: true })).toEqual({
      ok: true,
      derivation: { assemblyQuantity: 2400, assemblyUnit: "SF", takeoffFamily: "area", conversionApplied: null },
    });
    expect(deriveAssemblyQuantity(receptacle, { value: 12, unit: "EA", verified: true })).toEqual({
      ok: true,
      derivation: { assemblyQuantity: 12, assemblyUnit: "EA", takeoffFamily: "count", conversionApplied: null },
    });
    expect(deriveAssemblyQuantity(excavation, { value: 10, unit: "CY", verified: true })).toEqual({
      ok: true,
      derivation: { assemblyQuantity: 10, assemblyUnit: "CY", takeoffFamily: "volume", conversionApplied: null },
    });
  });

  it("converts inside area exactly and records the conversion", () => {
    expect(deriveAssemblyQuantity(roof, { value: 1500, unit: "SF", verified: true })).toEqual({
      ok: true,
      derivation: {
        assemblyQuantity: 15,
        assemblyUnit: "SQ",
        takeoffFamily: "area",
        conversionApplied: { from: "SF", to: "SQ", factor: 0.01 },
      },
    });
    expect(deriveAssemblyQuantity(wall, { value: 100, unit: "SY", verified: true })).toEqual({
      ok: true,
      derivation: {
        assemblyQuantity: 900,
        assemblyUnit: "SF",
        takeoffFamily: "area",
        conversionApplied: { from: "SY", to: "SF", factor: 9 },
      },
    });
  });

  it("rounds to the Decimal(12,4) quantity precision", () => {
    const result = deriveAssemblyQuantity(wall, { value: 1.23456, unit: "SF", verified: true });
    expect(result).toEqual({
      ok: true,
      derivation: { assemblyQuantity: 1.2346, assemblyUnit: "SF", takeoffFamily: "area", conversionApplied: null },
    });
  });

  it("rejects derivations that round to zero, overflow, or exceed Decimal(12,4)", () => {
    // 0.001 SF is 0 SQ at four-decimal precision: the measured work would be lost.
    expect(deriveAssemblyQuantity(roof, { value: 0.001, unit: "SF", verified: true })).toEqual({
      ok: false,
      reasons: expect.arrayContaining([expect.stringMatching(/Decimal\(12,4\)/)]),
    });
    expect(deriveAssemblyQuantity(wall, { value: 0.00001, unit: "SF", verified: true })).toEqual({
      ok: false,
      reasons: expect.arrayContaining([expect.stringMatching(/Decimal\(12,4\)/)]),
    });
    expect(deriveAssemblyQuantity(roof, { value: Number.MAX_VALUE, unit: "SF", verified: true })).toEqual({
      ok: false,
      reasons: expect.arrayContaining([expect.stringMatching(/Decimal\(12,4\)/)]),
    });
    expect(deriveAssemblyQuantity(wall, { value: 100000000, unit: "SF", verified: true })).toEqual({
      ok: false,
      reasons: expect.arrayContaining([expect.stringMatching(/Decimal\(12,4\)/)]),
    });
    // Boundary: the Decimal(12,4) maximum itself still derives.
    expect(deriveAssemblyQuantity(wall, { value: MAX_DECIMAL_12_4_QUANTITY, unit: "SF", verified: true })).toEqual({
      ok: true,
      derivation: { assemblyQuantity: MAX_DECIMAL_12_4_QUANTITY, assemblyUnit: "SF", takeoffFamily: "area", conversionApplied: null },
    });
  });

  it("rejects unverified takeoff quantities, never applying them", () => {
    const result = deriveAssemblyQuantity(wall, { value: 2400, unit: "SF", verified: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons).toEqual(expect.arrayContaining([expect.stringMatching(/not verified/)]));
  });

  it("rejects family mismatches, time/mass units, unknown units, and bad values", () => {
    expect(deriveAssemblyQuantity(wall, { value: 100, unit: "LF", verified: true })).toEqual({
      ok: false,
      reasons: expect.arrayContaining([expect.stringMatching(/takeoff measures linear.*outputs SF \(area\)/)]),
    });
    expect(deriveAssemblyQuantity(wall, { value: 10, unit: "HR", verified: true })).toEqual({
      ok: false,
      reasons: expect.arrayContaining([expect.stringMatching(/measures time/)]),
    });
    expect(deriveAssemblyQuantity(wall, { value: 10, unit: "TON", verified: true })).toEqual({
      ok: false,
      reasons: expect.arrayContaining([expect.stringMatching(/measures mass/)]),
    });
    expect(deriveAssemblyQuantity(wall, { value: 10, unit: "FURLONG", verified: true })).toEqual({
      ok: false,
      reasons: expect.arrayContaining([expect.stringMatching(/not a recognized catalog unit/)]),
    });
    expect(deriveAssemblyQuantity(wall, { value: 0, unit: "SF", verified: true })).toEqual({
      ok: false,
      reasons: expect.arrayContaining([expect.stringMatching(/finite positive number/)]),
    });
    expect(deriveAssemblyQuantity(wall, { value: -5, unit: "SF", verified: true })).toEqual({
      ok: false,
      reasons: expect.arrayContaining([expect.stringMatching(/finite positive number/)]),
    });
    expect(deriveAssemblyQuantity({ id: "bad", unitOfMeasure: "FT" }, { value: 10, unit: "SF", verified: true })).toEqual({
      ok: false,
      reasons: expect.arrayContaining([expect.stringMatching(/not a catalog measurement unit/)]),
    });
  });

  it("rejects same-family unit pairs with no defined conversion", () => {
    // Count-family units other than the assembly output unit have no
    // conversion: a BOX takeoff cannot silently become an EA quantity.
    const result = deriveAssemblyQuantity(receptacle, { value: 2, unit: "BOX", verified: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons).toEqual(expect.arrayContaining([expect.stringMatching(/no conversion is defined/)]));
  });
});
