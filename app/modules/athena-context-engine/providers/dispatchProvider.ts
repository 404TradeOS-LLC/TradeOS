import type { AuthContext } from "../../../backend/auth/context";
import type { JobStatus } from "../../../domain";
import { JobsService } from "../../jobs/service";
import type { JobPriority, JobSummaryDTO } from "../../jobs/types";
import { AthenaContextProviderDefinition, AthenaContextProviderFetchResult } from "../types";

// First-party dispatch context provider (docs/athena/roadmap/
// A3-context-engine-implementation-plan.md "A3 Scope"). Reuses
// JobsService.list() rather than querying jobs directly - actor-scoping for
// the technician role comes from JobsService's own scopedJobAccessWhere()
// (assignment-filtered) plus the underlying jobs_select_policy RLS
// (app/prisma/migrations/20260714120000_add_job_scheduling_engine), the one
// entity with a real object-scope precedent named in the A1/A2 reviews.
// This provider adds no actor filter of its own - JobsService and RLS are
// both already correctly scoped, and duplicating that logic here would risk
// drifting out of sync with it.
//
// Whoever calls assembleAthenaContext() with this provider registered must
// already be running inside a properly-scoped database session
// (runWithDatabaseSession/runWithBackgroundDatabaseSession) - this provider
// never imports app/db/client or app/db/requestSession itself (see the
// import-boundary test), consistent with athena-tool-registry's tools never
// reaching the database directly.
export interface AthenaDispatchContextJob {
  jobId: string;
  jobNumber: string;
  title: string;
  status: JobStatus;
  priority: JobPriority;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  projectName?: string;
  needsAttention?: boolean;
}

export interface AthenaDispatchContextData {
  jobs: AthenaDispatchContextJob[];
  total: number;
}

const DISPATCH_PAGE_SIZE = 25;

// Deliberately excludes customer name/email/phone and assigned-technician
// identity - job scheduling metadata is low-PII, but customer contact
// details and other users' identities are not, and this provider has no
// need-to-know reason to carry them into an AI context yet.
function toContextJob(job: JobSummaryDTO): AthenaDispatchContextJob {
  return {
    jobId: job.id,
    jobNumber: job.jobNumber,
    title: job.title,
    status: job.status,
    priority: job.priority,
    scheduledStart: job.scheduledStart,
    scheduledEnd: job.scheduledEnd,
    projectName: job.project?.name,
    needsAttention: job.needsAttention,
  };
}

export function createDispatchProvider(overrides: Partial<AthenaContextProviderDefinition<AthenaDispatchContextData>> = {}, jobsService: Pick<JobsService, "list"> = new JobsService()): AthenaContextProviderDefinition<AthenaDispatchContextData> {
  return {
    id: "tradeos.athena.context.dispatch",
    version: "1.0.0",
    owner: "athena-context-engine",
    section: "dispatch",
    description: "Actor-scoped job scheduling summary, inherited from JobsService/jobs_select_policy RLS.",
    // Deliberately no domain-permission requirement here: RBAC_MATRIX.md's
    // "Jobs and scheduling" row grants technicians "field-scoped access
    // only" to their own assigned jobs, which is enforced entirely by
    // scopedJobAccessWhere()/jobs_select_policy RLS, not by a
    // DomainPermission like dispatch.manage (which dispatcher/admin/owner
    // hold but technician does not). Gating this provider on
    // dispatch.manage would deny technicians the section their RLS access
    // is specifically designed to grant - the same "no elevated role"
    // precedent GET /api/v1/jobs/dispatch-summary already uses.
    permissions: [],
    activation: "lazy_intent",
    allowedIntents: ["dispatch_overview"],
    freshnessTtlMs: 0,
    timeoutMs: 3_000,
    maxItems: DISPATCH_PAGE_SIZE,
    maxBytes: 65_536,
    sensitivity: "internal",
    cacheKeyPolicy: "none",
    criticality: "optional",
    failureBehavior: "degrade",
    async fetch(input): Promise<AthenaContextProviderFetchResult<AthenaDispatchContextData>> {
      const auth: AuthContext = { userId: input.actor.userId, orgId: input.orgId, role: input.actor.role, canonicalRole: input.actor.role };
      const result = await jobsService.list({
        orgId: input.orgId,
        auth,
        archived: false,
        pageSize: DISPATCH_PAGE_SIZE,
        projectId: input.selectedScope.projectId,
        customerId: input.selectedScope.customerId,
      });
      return {
        data: { jobs: result.items.map(toContextJob), total: result.total },
        itemCount: result.items.length,
        omittedFields: ["customer.email", "customer.phone", "assignedTechnicians"],
      };
    },
    ...overrides,
  };
}
