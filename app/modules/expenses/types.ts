import { estimateCostTypes } from "../estimate-engine/types";

// Expense categories deliberately reuse the estimate cost-type vocabulary so
// actuals roll up against estimate line items without a second taxonomy.
export const expenseCategories = estimateCostTypes;
export type ExpenseCategory = (typeof expenseCategories)[number];

export const expensePaymentResponsibilities = ["contractor", "customer"] as const;
export type ExpensePaymentResponsibility = (typeof expensePaymentResponsibilities)[number];

export interface JobExpenseDTO {
  id: string;
  jobId: string;
  orgId: string;
  amountCents: number;
  paymentResponsibility: ExpensePaymentResponsibility;
  category: ExpenseCategory;
  vendor: string;
  receiptNote: string;
  incurredOn: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJobExpenseInput {
  orgId: string;
  jobId: string;
  actorUserId: string;
  amountCents: number;
  paymentResponsibility?: ExpensePaymentResponsibility;
  category: ExpenseCategory;
  vendor?: string;
  receiptNote?: string;
  incurredOn: Date;
}

export interface UpdateJobExpenseInput {
  id: string;
  orgId: string;
  amountCents?: number;
  paymentResponsibility?: ExpensePaymentResponsibility;
  category?: ExpenseCategory;
  vendor?: string;
  receiptNote?: string;
  incurredOn?: Date;
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
}
