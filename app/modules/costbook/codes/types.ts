/**
 * Codes & Permits execution types (issue #946, TODO 5).
 *
 * Permit status is EXPLICIT ONLY. The eight values below are the whole
 * vocabulary; no service, controller, Athena tool, or UI in this slice
 * may infer a status from an address, a source link, an AI message, or
 * any other signal. "No source link or AI message counts as a permit."
 */
export const permitTaskKinds = ["permit", "inspection"] as const;
export type PermitTaskKind = (typeof permitTaskKinds)[number];

export const permitStatuses = [
  "not_submitted",
  "submitted",
  "under_review",
  "approved",
  "denied",
  "inspection_scheduled",
  "inspection_passed",
  "inspection_failed",
] as const;
export type PermitStatus = (typeof permitStatuses)[number];

export function isPermitStatus(value: unknown): value is PermitStatus {
  return typeof value === "string" && (permitStatuses as readonly string[]).includes(value);
}

export function isPermitTaskKind(value: unknown): value is PermitTaskKind {
  return typeof value === "string" && (permitTaskKinds as readonly string[]).includes(value);
}

/** Official evidence attachment reference only — never full code text. */
export interface PermitEvidenceItem {
  /** Human-readable label, e.g. "County-stamped application receipt". */
  label: string;
  /** Official reference: permit-office receipt number, filing ID, or URL. */
  reference: string;
  addedBy: string;
  addedAt: string;
}

export interface PermitHistoryEntry {
  action: string;
  by: string;
  at: string;
  detail?: string;
}

export interface CodesPermitTaskDTO {
  id: string;
  orgId: string;
  projectId: string;
  assessmentId: string | null;
  taskKind: PermitTaskKind;
  title: string;
  permitNumber: string | null;
  permitStatus: PermitStatus;
  assigneeId: string | null;
  dueDate: string | null;
  evidence: PermitEvidenceItem[];
  history: PermitHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePermitTaskInput {
  orgId: string;
  role: string;
  actorId: string;
  projectId: string;
  assessmentId?: string | null;
  taskKind: PermitTaskKind;
  title: string;
  permitNumber?: string | null;
  assigneeId?: string | null;
  dueDate?: Date | null;
}

export interface UpdatePermitTaskInput {
  orgId: string;
  role: string;
  actorId: string;
  taskId: string;
  expectedUpdatedAt: Date;
  title?: string;
  permitNumber?: string | null;
  /** Explicit status only; never inferred by the service. */
  permitStatus?: PermitStatus;
  assigneeId?: string | null;
  dueDate?: Date | null;
  /** Appended, never replaced wholesale, by the service. */
  addEvidence?: PermitEvidenceItem[];
}

export interface SubmitPermitTaskInput {
  orgId: string;
  role: string;
  actorId: string;
  taskId: string;
  expectedUpdatedAt: Date;
  /** The explicit confirm step. Submitting without confirm: true is a 400. */
  confirm: boolean;
}

export const feeSources = ["quoted", "verified"] as const;
export type FeeSource = (typeof feeSources)[number];

export const feeReviewStatuses = ["pending", "approved", "rejected"] as const;
export type FeeReviewStatus = (typeof feeReviewStatuses)[number];

export function isFeeSource(value: unknown): value is FeeSource {
  return typeof value === "string" && (feeSources as readonly string[]).includes(value);
}

export interface CodesFeeReviewDTO {
  id: string;
  orgId: string;
  projectId: string;
  estimateId: string | null;
  assessmentId: string | null;
  feeCents: number | null;
  feeSource: FeeSource | null;
  currency: string;
  status: FeeReviewStatus;
  costItemId: string | null;
  note: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Advisory only, computed — never persisted as an estimate change.
   * True only for an approved fee with an explicitly selected CostItem.
   * The cost effect itself goes through the existing explicit CostItem
   * write semantics; this workflow never writes to an estimate.
   */
  mayAffectEstimate: boolean;
}

export interface CreateFeeReviewInput {
  orgId: string;
  role: string;
  actorId: string;
  projectId: string;
  estimateId?: string | null;
  assessmentId?: string | null;
  feeCents?: number | null;
  feeSource?: FeeSource | null;
  currency?: string;
  note?: string | null;
}

export interface ReviewFeeInput {
  orgId: string;
  role: string;
  actorId: string;
  feeReviewId: string;
  expectedUpdatedAt: Date;
  decision: "approved" | "rejected";
  note?: string | null;
}

export interface SelectFeeCostItemInput {
  orgId: string;
  role: string;
  actorId: string;
  feeReviewId: string;
  expectedUpdatedAt: Date;
  /** The ONLY path that sets costItemId. Explicit selection, never defaulted. */
  costItemId: string;
}
