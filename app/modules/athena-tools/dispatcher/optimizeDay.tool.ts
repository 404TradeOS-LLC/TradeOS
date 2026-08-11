import { z } from "zod";
import { defineTool, followUp, successResult, warning } from "../../athena-tool-sdk";
import type { AthenaToolDefinition } from "../../athena-tool-sdk";
import type { JobsService } from "../../jobs/service";
import type { DispatchSummaryDTO, ScheduleConflictResultDTO } from "../../jobs/types";

// A12 Business Tool Rollout, Dispatcher domain (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 4 "Dispatcher").
// "Optimize the day" is deliberately NOT a routing/geo-optimization
// algorithm - per the plan, it surfaces what JobsService.getDispatchSummary
// and JobsService.getScheduleConflicts already compute (KPI counts and
// technician double-booking conflicts) as a single read. No mutation, no
// invented scoring, no persistence.

export const optimizeDayInputSchema = z.object({});
export type OptimizeDayInput = z.infer<typeof optimizeDayInputSchema>;

export interface OptimizeDayData {
  summary: DispatchSummaryDTO;
  conflicts: ScheduleConflictResultDTO;
}

export interface OptimizeDayToolDeps {
  jobs: Pick<JobsService, "getDispatchSummary" | "getScheduleConflicts">;
}

export function createOptimizeDayTool(deps: OptimizeDayToolDeps): AthenaToolDefinition<OptimizeDayInput, OptimizeDayData> {
  return defineTool({
    id: "tradeos.athena.tools.dispatcher.optimize-day",
    version: "1.0.0",
    owner: "athena-tools-dispatcher",
    description: "Surfaces today's dispatch summary and any technician schedule conflicts to help plan the day - a read/analysis tool, not a routing optimizer.",
    permissions: ["dispatch.manage"],
    risk: "low",
    confirmationPolicy: "never",
    timeoutMs: 10_000,
    idempotency: "not_supported",
    compensationPolicy: "none",
    inputSchema: optimizeDayInputSchema,
    async execute(_input, _aiContext, execution) {
      const telemetry = { traceId: execution.traceId, executionId: execution.executionId };
      const actor = { userId: execution.actor.id, role: execution.role };

      // getScheduleConflicts requires an explicit date range (unlike
      // getDispatchSummary, which computes its own org-timezone-aware "today"
      // internally) - a simple UTC calendar-day window is used here rather
      // than duplicating JobsService/dispatchRules' own org-timezone
      // resolution logic, which is private to that module.
      const now = new Date();
      const scheduledFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const scheduledTo = new Date(scheduledFrom.getTime() + 24 * 60 * 60 * 1000);

      const [summary, conflicts] = await Promise.all([
        deps.jobs.getDispatchSummary(execution.orgId, actor),
        deps.jobs.getScheduleConflicts({ orgId: execution.orgId, actor, scheduledFrom, scheduledTo }),
      ]);

      const warnings = [];
      const followUps = [];

      if (conflicts.conflicts.length > 0) {
        warnings.push(
          warning({
            code: "athena_schedule_conflicts_detected",
            message: `${conflicts.conflicts.length} technician schedule conflict(s) detected for today.`,
          })
        );
        followUps.push(followUp({ kind: "action", label: "Review and resolve today's schedule conflicts" }));
      }

      if (summary.unscheduledJobs > 0) {
        followUps.push(followUp({ kind: "action", label: `Schedule ${summary.unscheduledJobs} unscheduled job(s)` }));
      }

      if (summary.needsAttention > 0) {
        followUps.push(followUp({ kind: "question", label: `Review ${summary.needsAttention} job(s) that need attention` }));
      }

      return successResult<OptimizeDayData>({
        summary: `Today: ${summary.scheduledToday} scheduled, ${summary.unscheduledJobs} unscheduled, ${summary.overdueActionable} overdue, ${conflicts.conflicts.length} conflict(s).`,
        data: { summary, conflicts },
        telemetry,
        warnings,
        followUps,
      });
    },
  });
}
