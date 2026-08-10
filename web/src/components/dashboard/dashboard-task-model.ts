import { getStatusLabel, type TaskStatus } from "@/domain";
import type { OrganizationProjectTask } from "@/lib/api";
import type { OwnerActivityEntry } from "./owner-dashboard-data";

export interface DashboardTaskSnapshot {
  openTasks: OrganizationProjectTask[];
  recentTasks: OrganizationProjectTask[];
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

function getDueBucket(task: Pick<OrganizationProjectTask, "dueDate" | "status">, now: Date, timeZone: string): DueBucket {
  if (task.status === "completed") return "none";

  const dueDate = toValidDate(task.dueDate);
  if (!dueDate) return "none";

  const todayOrdinal = getZonedDayOrdinal(now, timeZone);
  const dueOrdinal = getZonedDayOrdinal(dueDate, timeZone);
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

  const dueDateDelta = (toValidDate(left.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY) - (toValidDate(right.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY);
  if (dueDateDelta !== 0) return dueDateDelta;

  const priorityDelta = TASK_PRIORITY_WEIGHT[left.priority] - TASK_PRIORITY_WEIGHT[right.priority];
  if (priorityDelta !== 0) return priorityDelta;

  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

export function buildDashboardTaskSnapshot(tasks: OrganizationProjectTask[], now: Date, timeZone: string): DashboardTaskSnapshot {
  const openTasks = tasks.filter((task) => task.status !== "completed").sort((left, right) => compareTasks(left, right, now, timeZone));
  const recentTasks = [...tasks].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()).slice(0, 8);

  return {
    openTasks,
    recentTasks,
    overdueCount: openTasks.filter((task) => getDueBucket(task, now, timeZone) === "overdue").length,
    dueTodayCount: openTasks.filter((task) => getDueBucket(task, now, timeZone) === "today").length,
    blockedCount: openTasks.filter((task) => task.status === "blocked").length,
  };
}

export function formatTaskDueLabel(task: Pick<OrganizationProjectTask, "dueDate" | "status">, now: Date, timeZone: string) {
  if (!task.dueDate) return "No due date";

  const dueDate = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
  }).format(new Date(task.dueDate));

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

function getActivityTone(task: OrganizationProjectTask, now: Date, timeZone: string): OwnerActivityEntry["tone"] {
  if (task.status === "completed") return "success";
  if (task.status === "blocked" || getDueBucket(task, now, timeZone) === "overdue") return "warning";
  return "info";
}

function getActivityTitle(task: OrganizationProjectTask): string {
  const statusTitle: Record<TaskStatus, string> = {
    todo: "queued",
    in_progress: "in progress",
    blocked: "blocked",
    completed: "completed",
  };

  return `${task.title} is ${statusTitle[task.status]}`;
}

export function buildTaskActivityEntries(tasks: OrganizationProjectTask[], now: Date, timeZone: string): OwnerActivityEntry[] {
  return tasks.map((task) => ({
    id: task.id,
    title: getActivityTitle(task),
    description: [task.projectName, task.jobTitle, formatTaskDueLabel(task, now, timeZone)].filter(Boolean).join(" / "),
    occurredAt: task.updatedAt,
    category: getStatusLabel(task.status),
    actor: task.assignedTo ?? "Unassigned",
    tone: getActivityTone(task, now, timeZone),
  }));
}
