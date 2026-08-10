import { getStatusLabel, type TaskStatus } from "../../domain";
import type { ActivityEvent, OrganizationProjectTask } from "../../lib/api";
import type { OwnerActivityEntry } from "./owner-dashboard-data";

export interface DashboardTaskSnapshot {
  openTasks: OrganizationProjectTask[];
  overdueCount: number;
  dueTodayCount: number;
  blockedCount: number;
}

type DueBucket = "overdue" | "today" | "upcoming" | "none";

const TASK_PRIORITY_WEIGHT: Record<OrganizationProjectTask["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function toValidDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function getZonedDayOrdinal(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function getStoredCalendarDayOrdinal(value: string | null | undefined) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.getTime() / 86_400_000;
}

function getDueBucket(task: Pick<OrganizationProjectTask, "dueDate" | "status">, now: Date, timeZone: string): DueBucket {
  if (task.status === "completed") return "none";

  const dueOrdinal = getStoredCalendarDayOrdinal(task.dueDate);
  if (dueOrdinal === null) return "none";

  const todayOrdinal = getZonedDayOrdinal(now, timeZone);
  if (dueOrdinal < todayOrdinal) return "overdue";
  if (dueOrdinal === todayOrdinal) return "today";
  return "upcoming";
}

function compareTasks(left: OrganizationProjectTask, right: OrganizationProjectTask, now: Date, timeZone: string) {
  const dueBucketWeight: Record<DueBucket, number> = {
    overdue: 0,
    today: 1,
    upcoming: 2,
    none: 3,
  };

  const dueBucketDelta = dueBucketWeight[getDueBucket(left, now, timeZone)] - dueBucketWeight[getDueBucket(right, now, timeZone)];
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
    overdueCount: openTasks.filter((task) => getDueBucket(task, now, timeZone) === "overdue").length,
    dueTodayCount: openTasks.filter((task) => getDueBucket(task, now, timeZone) === "today").length,
    blockedCount: openTasks.filter((task) => task.status === "blocked").length,
  };
}

export function formatTaskDueLabel(task: Pick<OrganizationProjectTask, "dueDate" | "status">, now: Date, timeZone: string) {
  if (!task.dueDate) return "No due date";

  const dueOrdinal = getStoredCalendarDayOrdinal(task.dueDate);
  if (dueOrdinal === null) return "No due date";
  const dueDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(new Date(dueOrdinal * 86_400_000));

  switch (getDueBucket(task, now, timeZone)) {
    case "overdue":
      return `Overdue · ${dueDate}`;
    case "today":
      return `Due today · ${dueDate}`;
    case "upcoming":
      return `Due ${dueDate}`;
    default:
      return `Due ${dueDate}`;
  }
}

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
