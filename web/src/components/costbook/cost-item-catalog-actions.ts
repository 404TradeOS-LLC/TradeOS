export type CostItemCatalogRecord = {
  id: string;
  orgId: string | null;
  subcategoryId: string;
  code: string;
  name: string;
  unitOfMeasure: string;
  productionRate: number | null;
  laborRateId: string | null;
  materialId: string | null;
  equipmentId: string | null;
  subcontractorId: string | null;
  isActive: boolean;
};

export type CostItemCreatePayload = {
  subcategoryId: string;
  code: string;
  name: string;
  unitOfMeasure: string;
  productionRate?: number;
  laborRateId?: string;
  materialId?: string;
  equipmentId?: string;
};

export type CostItemUpdatePayload = Omit<CostItemCreatePayload, "subcategoryId" | "laborRateId" | "materialId" | "equipmentId"> & {
  laborRateId?: string | null;
  materialId?: string | null;
  equipmentId?: string | null;
};
export type CostItemCatalogFetcher = <T>(path: string, init?: RequestInit) => Promise<T>;

export function createCostItemCatalogRecord(fetcher: CostItemCatalogFetcher, payload: CostItemCreatePayload) {
  return fetcher<CostItemCatalogRecord>("/costbook/cost-items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateCostItemCatalogRecord(fetcher: CostItemCatalogFetcher, id: string, payload: CostItemUpdatePayload) {
  return fetcher<CostItemCatalogRecord>(`/costbook/cost-items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deactivateCostItemCatalogRecord(fetcher: CostItemCatalogFetcher, id: string) {
  return fetcher<void>(`/costbook/cost-items/${id}`, { method: "DELETE" });
}
