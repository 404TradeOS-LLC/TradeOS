import {
  EXPANDED_ASSEMBLY_CATALOG,
  TRADEOS_RESEARCH_CATALOG,
  VERIFIED_KITCHEN_GAP_CATALOG,
  getExpandedCatalogTemplate,
} from "../modules/assemblies-database/tradeosCatalogAdapter";
import { TRADEOS_ASSEMBLIES } from "../modules/costbook/tradeosAssemblies";
import {
  ASSEMBLY_CATALOG,
  ASSEMBLY_CATALOG_COVERAGE,
  ASSEMBLY_CATALOG_VERSION,
  CSI_DIVISIONS,
  NAHB_GROUPS,
  assessCatalogComponentMapping,
} from "../modules/assemblies-database/catalog";

describe("assembly starter catalog", () => {
  it("has unique ids and CSI-coded assembly codes", () => {
    expect(ASSEMBLY_CATALOG).toHaveLength(14);
    expect(ASSEMBLY_CATALOG_VERSION).toBe("2026.09.1");
    expect(new Set(ASSEMBLY_CATALOG.map((item) => item.id)).size).toBe(ASSEMBLY_CATALOG.length);
    expect(new Set(ASSEMBLY_CATALOG.map((item) => item.code)).size).toBe(ASSEMBLY_CATALOG.length);
    for (const item of ASSEMBLY_CATALOG) {
      expect(item.version).toBe(1);
      expect(item.review.status).toBe("reviewed");
      expect(item.review.source).toBe("TradeOS-authored");
      expect(item.review.regionalBasis.length).toBeGreaterThan(10);
      expect(item.code).toMatch(/^\d{2} \d{2} \d{2}-TOS-\d{3}$/);
      expect(CSI_DIVISIONS.some((division) => division.code === item.csiDivision)).toBe(true);
      expect(NAHB_GROUPS).toContain(item.nahbGroup);
    }
  });

  it("requires distinct component keys and positive quantities", () => {
    for (const item of ASSEMBLY_CATALOG) {
      expect(item.components.length).toBeGreaterThanOrEqual(2);
      expect(new Set(item.components.map((component) => component.key)).size).toBe(item.components.length);
      for (const component of item.components) {
        expect(component.quantityPerUnit).toBeGreaterThan(0);
        expect(component.help.length).toBeGreaterThan(10);
        expect(component.compatibleUnits.length).toBeGreaterThan(0);
        expect(component.allowedCostItemKinds.length).toBeGreaterThan(0);
      }
    }
  });

  it("publishes complete NAHB coverage rows without overstating catalog breadth", () => {
    expect(ASSEMBLY_CATALOG_COVERAGE.map((row) => row.nahbGroup)).toEqual(NAHB_GROUPS);
    expect(ASSEMBLY_CATALOG_COVERAGE.reduce((total, row) => total + row.templateCount, 0)).toBe(14);
    expect(ASSEMBLY_CATALOG_COVERAGE.find((row) => row.nahbGroup === "Framing")).toEqual(expect.objectContaining({
      templateCount: 1,
      csiDivisions: ["06"],
      measurementUnits: ["SF"],
      trades: ["Carpentry"],
    }));
  });

  it("pins reviewed recipe quantities and compatibility metadata by version", () => {
    expect(ASSEMBLY_CATALOG.map((item) => [
      item.id,
      item.version,
      item.components.map((component) => [
        component.key,
        component.quantityPerUnit,
        component.compatibleUnits.join("|"),
        component.allowedCostItemKinds.join("|"),
      ]),
    ])).toMatchSnapshot();
  });

  it("normalizes unit aliases and evaluates unit plus component-type compatibility", () => {
    const concrete = ASSEMBLY_CATALOG.find((item) => item.id === "slab-four-inch")!.components.find((item) => item.key === "concrete")!;

    expect(assessCatalogComponentMapping(concrete, {
      unitOfMeasure: "cubic yards",
      laborRateId: null,
      materialId: "material-1",
      equipmentId: null,
      subcontractorId: null,
    })).toEqual(expect.objectContaining({ compatible: true, normalizedUnit: "CY", kind: "material" }));

    expect(assessCatalogComponentMapping(concrete, {
      unitOfMeasure: "SF",
      laborRateId: "labor-1",
      materialId: null,
      equipmentId: null,
      subcontractorId: null,
    })).toEqual(expect.objectContaining({
      compatible: false,
      reasons: expect.arrayContaining([expect.stringMatching(/expects CY/), expect.stringMatching(/expects material or composite/)]),
    }));
  });
});

