export type CostbookQueryOrder = "asc" | "desc";

export interface CostbookListParams {
  limit?: number;
  cursor?: string;
  q?: string;
  sort?: string;
  order?: CostbookQueryOrder;
  active?: boolean;
  isTemplate?: boolean;
  divisionId?: string;
  categoryId?: string;
  subcategoryId?: string;
  supplierId?: string;
  trade?: string;
  componentType?: "labor" | "material" | "equipment" | "subcontractor" | "none";
}

export function buildCostbookQuery(params: CostbookListParams = {}): string {
  const search = new URLSearchParams();
  const keys: Array<keyof CostbookListParams> = ["limit", "cursor", "q", "sort", "order", "active", "isTemplate", "divisionId", "categoryId", "subcategoryId", "supplierId", "trade", "componentType"];
  for (const key of keys) {
    const value = params[key];
    if (value === undefined || value === "") continue;
    search.set(key, typeof value === "boolean" ? String(value) : String(value));
  }
  const value = search.toString();
  return value ? `?${value}` : "";
}
