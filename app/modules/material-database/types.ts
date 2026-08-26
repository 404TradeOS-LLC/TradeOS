export interface CreateMaterialInput {
  orgId?: string;
  sku?: string;
  name: string;
  unitOfMeasure: string;
  unitCost: number;
  wasteFactorPct?: number;
  supplierId?: string;
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
}

export interface BulkImportResult {
  created: number;
  errors: { row: number; message: string }[];
}
