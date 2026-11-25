import { ASSEMBLY_RECIPE_HISTORY, recipeStructure } from "../modules/assemblies-database/catalog";
import { getExpandedCatalogTemplate, EXPANDED_ASSEMBLY_CATALOG } from "../modules/assemblies-database/tradeosCatalogAdapter";
import { assessRecipeUpgrade } from "../modules/assemblies-database/recipeUpgrade";

const recipe = getExpandedCatalogTemplate("site-excavation")!;
const previous = recipeStructure(recipe);
const costItem = {
  id: "item", orgId: "tenant", name: "Crew", code: "CREW", isActive: true,
  unitOfMeasure: "CY", equipmentId: "equipment", laborRateId: null, materialId: null, subcontractorId: null,
};
const row = { id: "row", recipeComponentKey: "excavation", quantityPerUnit: 1, costItem };

it("requires consecutive structural revisions and a published structure for every current recipe", () => {
  for (const entry of EXPANDED_ASSEMBLY_CATALOG) {
    const history = ASSEMBLY_RECIPE_HISTORY[entry.id]!;
    expect(entry.version).toBe(history.length);
    expect(history.at(-1)).toEqual(recipeStructure(entry));
    for (let rev = 1; rev < history.length; rev += 1) {
      expect(history[rev]).not.toEqual(history[rev - 1]);
    }
  }
});

it("ignores editorial, provenance, order, and mapping-set ordering changes", () => {
  const editorial = {
    ...recipe,
    description: "Edited description",
    name: "Edited name",
    evidenceRefs: ["new evidence"],
    components: recipe.components.map((component) => ({
      ...component, label: "Edited label", help: "Edited help",
      allowedCostItemKinds: [...component.allowedCostItemKinds].reverse(),
    })).reverse(),
  };
  expect(recipeStructure(editorial)).toEqual(previous);
});

it("detects additions, removals, quantities, mapping contracts and measurement changes", () => {
  const excavation = recipe.components[0];
  const target = {
    ...recipe,
    measurementBasis: "Loose cubic yards",
    components: [
      { ...excavation, quantityPerUnit: 2 },
      { ...excavation, key: "finish", compatibleUnits: ["EA" as const] },
    ],
  };
  const diff = assessRecipeUpgrade(previous, target, {
    orgId: "tenant", unitOfMeasure: "CY", items: [row],
  });
  expect(diff.measurement).toMatchObject({ fromBasis: recipe.measurementBasis, toBasis: target.measurementBasis });
  expect(diff.changes.map(({ key, change, mapping }) => [key, change, mapping])).toEqual([
    ["excavation", "changed", "preserved"], ["haul", "removed", "removed"], ["finish", "added", "needed"],
  ]);
  const incompatible = assessRecipeUpgrade(previous, {
    ...recipe, components: [{ ...excavation, compatibleUnits: ["EA"] }, recipe.components[1]],
  }, { orgId: "tenant", unitOfMeasure: "CY", items: [row] });
  expect(incompatible.changes[0]).toMatchObject({ change: "changed", mapping: "breaks", costItem: { id: row.costItem.id } });
});

it("blocks an installed component without verifiable slot identity", () => {
  const diff = assessRecipeUpgrade(previous, recipe, {
    orgId: "tenant", unitOfMeasure: "CY", items: [{ ...row, recipeComponentKey: null }],
  });
  expect(diff.blockers).toHaveLength(1);
  expect(diff.changes[0].mapping).toBe("needed");
});
