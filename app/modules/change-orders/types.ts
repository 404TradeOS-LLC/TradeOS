export interface CreateChangeOrderInput {
  orgId?: string;
  projectId: string;
  estimateId?: string;
  description: string;
  scheduleImpactDays?: number;
}

export interface UpdateChangeOrderInput {
  orgId?: string;
  description?: string;
  scheduleImpactDays?: number | null;
}

export interface AddChangeOrderLineItemInput {
  orgId?: string;
  changeOrderId: string;
  costItemId?: string;
  description?: string;
  quantity: number;
  unitCost?: number;
}

export interface ChangeOrderDTO {
  id: string;
  projectId: string;
  estimateId: string | null;
  coNumber: number;
  description: string;
  status: string;
  amount: number;
  scheduleImpactDays: number | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeOrderLineItemDTO {
  id: string;
  changeOrderId: string;
  costItemId: string | null;
  description: string;
  quantity: number;
  unitCost: number;
  lineCost: number;
  sortOrder: number;
}
