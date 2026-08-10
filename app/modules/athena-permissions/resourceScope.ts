import type { CanonicalRole } from "../../domain";
import type { JobsService } from "../jobs/service";

// Job is the only entity with a real object-scope precedent
// (app/modules/athena-context-engine/providers/dispatchProvider.ts reuses
// the same JobsService/scopedJobAccessWhere()/jobs_select_policy RLS chain).
// This resolver delegates to JobsService.getById() rather than
// re-implementing scope logic - JobsService and the underlying RLS policy
// are already correctly scoped, and duplicating that here would risk
// drifting out of sync with it (the same rationale dispatchProvider.ts's own
// comment gives for not adding its own actor filter).
export interface AthenaJobResourceScopeResult {
  relationship: "member" | "assignee" | "none";
}

// owner/admin/dispatcher get org-wide "member" access to jobs without a
// lookup - RBAC_MATRIX's "Jobs and scheduling" row already grants those
// roles unscoped access, mirrored by scopedJobAccessWhere() itself only
// narrowing for technician. A technician's relationship can only be proven
// by asking JobsService.getById(), which throws when the row is out of
// scope for that actor (a 404 ApiError, not a soft return) - that throw is
// treated as "not this actor's job," never re-interpreted or retried.
export async function resolveJobResourceScope(jobsService: Pick<JobsService, "getById">, orgId: string, actor: { userId: string; role: CanonicalRole }, jobId: string): Promise<AthenaJobResourceScopeResult> {
  if (actor.role !== "technician") {
    return { relationship: "member" };
  }
  try {
    await jobsService.getById(orgId, jobId, actor);
    return { relationship: "assignee" };
  } catch {
    return { relationship: "none" };
  }
}
