import { z } from "zod";
import type { AuthContext } from "../../../backend/auth/context";
import { getRolePermissions, isTerminalStatus } from "../../../domain";
import { defineTool, successResult } from "../../athena-tool-sdk";
import type { AthenaToolDefinition } from "../../athena-tool-sdk";
import type { JobsService } from "../../jobs/service";
import type { DispatchSummaryDTO, JobSummaryDTO } from "../../jobs/types";

// A12 Business Tool Rollout, Dispatcher domain (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 4 "Dispatcher").
// First read-only tool registered for the 2026-11-25 draft-refusal
// regression: "How many active jobs do I have today?" used to fail input
// validation because no intent-matched tool existed for it. "Active" is
// getDispatchSummary's own definition - non-terminal, non-archived - so
// the count here and in optimize-day can never disagree. The list is the
// first page of JobsService.list() filtered to the same set; the
// authoritative count comes from the count-only summary, never from the
// page total (which also counts terminal jobs on the page's underlying
// query). Customer contact details are intentionally omitted, same as the
// dispatch context provider: job scheduling metadata only.

const ACTIVE_JOBS_PAGE_SIZE = 25;
const ACTIVE_JOBS_SUMMARY_ITEMS = 5;

export const activeJobsInputSchema = z.object({});
export type ActiveJobsInput = z.infer<typeof activeJobsInputSchema>;

export interface ActiveJobsItem {
  jobId: string;
  jobNumber: string;
  title: string;
  status: string;
  priority: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  projectName?: string;
}

export interface ActiveJobsData {
  activeJobs: number;
  jobs: ActiveJobsItem[];
  shownJobs: number;
}

export interface ActiveJobsToolDeps {
  jobs: Pick<JobsService, "getDispatchSummary" | "list">;
}

function toActiveJobsItem(job: JobSummaryDTO): ActiveJobsItem {
  return {
    jobId: job.id,
    jobNumber: job.jobNumber,
    title: job.title,
    status: job.status,
    priority: job.priority,
    scheduledStart: job.scheduledStart,
    scheduledEnd: job.scheduledEnd,
    projectName: job.project?.name,
  };
}

export function createActiveJobsTool(deps: ActiveJobsToolDeps): AthenaToolDefinition<ActiveJobsInput, ActiveJobsData> {
  return defineTool({
    id: "tradeos.athena.tools.dispatcher.active-jobs",
    version: "1.0.0",
    owner: "athena-tools-dispatcher",
    description: "Lists the organization's active (non-terminal, non-archived) jobs with their count - a read-only dispatcher view, no scheduling or assignment.",
    permissions: [],
    risk: "low",
    confirmationPolicy: "never",
    timeoutMs: 10_000,
    idempotency: "not_supported",
    compensationPolicy: "none",
    inputSchema: activeJobsInputSchema,
    async execute(_input, _aiContext, execution) {
      const telemetry = { traceId: execution.traceId, executionId: execution.executionId };
      const actor = { userId: execution.actor.id, role: execution.role };
      const auth: AuthContext = {
        userId: execution.actor.id,
        orgId: execution.orgId,
        role: execution.role,
        canonicalRole: execution.role,
        permissions: getRolePermissions(execution.role),
      };

      // Count-only aggregate first: the authoritative active-jobs count.
      // Deliberately no permission gate here (permissions: [] above) - the
      // same "no elevated role" precedent GET /api/v1/jobs/dispatch-summary
      // and the dispatch context provider use: JobsService's own
      // scopedJobAccessWhere() plus the jobs_select_policy RLS narrow the
      // rows to the caller's assignment for any role other than
      // owner/admin/dispatcher, so a technician sees only their own active
      // jobs. Gating on dispatch.manage would deny technicians a read their
      // RLS access is specifically designed to grant.
      const summary: DispatchSummaryDTO = await deps.jobs.getDispatchSummary(execution.orgId, actor);
      const page = await deps.jobs.list({ orgId: execution.orgId, auth, archived: false, page: 1, pageSize: ACTIVE_JOBS_PAGE_SIZE });
      const activeJobs = page.items.filter((job) => !isTerminalStatus(job.status)).map(toActiveJobsItem);
      const shown = activeJobs.slice(0, ACTIVE_JOBS_SUMMARY_ITEMS);
      const remaining = summary.activeJobs - shown.length;

      const lines = shown.map((job) => `${job.jobNumber} - ${job.title} (${job.status})`);
      const summaryText =
        summary.activeJobs === 0
          ? "No active jobs."
          : `${summary.activeJobs} active job${summary.activeJobs === 1 ? "" : "s"}${lines.length > 0 ? `: ${lines.join("; ")}` : ""}${remaining > 0 ? `; and ${remaining} more` : ""}.`;

      return successResult<ActiveJobsData>({
        summary: summaryText,
        data: { activeJobs: summary.activeJobs, jobs: activeJobs, shownJobs: shown.length },
        telemetry,
      });
    },
  });
}
