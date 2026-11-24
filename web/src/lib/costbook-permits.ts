/** Pure helpers for Codes & Permits tasks and fee reviews (issue #946, TODO 5).
 * Server fetchers live in ./costbook-permits-api.ts so this module stays
 * directly runnable under the repo's node --test suite. */

export type PermitTaskKind = "permit" | "inspection";

export type PermitStatus =
  | "not_submitted"
  | "submitted"
  | "under_review"
  | "approved"
  | "denied"
  | "inspection_scheduled"
  | "inspection_passed"
  | "inspection_failed";

export interface PermitEvidenceItem {
  label: string;
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

export interface PermitTask {
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

export type FeeSource = "quoted" | "verified";
export type FeeReviewStatus = "pending" | "approved" | "rejected";

export interface FeeReview {
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
  /** Advisory only — true only for approved + explicitly selected CostItem. */
  mayAffectEstimate: boolean;
}

export const PERMIT_STATUS_LABELS: Record<PermitStatus, string> = {
  not_submitted: "Not submitted",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  denied: "Denied",
  inspection_scheduled: "Inspection scheduled",
  inspection_passed: "Inspection passed",
  inspection_failed: "Inspection failed",
};

export const FEE_REVIEW_STATUS_LABELS: Record<FeeReviewStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

export function formatFeeCents(feeCents: number | null, currency = "USD"): string {
  if (feeCents === null) return "No fee stated";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(feeCents / 100);
}

/** Permit status is explicit only — unknown values are never guessed. */
export function permitStatusLabel(status: string): string {
  return (PERMIT_STATUS_LABELS as Record<string, string>)[status] ?? "Unknown status";
}

export function feeReviewStatusLabel(status: string): string {
  return (FEE_REVIEW_STATUS_LABELS as Record<string, string>)[status] ?? "Unknown status";
}

export function normalizePermitsSearchParams(search: Record<string, string | string[] | undefined>): {
  projectId: string;
} {
  const raw = search.projectId;
  const projectId = typeof raw === "string" ? raw.trim() : "";
  return { projectId };
}
