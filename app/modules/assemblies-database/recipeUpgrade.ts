import { assessCatalogComponentMapping, recipeStructure, type CatalogMappingCandidate, type RecipeStructure } from "./catalog";

type ComponentStructure = RecipeStructure["components"][string];

type MappedCostItem = CatalogMappingCandidate & {
  orgId: string | null;
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

export interface InstalledRecipeItem {
  id: string;
  recipeComponentKey: string | null;
  quantityPerUnit: number;
  costItem: MappedCostItem | null;
}

export function assessRecipeUpgrade(
  previous: RecipeStructure,
  target: Parameters<typeof recipeStructure>[0],
  installed: { orgId: string; unitOfMeasure: string; items: InstalledRecipeItem[] },
) {
  const next = recipeStructure(target);
  const previousKeys = Object.keys(previous.components);

  const rowsByKey = new Map<string, InstalledRecipeItem>();
  const blockers: string[] = [];
  for (const item of installed.items) {
    const key = item.recipeComponentKey;
    if (!key || !Object.hasOwn(previous.components, key) || rowsByKey.has(key)) {
      if (!blockers.length) blockers.push("An installed component has no verified catalog slot. Remove the unverified row in the assembly editor to upgrade — removing it drops that component and its installed Cost Item mapping from the assembly.");
      continue;
    }
    rowsByKey.set(key, item);
  }

  const targetByKey = new Map(target.components.map((component) => [component.key, component]));
  const changes = [...new Set([...previousKeys, ...targetByKey.keys()])].map((key) => {
    const before = Object.hasOwn(previous.components, key) ? previous.components[key] : null;
    const component = targetByKey.get(key) ?? null;
    const after = component ? next.components[key] : null;
    const item = rowsByKey.get(key);
    const costItem = item?.costItem?.orgId === installed.orgId ? item.costItem : null;
    const reasons = !component ? [] :
      !costItem || !costItem.isActive ? ["Select an active Cost Item from this organization."] :
      assessCatalogComponentMapping(component, costItem).reasons;
    const change = !before ? "added" : !after ? "removed" :
      JSON.stringify(before) !== JSON.stringify(after) || item?.quantityPerUnit !== roundedQuantity(before)
        ? "changed" : "unchanged";
    const mapping = !component ? "removed" : reasons.length ? (costItem ? "breaks" : "needed") : "preserved";
    return {
      key, label: component?.label ?? costItem?.name ?? key,
      change, mapping, reasons, component, before, after,
      installedQuantity: item?.quantityPerUnit ?? null,
      costItem: costItem ? { id: costItem.id, name: costItem.name, code: costItem.code } : null,
    } as const;
  });
  return {
    rowsByKey,
    blockers,
    changes,
    measurement: {
      fromUnit: installed.unitOfMeasure,
      toUnit: next.unitOfMeasure,
      fromBasis: previous.measurementBasis,
      toBasis: next.measurementBasis,
    },
  };
}

function roundedQuantity(component: ComponentStructure) {
  return Number(component.quantityPerUnit.toFixed(4));
}
