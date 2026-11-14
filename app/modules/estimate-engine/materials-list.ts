import type { EstimateLineItemDTO } from "./types";

type MaterialSourceLine = Pick<
  EstimateLineItemDTO,
  "description" | "quantity" | "unitOfMeasure" | "section" | "costType" | "assemblyId"
>;

export interface EstimateShoppingItem {
  description: string;
  quantity: number;
  unitOfMeasure: string;
  section: string;
}

export interface EstimateShoppingList {
  items: EstimateShoppingItem[];
  unexpandedAssemblyCount: number;
}

/** Projects saved material lines into a strict, price-free customer document shape. */
export function buildEstimateMaterialsList(lines: readonly MaterialSourceLine[]): EstimateShoppingList {
  const items: EstimateShoppingItem[] = [];
  let unexpandedAssemblyCount = 0;

  for (const line of lines) {
    // An assembly can include labor, equipment and material; its top-level
    // quantity is not a reliable takeoff of purchasable material.
    if (line.assemblyId) {
      unexpandedAssemblyCount += 1;
      continue;
    }
    if (line.costType !== "material") continue;
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new Error("Material quantity must be verified before creating a shopping list");
    }
    const description = redactPriceText(line.description).trim();
    const unitOfMeasure = redactPriceText(line.unitOfMeasure).trim();
    if (!description || !unitOfMeasure) {
      throw new Error("Material description and unit must be verified before creating a shopping list");
    }
    items.push({
      description,
      quantity: line.quantity,
      unitOfMeasure,
      section: redactPriceText(line.section || "Materials").trim() || "Materials",
    });
  }

  return { items, unexpandedAssemblyCount };
}

// A user-authored description may itself contain a retail price. It must not
// bypass the strict omission of internal unit-cost and line-cost fields.
function redactPriceText(value: string): string {
  return value.replace(/\$\s*\d[\d,]*(?:\.\d{1,2})?/g, "[price omitted]");
}
