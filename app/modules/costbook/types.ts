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

export interface CostbookEquipmentRecord {
  id: string;
  organizationId: string;
  name: string;
  ownershipCostPerHour: number;
  operatingCostPerHour: number;
  dailyRate: number | null;
  hourlyCost: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CostbookEquipmentDTO {
  id: string;
  organizationId: string;
  name: string;
  ownershipCostPerHour: number;
  operatingCostPerHour: number;
  dailyRate: number | null;
  hourlyCost: number;
  createdAt: string;
  updatedAt: string;
}

export interface CostbookEquipmentInput {
  name: string;
  ownershipCostPerHour: number;
  operatingCostPerHour: number;
  dailyRate?: number | null;
}

export type CostbookEquipmentUpdateInput = Partial<CostbookEquipmentInput>;