describe("expanded research assembly catalog", () => {
  it("exposes 88 source recipes alongside 14 unchanged starters without duplicate identifiers", () => {
    expect(TRADEOS_RESEARCH_CATALOG).toHaveLength(88);
    expect(EXPANDED_ASSEMBLY_CATALOG).toHaveLength(104);
    expect(EXPANDED_ASSEMBLY_CATALOG.slice(0, 14)).toEqual(ASSEMBLY_CATALOG);
    expect(new Set(EXPANDED_ASSEMBLY_CATALOG.map((item) => item.id)).size).toBe(104);
    expect(new Set(EXPANDED_ASSEMBLY_CATALOG.map((item) => item.code)).size).toBe(104);
  });

  it("preserves every research quantity and labels source-blocked recipes", () => {
    for (const assembly of TRADEOS_ASSEMBLIES) {
      const recipe = getExpandedCatalogTemplate(`tradeos:${assembly.id}`)!;
      expect(recipe.name).toBe(assembly.name);
      expect(recipe.components).toHaveLength(assembly.components.length);
      expect(recipe.components.map((component) => component.quantityPerUnit))
        .toEqual(assembly.components.map((component) => component.quantityPerUnit));
      expect(recipe.components.every((component) => component.compatibleUnits.length === 1)).toBe(true);
      expect(recipe.components.every((component) => component.quantityPerUnit > 0)).toBe(true);
    }
    const pending = TRADEOS_RESEARCH_CATALOG.filter((item) => item.blockingReasons.length);
    expect(pending).toHaveLength(11);
    expect(getExpandedCatalogTemplate("tradeos:demo-cabinet-kitchen-base-wall"))
      .toMatchObject({ blockingReasons: [expect.stringContaining("SRC-0050")] });
    expect(getExpandedCatalogTemplate("tradeos:roofing-shingles-arch-asphalt"))
      .toMatchObject({ blockingReasons: [] });
  });

  it("normalizes recipe purchase units without accepting another package size at 1:1", () => {
    const shingle = getExpandedCatalogTemplate("tradeos:roofing-shingles-arch-asphalt")!;
    for (const component of shingle.components) {
      const nativeUnit = component.compatibleUnits[0];
      expect(nativeUnit).toMatch(/^[A-Z]+$/);
    }
    expect(assessCatalogComponentMapping({
      key: "package", label: "Box of fasteners", help: "Quantity per box",
      quantityPerUnit: 0.5, compatibleUnits: ["BOX"], allowedCostItemKinds: ["material"],
    }, {
      unitOfMeasure: "EA", materialId: "material-1", laborRateId: null,
      equipmentId: null, subcontractorId: null,
    }).compatible).toBe(false);
  });
});

describe("price-neutral kitchen gap recipes", () => {
  it("exposes wall cabinets and prefabricated straight-run laminate without inventing prices", () => {
    expect(VERIFIED_KITCHEN_GAP_CATALOG).toHaveLength(2);
    expect(VERIFIED_KITCHEN_GAP_CATALOG.map((recipe) => recipe.id)).toEqual([
      "kitchen:wall-cabinet-prefab",
      "kitchen:laminate-countertop-straight",
    ]);
    expect(VERIFIED_KITCHEN_GAP_CATALOG.map((recipe) => recipe.code)).toEqual([
      "12 35 30-TOS-001",
      "12 36 23-TOS-001",
    ]);
    expect(VERIFIED_KITCHEN_GAP_CATALOG.every((recipe) =>
      recipe.nahbPhase === "5000" && recipe.csiDivision === "12" &&
      recipe.review.status === "research" && recipe.blockingReasons.length === 0
    )).toBe(true);
    expect(VERIFIED_KITCHEN_GAP_CATALOG.flatMap((recipe) => recipe.components)
      .every((component) => component.quantityPerUnit === 1)).toBe(true);
    expect(JSON.stringify(VERIFIED_KITCHEN_GAP_CATALOG)).not.toMatch(/\$\d+\.\d{2}/);
  });

  it("uses native EA for each wall cabinet and LF for the straight-run countertop", () => {
    const wall = getExpandedCatalogTemplate("kitchen:wall-cabinet-prefab")!;
    const top = getExpandedCatalogTemplate("kitchen:laminate-countertop-straight")!;
    expect(wall.unitOfMeasure).toBe("EA");
    expect(top.unitOfMeasure).toBe("LF");
    expect(wall.components.map((component) => component.compatibleUnits)).toEqual([
      ["EA"], ["EA"], ["EA"],
    ]);
    expect(top.components.map((component) => component.compatibleUnits)).toEqual([
      ["LF"], ["LF"],
    ]);
    expect(top.wasteGuidance).toContain("never equate an EA 8-ft slab to 1 LF");
    const surface = top.components[0];
    expect(assessCatalogComponentMapping(surface, {
      unitOfMeasure: "EA", materialId: "item", laborRateId: null,
      equipmentId: null, subcontractorId: null,
    }).compatible).toBe(false);
    expect(assessCatalogComponentMapping(surface, {
      unitOfMeasure: "LF", materialId: "item", laborRateId: null,
      equipmentId: null, subcontractorId: null,
    }).compatible).toBe(true);
  });

  it("records source IDs and enforces unique component keys for every new kitchen recipe", () => {
    expect(VERIFIED_KITCHEN_GAP_CATALOG.map((recipe) => recipe.evidenceRefs)).toEqual([
      ["SRC-0069"], ["SRC-0070"],
    ]);
    for (const recipe of VERIFIED_KITCHEN_GAP_CATALOG) {
      expect(new Set(recipe.components.map((component) => component.key)).size)
        .toBe(recipe.components.length);
      expect(recipe.measurementBasis.length).toBeGreaterThan(25);
      expect(recipe.wasteGuidance).toMatch(/Excludes/);
    }
  });
});
