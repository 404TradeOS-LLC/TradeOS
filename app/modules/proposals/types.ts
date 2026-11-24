import type { ProposalStatus } from "../../domain";

export type ProposalSelectionStatus = "action_required" | "confirmed";

export interface ProposalSelectionDTO {
  id: string;
  proposalId: string;
  label: string;
  detail: string | null;
  status: ProposalSelectionStatus;
  dueDate: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalAllowanceDTO {
  id: string;
  proposalId: string;
  description: string;
  amount: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProposalSelectionInput {
  label: string;
  detail?: string | null;
  status?: ProposalSelectionStatus;
  dueDate?: string | null;
}

export interface UpdateProposalSelectionInput {
  label?: string;
  detail?: string | null;
  status?: ProposalSelectionStatus;
  dueDate?: string | null;
}

export interface CreateProposalAllowanceInput {
  description: string;
  amount: number;
}

export interface UpdateProposalAllowanceInput {
  description?: string;
  amount?: number;
}

export interface ProposalQueueFilters {
  orgId: string;
  statuses?: ProposalStatus[];
  sent?: boolean;
  viewed?: boolean;
  unsigned?: boolean;
  staleBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  limit?: number;
  cursor?: string;
}

export interface ProposalQueueItemDTO {
  id: string;
  projectId: string;
  projectName: string;
  customerName: string | null;
  status: ProposalStatus;
  amount: number | null;
  contractId: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  updatedAt: string;
}

export interface ProposalDeliveryDTO {
  id: string;
  proposalId: string;
  eventType: string;
  deliveryChannel: string;
  recipientEmail: string | null;
  actorUserId: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: Date;
  createdAt: Date;
}

export interface CreateProposalInput {
  orgId?: string;
  estimateId?: string;
  projectId?: string;
  companyName?: string;
  showLineItemDetail?: boolean;
  scopeOfWork?: string;
  assumptions?: string;
  exclusions?: string;
  timeline?: string;
  priceLow?: number | null;
  priceHigh?: number | null;
  finalPrice?: number | null;
  paymentScheduleJson?: unknown;
  termsAndConditions?: string;
}

export interface ProposalDTO {
  id: string;
  projectId: string;
  estimateId: string | null;
  status: ProposalStatus;
  companyName: string | null;
  showLineItemDetail: boolean;
  scopeOfWork: string | null;
  assumptions: string | null;
  exclusions: string | null;
  timeline: string | null;
  priceLow: number | null;
  priceHigh: number | null;
  finalPrice: number | null;
  paymentScheduleJson: unknown;
  pdfUrl: string | null;
  termsAndConditions: string | null;
  sentAt: Date | null;
  viewedAt: Date | null;
  respondedAt: Date | null;
  // DES-10-F7: portal approval record. signerName/signerEmail/signedAt are
  // set by a governed portal accept; declinedReason by a portal decline.
  // signatureDataUrl is the drawn signature (never a free-text field alone);
  // it is the customer's own signature on their own proposal, so the portal
  // may show it back, mirroring ContractDTO.
  signerName: string | null;
  signerEmail: string | null;
  signatureDataUrl: string | null;
  signedAt: Date | null;
  declinedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  deliveries: ProposalDeliveryDTO[];
  selections: ProposalSelectionDTO[];
  allowances: ProposalAllowanceDTO[];
  // Display-only sum of the allowance rows (Copperline section 04 total,
  // e.g. $2,800). This is NOT added to finalPrice: the proposal total
  // pipeline has no clean hook for allowance sums, and wiring it in is a
  // separate follow-up (see docs/modules/proposals.md).
  allowancesTotal: number;
}

export interface ProposalDraftPreviewDTO {
  companyName: string;
  normalizedJobType: string | null;
  confidenceScore: number | null;
  missingInfo: string[];
  aiQuestions: string[];
  scopeOfWork: string;
  assumptions: string;
  exclusions: string;
  timeline: string;
  priceLow: number | null;
  priceHigh: number | null;
  paymentSchedule: Array<{ label: string; amountPercent: number; notes?: string }>;
}
