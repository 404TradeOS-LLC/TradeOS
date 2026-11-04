import { estimateCostTypes } from "../estimate-engine/types";

// Use the estimate vocabulary for actual cost categories, not a parallel taxonomy.
export const expenseCategories = estimateCostTypes;
export type ExpenseCategory = (typeof expenseCategories)[number];

export const expensePaymentResponsibilities = ["contractor", "customer"] as const;
export type ExpensePaymentResponsibility = (typeof expensePaymentResponsibilities)[number];

export type ReceiptContentType = "image/png" | "image/jpeg" | "application/pdf";

export interface JobExpenseDTO {
  id: string;
  jobId: string;
  orgId: string;
  amountCents: number;
  currency: "USD";
  description: string;
  paymentResponsibility: ExpensePaymentResponsibility;
  category: ExpenseCategory;
  vendor: string;
  receiptNote: string;
  receiptStoragePath: string | null;
  receiptFileName: string | null;
  receiptContentType: ReceiptContentType | null;
  receiptSizeBytes: number | null;
  incurredOn: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  voidedAt: string | null;
  voidedById: string | null;
  voidReason: string;
}

export interface CreateJobExpenseInput {
  orgId: string;
  jobId: string;
  actorUserId: string;
  amountCents: number;
  currency?: "USD";
  description?: string;
  idempotencyKey?: string;
  category: ExpenseCategory;
  paymentResponsibility?: ExpensePaymentResponsibility;
  vendor?: string;
  receiptNote?: string;
  incurredOn: Date;
}

export interface UpdateJobExpenseInput {
  id: string;
  orgId: string;
  jobId?: string;
  actorUserId?: string;
  amountCents?: number;
  description?: string;
  paymentResponsibility?: ExpensePaymentResponsibility;
  category?: ExpenseCategory;
  vendor?: string;
  receiptNote?: string;
  incurredOn?: Date;
}

export interface AttachJobExpenseReceiptInput {
  id: string;
  orgId: string;
  jobId: string;
  actorUserId?: string;
  receiptStoragePath: string;
  receiptFileName: string;
  receiptContentType: ReceiptContentType;
  receiptSizeBytes: number;
}

export interface JobExpenseEventDTO {
  id: string;
  expenseId: string;
  eventType: "created" | "updated" | "receipt_linked" | "voided";
  actorUserId: string;
  createdAt: string;
  payload: unknown;
}

export interface JobCostSummaryDTO {
  jobId: string;
  projectId: string;
  expenseCount: number;
  actualCents: number;
  customerPaidCents: number;
  byCategoryCents: Record<string, number>;
  estimatedCents: number | null;
  estimateId: string | null;
  varianceCents: number | null;
  // Recorded job costs cannot by themselves establish earned revenue/profit.
  recognizedRevenueCents: null;
  profitCents: null;
  profitStatus: "revenue_not_attributed_to_job";
}
