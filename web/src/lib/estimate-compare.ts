import type { EstimateDetail, EstimateLineItem } from "@/lib/api";

export interface EstimateComparisonRow {
  key: string;
  description: string;
  unitOfMeasure: string;
  left: EstimateLineItem | null;
  right: EstimateLineItem | null;
}

function lineItemKey(lineItem: Pick<EstimateLineItem, "costItemId" | "assemblyId" | "description" | "unitOfMeasure">) {
  if (lineItem.costItemId) return `cost:${lineItem.costItemId}`;
  if (lineItem.assemblyId) return `assembly:${lineItem.assemblyId}`;
  return `desc:${lineItem.description}:${lineItem.unitOfMeasure}`;
}

export function buildEstimateComparison(left: EstimateDetail, right: EstimateDetail): EstimateComparisonRow[] {
  const rows = new Map<string, EstimateComparisonRow>();

  for (const lineItem of left.lineItems) {
    const key = lineItemKey(lineItem);
    rows.set(key, {
      key,
      description: lineItem.description,
      unitOfMeasure: lineItem.unitOfMeasure,
      left: lineItem,
      right: null,
    });
  }

  for (const lineItem of right.lineItems) {
    const key = lineItemKey(lineItem);
    const existing = rows.get(key);
    if (existing) {
      existing.right = lineItem;
      continue;
    }

    rows.set(key, {
      key,
      description: lineItem.description,
      unitOfMeasure: lineItem.unitOfMeasure,
      left: null,
      right: lineItem,
    });
  }

  return [...rows.values()].sort((a, b) => {
    const leftOrder = a.left?.sortOrder ?? a.right?.sortOrder ?? 0;
    const rightOrder = b.left?.sortOrder ?? b.right?.sortOrder ?? 0;
    return leftOrder - rightOrder;
  });
}

export function resolveDefaultComparisonIds(estimates: Array<{ id: string; version: number }>) {
  const sorted = [...estimates].sort((a, b) => a.version - b.version);
  if (sorted.length < 2) return { leftId: sorted[0]?.id ?? null, rightId: sorted[0]?.id ?? null };

  const right = sorted[sorted.length - 1];
  const left = sorted[sorted.length - 2];
  return { leftId: left.id, rightId: right.id };
}
