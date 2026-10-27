import { hasPermission } from "../../../app/domain/contracts.ts";
import { clientFetch } from "./clientApi.ts";
import type { TodayTaskTarget } from "./today-model.ts";

export const todayTaskStatuses = ["todo", "in_progress", "blocked", "completed"] as const;
export type TodayTaskStatus = (typeof todayTaskStatuses)[number];

/** Presentation gate only. The existing API independently requires crm.write and tenant scope. */
export function canUpdateTodayTask(role: string, target?: TodayTaskTarget): boolean {
  return hasPermission(role, "crm.write") || (role === "technician" && target?.access === "assigned-field" && Boolean(target.jobId));
}

export async function updateTodayTaskStatus(target: TodayTaskTarget, status: TodayTaskStatus) {
  if (!target.updatedAt || !Number.isFinite(Date.parse(target.updatedAt))) throw new Error("Task revision is unavailable. Refresh the source workspace before saving.");
  if (!todayTaskStatuses.includes(status)) throw new Error("Unsupported task status.");
  if (target.access === "assigned-field" && !target.jobId) throw new Error("Assigned job is unavailable. Refresh before saving.");
  const result = await clientFetch<{ id: string; projectId: string; status: string; jobId?: string }>(
    target.access === "assigned-field" ? `/api/v1/jobs/${encodeURIComponent(target.jobId!)}/tasks/${encodeURIComponent(target.taskId)}/status` : `/api/v1/projects/${encodeURIComponent(target.projectId)}/tasks/${encodeURIComponent(target.taskId)}/status`,
    { method: "PATCH", body: JSON.stringify({ status, expectedUpdatedAt: target.updatedAt }) },
  );
  if (!result || result.id !== target.taskId || result.projectId !== target.projectId || result.status !== status || (target.access === "assigned-field" && result.jobId !== target.jobId)) {
    throw new Error("The saved task could not be confirmed. Refresh the source workspace before trying again.");
  }
  return result;
}
