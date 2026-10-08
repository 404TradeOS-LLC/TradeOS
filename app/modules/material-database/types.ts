export interface CreateMaterialInput {
  orgId?: string;
  sku?: string;
  name: string;
  unitOfMeasure: string;
  unitCost: number;
  wasteFactorPct?: number;
  supplierId?: string;
  omniclass23?: string;
  unspsc?: string;
}

export type UpdateMaterialInput = Partial<CreateMaterialInput>;

export interface MaterialDTO {
  id: string;
  orgId: string | null;
  sku: string | null;
  name: string;
  unitOfMeasure: string;
  unitCost: number;
  wasteFactorPct: number;
  supplierId: string | null;
  omniclass23: string | null;
  unspsc: string | null;
  lastPriceUpdate: Date | null;
}

export interface CalculateMaterialCostInput {
  materialId: string;
  quantity: number;
}

export interface CalculateMaterialCostOutput {
  baseCost: number;
  adjustedCost: number;
}

export interface BulkImportMaterialRow {
  sku?: string;
  name: string;
  unitOfMeasure: string;
  unitCost: number;
  wasteFactorPct?: number;
  supplierId?: string;
  omniclass23?: string;
  unspsc?: string;
}

export interface BulkImportResult {
  created: number;
  errors: { row: number; message: string }[];
}
