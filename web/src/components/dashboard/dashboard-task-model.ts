import { getStatusLabel, type TaskStatus } from "../../domain/index.ts";
import type { ActivityEvent, OrganizationProjectTask } from "../../lib/api";
import type { OwnerActivityEntry } from "./owner-dashboard-data";
import {
  formatTaskDueLabel,
  getStoredCalendarDayOrdinal,
  getTaskDueBucket,
  type DashboardTaskDueBucket,
} from "./dashboard-task-dates";

export interface DashboardTaskSnapshot {
  openTasks: OrganizationProjectTask[];
  overdueCount: number;
  dueTodayCount: number;
  blockedCount: number;
}

const TASK_PRIORITY_WEIGHT: Record<OrganizationProjectTask["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function compareTasks(left: OrganizationProjectTask, right: OrganizationProjectTask, now: Date, timeZone: string) {
  const dueBucketWeight: Record<DashboardTaskDueBucket, number> = {
    overdue: 0,
    today: 1,
    upcoming: 2,
    none: 3,
  };

  const dueBucketDelta = dueBucketWeight[getTaskDueBucket(left, now, timeZone)] - dueBucketWeight[getTaskDueBucket(right, now, timeZone)];
  if (dueBucketDelta !== 0) return dueBucketDelta;

  const blockedDelta = Number(left.status === "blocked") - Number(right.status === "blocked");
  if (blockedDelta !== 0) return blockedDelta * -1;

  const dueDateDelta = (getStoredCalendarDayOrdinal(left.dueDate) ?? Number.POSITIVE_INFINITY) - (getStoredCalendarDayOrdinal(right.dueDate) ?? Number.POSITIVE_INFINITY);
  if (dueDateDelta !== 0) return dueDateDelta;

  const priorityDelta = TASK_PRIORITY_WEIGHT[left.priority] - TASK_PRIORITY_WEIGHT[right.priority];
  if (priorityDelta !== 0) return priorityDelta;

  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

export function buildDashboardTaskSnapshot(tasks: OrganizationProjectTask[], now: Date, timeZone: string): DashboardTaskSnapshot {
  const openTasks = tasks.filter((task) => task.status !== "completed").sort((left, right) => compareTasks(left, right, now, timeZone));

  return {
    openTasks,
    overdueCount: openTasks.filter((task) => getTaskDueBucket(task, now, timeZone) === "overdue").length,
    dueTodayCount: openTasks.filter((task) => getTaskDueBucket(task, now, timeZone) === "today").length,
    blockedCount: openTasks.filter((task) => task.status === "blocked").length,
  };
}

export { formatTaskDueLabel } from "./dashboard-task-dates";

function getTaskActivityTone(event: ActivityEvent): OwnerActivityEntry["tone"] {
  if (event.eventType === "task.completed") return "success";
  if (event.eventType === "task.blocked" || event.eventType === "task.deleted") return "warning";
  return "info";
}

function getTaskActivityCategory(event: ActivityEvent): string {
  const maybeStatus = event.eventType.split(".").at(-1);
  return maybeStatus && (["todo", "in_progress", "blocked", "completed"] as TaskStatus[]).includes(maybeStatus as TaskStatus)
    ? getStatusLabel(maybeStatus)
    : "Updated";
}

export function buildTaskActivityEntries(events: ActivityEvent[]): OwnerActivityEntry[] {
  return events.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description ?? "Task activity recorded.",
    occurredAt: event.occurredAt,
    category: getTaskActivityCategory(event),
    actor: event.actorUserId ? `User ${event.actorUserId}` : "TradeOS",
    tone: getTaskActivityTone(event),
  }));
}
