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
