export interface CreateDivisionInput {
  orgId?: string;
  code: string;
  name: string;
  sortOrder?: number;
}

export interface CreateCategoryInput {
  divisionId: string;
  code: string;
  name: string;
  sortOrder?: number;
}

export interface CreateSubcategoryInput {
  categoryId: string;
  code: string;
  name: string;
  sortOrder?: number;
}

export interface CreateCostItemInput {
  orgId: string;
  subcategoryId: string;
  code: string;
  name: string;
  unitOfMeasure: string;
  productionRate?: number;
  laborRateId?: string;
  materialId?: string;
  equipmentId?: string;
  subcontractorId?: string;
  notes?: string;
}

export type UpdateCostItemInput = Partial<Omit<CreateCostItemInput,
  "orgId" | "subcategoryId" | "productionRate" | "laborRateId" | "materialId" | "equipmentId" | "subcontractorId"
>> & {
  productionRate?: number | null;
  laborRateId?: string | null;
  materialId?: string | null;
  equipmentId?: string | null;
  subcontractorId?: string | null;
  isActive?: boolean;
};

export interface CostItemDTO {
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
}

export interface UnitCostBreakdown {
  laborCostPerUnit: number;
  materialCostPerUnit: number;
  equipmentCostPerUnit: number;
  totalUnitCost: number;
}

/**
 * Per-resolution assumption overrides (DEV-17 S10). Passed by the assemblies
 * service from an installed assembly's stored overrides; never persisted on
 * the CostItem itself. wasteFactorPct replaces the mapped Material's own
 * waste % on the material leg; productionRateFactor multiplies the mapped
 * CostItem's productionRate on the labor/equipment legs.
 */
export interface UnitCostOverrides {
  wasteFactorPct?: number;
  productionRateFactor?: number;
}

export interface BulkImportCostItemRow {
  subcategoryId: string;
  code: string;
  name: string;
  unitOfMeasure: string;
  productionRate?: number;
  laborRateId?: string;
  materialId?: string;
  equipmentId?: string;
}

export interface BulkImportResult {
  created: number;
  errors: { row: number; message: string }[];
}
