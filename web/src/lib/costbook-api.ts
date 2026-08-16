import "server-only";
import { apiFetch } from "@/lib/api";

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

export function listCostbookAssemblies(token: string) {
  return apiFetch<CostbookAssembly[]>("/api/v1/costbook/assemblies", { token });
}

export function getCostbookPriceHistory(token: string, limit = 50) {
  return apiFetch<CostbookPriceHistory>(`/api/v1/costbook/price-history?limit=${limit}`, { token });
}
