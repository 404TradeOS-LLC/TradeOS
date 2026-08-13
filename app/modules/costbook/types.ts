export const costbookWorkspaceStatus = ["foundation", "active", "archived"] as const;
export type CostbookWorkspaceStatus = (typeof costbookWorkspaceStatus)[number];

export interface CostbookWorkspaceRecord {
  id: string;
  organizationId: string;
  status: CostbookWorkspaceStatus;
  setupState: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CostbookInventoryCounts {
  categories: number;
  costItems: number;
  laborRates: number;
  materials: number;
  equipment: number;
  assemblies: number;
}

export interface CostbookWorkspaceArea {
  id: "materials" | "labor" | "equipment" | "assemblies" | "pricing-rules" | "price-history";
  label: string;
  description: string;
  status: "existing_catalog" | "foundation_only" | "future";
}

export interface CostbookWorkspaceDTO {
  organizationId: string;
  initialized: boolean;
  status: CostbookWorkspaceStatus;
  permissions: {
    canRead: boolean;
    canWrite: boolean;
    canManage: boolean;
  };
  counts: CostbookInventoryCounts;
  areas: CostbookWorkspaceArea[];
}

export interface CostbookMaterialRecord {
  id: string;
  organizationId: string;
  sku: string | null;
  name: string;
  unitOfMeasure: string;
  unitCost: number;
  wasteFactorPct: number;
  supplierId: string | null;
  supplierName: string | null;
  lastPriceUpdate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CostbookMaterialDTO {
  id: string;
  organizationId: string;
  sku: string | null;
  name: string;
  unitOfMeasure: string;
  unitCost: number;
  wasteFactorPct: number;
  supplierId: string | null;
  supplierName: string | null;
  lastPriceUpdate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CostbookMaterialInput {
  sku?: string | null;
  name: string;
  unitOfMeasure: string;
  unitCost: number;
  wasteFactorPct?: number;
  supplierId?: string | null;
}

export type CostbookMaterialUpdateInput = Partial<CostbookMaterialInput>;

export interface CostbookLaborRateRecord {
  id: string;
  organizationId: string;
  role: string;
  description: string | null;
  hourlyCost: number;
  billRate: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CostbookLaborRateDTO {
  id: string;
  organizationId: string;
  role: string;
  description: string | null;
  hourlyCost: number;
  billRate: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CostbookLaborRateInput {
  role: string;
  description?: string | null;
  hourlyCost: number;
  billRate: number;
  active?: boolean;
}

export type CostbookLaborRateUpdateInput = Partial<CostbookLaborRateInput>;

export interface CostbookDivisionRecord {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
}

export interface CostbookDivisionDTO {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface CostbookDivisionInput {
  code: string;
  name: string;
  sortOrder?: number;
}

export type CostbookDivisionUpdateInput = Partial<CostbookDivisionInput> & { isActive?: boolean };

export interface CostbookCategoryRecord {
  id: string;
  divisionId: string;
  organizationId: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
}

export interface CostbookCategoryDTO {
  id: string;
  divisionId: string;
  organizationId: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface CostbookCategoryInput {
  divisionId: string;
  code: string;
  name: string;
  sortOrder?: number;
}

export type CostbookCategoryUpdateInput = Partial<Omit<CostbookCategoryInput, "divisionId">> & { isActive?: boolean };

export interface CostbookSubcategoryRecord {
  id: string;
  categoryId: string;
  organizationId: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
}

export interface CostbookSubcategoryDTO {
  id: string;
  categoryId: string;
  organizationId: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface CostbookSubcategoryInput {
  categoryId: string;
  code: string;
  name: string;
  sortOrder?: number;
}

export type CostbookSubcategoryUpdateInput = Partial<Omit<CostbookSubcategoryInput, "categoryId">> & { isActive?: boolean };
