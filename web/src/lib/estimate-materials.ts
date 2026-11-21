import type { EstimateLineItem } from "./api";

type SourceLine = Pick<EstimateLineItem, "description" | "quantity" | "unitOfMeasure" | "section" | "costType" | "assemblyId">;

export interface CustomerMaterialRow {
  description: string;
  quantity: number;
  unitOfMeasure: string;
  section: string;
}

/** Strict display-only projection: no cost, totals or markup fields leave this helper. */
export function estimateMaterialsPreview(lines: readonly SourceLine[]) {
  const items: CustomerMaterialRow[] = [];
  let unexpandedAssemblyCount = 0;
  for (const line of lines) {
    if (line.assemblyId) {
      unexpandedAssemblyCount += 1;
      continue;
    }
    if (line.costType !== "material") continue;
    if (!Number.isFinite(line.quantity) || line.quantity <= 0 || !line.description.trim() || !line.unitOfMeasure.trim()) {
      return { items: [] as CustomerMaterialRow[], unexpandedAssemblyCount, requiresReview: true };
    }
    items.push({
      description: omitEmbeddedPrices(line.description),
      quantity: line.quantity,
      unitOfMeasure: omitEmbeddedPrices(line.unitOfMeasure),
      section: omitEmbeddedPrices(line.section || "Materials"),
    });
  }
  return { items, unexpandedAssemblyCount, requiresReview: false };
}

function omitEmbeddedPrices(value: string): string {
  return value.replace(/\$\s*\d[\d,]*(?:\.\d{1,2})?/g, "[price omitted]");
}
