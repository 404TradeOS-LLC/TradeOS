import type { InvoiceStatus } from "../../domain";

export interface InvoiceQueueFilters {
  orgId: string;
  statuses?: InvoiceStatus[];
  sent?: boolean;
  overdue?: boolean;
  partiallyPaid?: boolean;
  unpaid?: boolean;
  updatedAfter?: string;
  updatedBefore?: string;
  limit?: number;
  cursor?: string;
}

export interface InvoiceQueueItemDTO {
  id: string;
  documentNumber: number;
  projectId: string;
  projectName: string;
  customerName: string | null;
  status: InvoiceStatus;
  amount: number;
  paidAmount: number;
  balanceDue: number;
  dueDate: string | null;
  updatedAt: string;
}

export interface InvoiceLineItemInput {
  description: string;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  /** Customer-facing allocated line total when created from an estimate. */
  lineTotal?: number;
}

export interface CreateInvoiceInput {
  orgId: string;
  actorUserId?: string;
  actorRole?: string;
  projectId: string;
  estimateId?: string;
  proposalId?: string;
  type?: "full" | "progress";
  percentComplete?: number;
  dueDate?: string;
  lineItems?: InvoiceLineItemInput[];
}

export interface InvoiceLineItemDTO {
  id: string;
  description: string;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  lineTotal: number;
  sortOrder: number;
}

export interface InvoiceDeliveryDTO {
  id: string;
  eventType: string;
  deliveryChannel: string;
  recipientEmail: string | null;
  actorUserId: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
  createdAt: string;
}

export interface InvoicePaymentDTO {
  id: string;
  amount: number;
  paymentDate: Date;
  method: string;
  createdAt: Date;
}

export interface InvoiceDTO {
  id: string;
  projectId: string;
  estimateId: string | null;
  proposalId: string | null;
  invoiceNumber: number;
  type: string;
  status: string;
  percentComplete: number | null;
  amount: number;
  subtotal: number;
  taxPct: number;
  taxAmount: number;
  dueDate: Date | null;
  sentAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  paidAmount: number;
  balanceDue: number;
  payments: InvoicePaymentDTO[];
  deliveries: InvoiceDeliveryDTO[];
}

export interface InvoiceDocument {
  buffer: Buffer;
  filename: string;
  contentType: string;
}
