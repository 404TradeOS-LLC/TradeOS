import { getAssemblyCatalogTemplate } from "../modules/assemblies-database/catalog";
import {
  suggestBulkMapping,
  type MappingReuseCandidate,
} from "../modules/assemblies-database/mappingReuse";

function candidate(overrides: Partial<MappingReuseCandidate> & { id: string }): MappingReuseCandidate {
  return {
    code: "ITEM",
    name: "Item",
    unitOfMeasure: "EA",
    subcategoryId: "sub-1",
    productionRate: null,
    isActive: true,
    laborRateId: null,
    materialId: null,
    equipmentId: null,
    subcontractorId: null,
    ...overrides,
  };
}

describe("suggestBulkMapping (DEV-17 S9)", () => {
  const siteExcavation = getAssemblyCatalogTemplate("site-excavation")!;
  const slab = getAssemblyCatalogTemplate("slab-four-inch")!;
  const source = { id: "assembly-source", name: "Source assembly" };

  const excavator = candidate({
    id: "ci-exc",
    code: "EXC",
    name: "Excavation crew",
    unitOfMeasure: "CY",
    equipmentId: "eq-1",
  });
  const haulage = candidate({
    id: "ci-haul",
    code: "HAUL",
    name: "Haul allowance",
    unitOfMeasure: "CY",
  });
  const readyMix = candidate({
    id: "ci-conc",
    code: "CONC",
    name: "Ready-mix concrete",
    unitOfMeasure: "CY",
    materialId: "mat-1",
  });

  it("maps compatible source items to the matching slots, in source order", () => {
    const result = suggestBulkMapping(siteExcavation, source, [excavator, haulage]);
    expect(result.templateId).toBe("site-excavation");
    expect(result.sourceAssemblyId).toBe("assembly-source");
    expect(result.mappedCount).toBe(2);
    expect(result.unmappedComponentKeys).toEqual([]);
    expect(result.suggestions).toEqual([
      expect.objectContaining({ componentKey: "excavation", costItemId: "ci-exc", costItemCode: "EXC", compatible: true, reasons: [] }),
      expect.objectContaining({ componentKey: "haul", costItemId: "ci-haul", costItemCode: "HAUL", compatible: true, reasons: [] }),
    ]);
  });

  it("skips incompatible candidates even when they come first", () => {
    const wrongUnit = candidate({ id: "ci-lf", code: "LF-ITEM", name: "LF item", unitOfMeasure: "LF", materialId: "mat-2" });
    const result = suggestBulkMapping(siteExcavation, source, [wrongUnit, excavator, haulage]);
    expect(result.mappedCount).toBe(2);
    expect(result.suggestions[0].costItemId).toBe("ci-exc");
    expect(result.suggestions[1].costItemId).toBe("ci-haul");
  });

  it("never suggests the same Cost Item for two slots of one recipe", () => {
    const result = suggestBulkMapping(slab, source, [readyMix]);
    expect(result.mappedCount).toBe(1);
    expect(result.suggestions[0]).toEqual(expect.objectContaining({ componentKey: "base", costItemId: "ci-conc" }));
    expect(result.suggestions[1]).toEqual(expect.objectContaining({
      componentKey: "concrete",
      costItemId: null,
      compatible: false,
      reasons: ["CONC is already mapped to Compacted granular base in this recipe"],
    }));
    expect(result.unmappedComponentKeys).toEqual(["concrete", "reinforcing", "place-finish"]);
  });

  it("takes the first compatible candidate when several match", () => {
    const secondMix = candidate({ id: "ci-conc-2", code: "CONC2", name: "Ready-mix alt", unitOfMeasure: "CY", materialId: "mat-2" });
    const result = suggestBulkMapping(slab, source, [readyMix, secondMix]);
    expect(result.mappedCount).toBe(2);
    expect(result.suggestions[0].costItemId).toBe("ci-conc");
    expect(result.suggestions[1].costItemId).toBe("ci-conc-2");
    expect(result.unmappedComponentKeys).toEqual(["reinforcing", "place-finish"]);
  });

  it("leaves slots unmapped with a reason when nothing in the source fits", () => {
    const laborOnly = candidate({ id: "ci-lab", code: "LAB", name: "Labor", unitOfMeasure: "HR", laborRateId: "lr-1" });
    const result = suggestBulkMapping(siteExcavation, source, [laborOnly]);
    expect(result.mappedCount).toBe(0);
    expect(result.unmappedComponentKeys).toEqual(["excavation", "haul"]);
    expect(result.suggestions.every((suggestion) => suggestion.costItemId === null && !suggestion.compatible)).toBe(true);
    expect(result.suggestions[0].reasons).toEqual(["No compatible Cost Item in the reused mapping for this slot"]);
  });

  it("returns all slots unmapped for an empty source mapping", () => {
    const result = suggestBulkMapping(siteExcavation, source, []);
    expect(result.mappedCount).toBe(0);
    expect(result.unmappedComponentKeys).toEqual(["excavation", "haul"]);
  });

  it("carries the Cost Item record fields the install UI needs for its compatibility re-check", () => {
    const result = suggestBulkMapping(siteExcavation, source, [excavator]);
    expect(result.suggestions[0]).toEqual(expect.objectContaining({
      costItemSubcategoryId: "sub-1",
      costItemProductionRate: null,
      costItemIsActive: true,
      // The pure suggester is org-agnostic; the service fills the org in.
      orgId: null,
      equipmentId: "eq-1",
    }));
  });
});
