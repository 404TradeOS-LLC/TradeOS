export interface CreateSupplierInput {
  orgId?: string;
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  apiIntegrationKey?: string;
}

export type UpdateSupplierInput = Partial<CreateSupplierInput>;

export interface SupplierDTO {
  id: string;
  orgId: string | null;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  // Write-only: the raw key is never returned once stored, only whether one is set.
  hasApiIntegrationKey: boolean;
  createdAt: Date;
  updatedAt: Date;
}
