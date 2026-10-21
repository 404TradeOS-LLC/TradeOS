import {
  EXPANDED_ASSEMBLY_CATALOG,
  TRADEOS_RESEARCH_CATALOG,
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
    expect(EXPANDED_ASSEMBLY_CATALOG).toHaveLength(102);
    expect(EXPANDED_ASSEMBLY_CATALOG.slice(0, 14)).toEqual(ASSEMBLY_CATALOG);
    expect(new Set(EXPANDED_ASSEMBLY_CATALOG.map((item) => item.id)).size).toBe(102);
    expect(new Set(EXPANDED_ASSEMBLY_CATALOG.map((item) => item.code)).size).toBe(102);
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
