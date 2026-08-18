import { PricingMode } from "./formulas";
import type { EstimateStatus } from "../../domain";

export interface EstimateQueueFilters {
  orgId: string;
  statuses?: EstimateStatus[];
  updatedAfter?: string;
  updatedBefore?: string;
  limit?: number;
  cursor?: string;
}

export interface EstimateQueueItemDTO {
  id: string;
  projectId: string;
  projectName: string;
  customerName: string | null;
  status: EstimateStatus;
  amount: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEstimateInput {
  orgId?: string;
  projectId: string;
  overheadPct?: number;
}

export interface AddLineItemInput {
  estimateId: string;
  orgId?: string;
  costItemId?: string;
  assemblyId?: string;
  quantity: number;
  description?: string;
  sourceKey?: string;
}

export interface SetPricingModeInput {
  estimateId: string;
  orgId?: string;
  mode: PricingMode;
  markupPct?: number;
  targetMarginPct?: number;
}

export interface EstimateDTO {
  id: string;
  orgId: string | null;
  projectId: string;
  version: number;
  status: EstimateStatus;
  overheadPct: number;
  profitPct: number;
  targetMarginPct: number | null;
  subtotalCost: number;
  totalPrice: number;
}

export interface EstimateLineItemDTO {
  id: string;
  estimateId: string;
  /** Costbook provenance. Exactly one of costItemId/assemblyId is set for catalog-backed lines. */
  costItemId: string | null;
  assemblyId: string | null;
  description: string;
  quantity: number;
  unitOfMeasure: string;
  /** Historical snapshot captured when the catalog-backed line was created. */
  unitCost: number;
  /** Historical quantity × unit-cost snapshot; estimate recalculation reuses this persisted value. */
  lineCost: number;
  sortOrder: number;
  sourceKey: string | null;
}

export interface EstimateComparisonSideDTO {
  id: string;
  version: number;
  subtotalCost: number;
  totalPrice: number;
  marginPct: number;
  lineItemCount: number;
}

export interface EstimateComparisonDTO {
  base: EstimateComparisonSideDTO;
  candidate: EstimateComparisonSideDTO;
  delta: {
    subtotalCost: number;
    totalPrice: number;
    marginPct: number;
    lineItemCount: number;
  };
}
