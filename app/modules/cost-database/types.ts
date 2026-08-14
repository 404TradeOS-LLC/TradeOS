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
  orgId?: string;
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
