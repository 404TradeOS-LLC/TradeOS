// Pure decision logic for the job-scoped Athena contractor route (DES-4,
// Option A, canonical Figma frame 289:2). Decided roles: assigned
// technician + dispatcher + owner + admin.
//
// Deliberately self-contained with zero imports, like
// web/src/lib/athena-state.ts: a `node --test` unit test imports this module
// directly, and relative imports (including the OPERATOR_ROLES set in
// athena-state.ts) break under plain Node's TS runner. The owner/admin set
// below mirrors athena-state.ts's OPERATOR_ROLES; if that set changes, this
// one must change with it — the contract test pins both.
//
// This module decides presentation gating only. The backend remains the
// authority: the job note write goes through POST /api/v1/jobs/:jobId/notes,
// which requires an authenticated session and scoped job access with forced
// RLS, and the Athena kernel still enforces its own tool permissions. A
// "granted" here never grants a backend capability on its own.

export type JobAthenaAccessReason = "granted" | "role_not_permitted" | "technician_not_assigned";

export interface JobAthenaAccess {
  granted: boolean;
  reason: JobAthenaAccessReason;
}

// Roles that may use the job-scoped Athena route for any job in their org.
const JOB_ATHENA_MANAGER_ROLES = new Set(["owner", "admin", "dispatcher"]);

// Owner/admin only — the same set as OPERATOR_ROLES in athena-state.ts,
// which also gates the /athena/approvals review queue (backend
// requireRoles(["owner", "admin"]) and the approvals page's own gate).
const ATHENA_APPROVAL_REVIEWER_ROLES = new Set(["owner", "admin"]);

/**
 * Decides whether the current actor may use the job-scoped Athena route for
 * one job. Owners, admins, and dispatchers may use it for any job. A
 * technician may use it only for a job they are assigned to (matched by user
 * id against the job's assigned technicians). Every other role is denied.
 */
export function canUseJobAthena(
  role: string | null | undefined,
  currentUserId: string | null | undefined,
  assignedTechnicianUserIds: readonly string[]
): JobAthenaAccess {
  if (role != null && JOB_ATHENA_MANAGER_ROLES.has(role)) {
    return { granted: true, reason: "granted" };
  }
  if (role === "technician") {
    if (currentUserId != null && currentUserId.length > 0 && assignedTechnicianUserIds.includes(currentUserId)) {
      return { granted: true, reason: "granted" };
    }
    return { granted: false, reason: "technician_not_assigned" };
  }
  return { granted: false, reason: "role_not_permitted" };
}

/**
 * Whether the current actor may review Athena approvals (the queue an
 * `awaiting_approval` kernel result points at). Owner/admin only.
 */
export function canReviewAthenaApprovals(role: string | null | undefined): boolean {
  return role != null && ATHENA_APPROVAL_REVIEWER_ROLES.has(role);
}
