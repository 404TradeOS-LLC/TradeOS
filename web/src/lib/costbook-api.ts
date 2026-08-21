import "server-only";
import { apiFetch } from "@/lib/api";
import { buildCostbookQuery, type CostbookListParams } from "@/lib/costbook-query";
import type { CatalogPage } from "@/lib/api";

export interface CostbookAssembly {
  id: string;
  orgId: string | null;
  code: string;
  name: string;
  unitOfMeasure: string;
  description: string | null;
  isTemplate: boolean;
  isActive: boolean;
}

export interface CostbookPriceHistory {
  materialChanges: Array<{
    id: string;
    materialId: string;
    materialName: string;
    oldUnitCost: number;
    newUnitCost: number;
    source: string;
    actorUserId: string | null;
    actorRole: string | null;
    createdAt: string;
  }>;
  estimateSnapshots: Array<{
    id: string;
    estimateId: string;
    sourceType: "cost_item" | "assembly";
    sourceId: string;
    description: string;
    quantity: number;
    unitOfMeasure: string;
    unitCost: number;
    lineCost: number;
    createdAt: string;
  }>;
}

export function listCostbookAssemblies(token: string, params: CostbookListParams = {}) {
  return apiFetch<CatalogPage<CostbookAssembly>>(`/api/v1/costbook/assemblies${buildCostbookQuery(params)}`, { token });
}

export interface CostbookPriceHistoryPage {
  materialChanges: CatalogPage<CostbookPriceHistory["materialChanges"][number]>;
  estimateSnapshots: CatalogPage<CostbookPriceHistory["estimateSnapshots"][number]>;
}

export function getCostbookPriceHistory(token: string, params: { limit?: number; materialCursor?: string; estimateCursor?: string } = {}) {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.materialCursor) query.set("materialCursor", params.materialCursor);
  if (params.estimateCursor) query.set("estimateCursor", params.estimateCursor);
  return apiFetch<CostbookPriceHistoryPage>(`/api/v1/costbook/price-history?${query.toString()}`, { token });
}
