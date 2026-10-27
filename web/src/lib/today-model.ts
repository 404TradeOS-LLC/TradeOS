import { getTaskDueBucket } from "../components/dashboard/dashboard-task-dates.ts";

export interface TodayTaskTarget { projectId: string; taskId: string; status: string; updatedAt: string }

export type TodayPresentation = "owner" | "office" | "field";
export interface TodayAttentionItem {
  id: string;
  title: string;
  context: string;
  source: string;
  priority: "urgent" | "high" | "medium";
  assignee: string | null;
  dueAt: string | null;
  href: string;
  action: string;
  updatedAt?: string;
  status?: string;
  task?: TodayTaskTarget;
}
export interface TodayWorkItem {
  id: string;
  title: string;
  context: string;
  kind: "job" | "task" | "visit";
  task?: TodayTaskTarget;
  dueAt?: string | null;
  start: string | null;
  end: string | null;
  assignee: string | null;
  status: string;
  href: string;
}
export interface TodaySource {
  id: string;
  label: string;
  state: "ready" | "partial" | "unavailable" | "restricted";
  message?: string;
}
export interface TodayStat { id: string; label: string; value: number | null; href: string; helper: string }
export interface TodayData {
  companyName?: string;
  viewer: { name: string; role: string; presentation: TodayPresentation; timeZone: string };
  generatedAt: string;
  stats: TodayStat[];
  attention: TodayAttentionItem[];
  work: TodayWorkItem[];
  upcoming?: TodayWorkItem[];
  progress: TodayAttentionItem[];
  sources: TodaySource[];
  athenaEnabled: boolean;
}

export function safeTodayTimeZone(value: string | null | undefined): string {
  try { new Intl.DateTimeFormat("en-US", { timeZone: value || "UTC" }); return value || "UTC"; }
  catch { return "UTC"; }
}

export function todayDateKey(value: string, timeZone: string): string | null {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: safeTodayTimeZone(timeZone), year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)?.value).join("-");
}

/** Project Task deadlines are stored calendar dates, not instants to shift between zones. */
export function taskDueBucket(task: { status: string; dueDate: string | null }, now: string, timeZone: string) {
  const reference = new Date(now);
  if (!Number.isFinite(reference.getTime())) return "none";
  return getTaskDueBucket({ dueDate: task.dueDate, status: task.status === "completed" ? "completed" : "todo" }, reference, safeTodayTimeZone(timeZone));
}

export function isTodayTask(task: { status: string; dueDate: string | null }, now: string, timeZone: string): boolean {
  return taskDueBucket(task, now, timeZone) === "today";
}

export function taskNeedsAttention(task: { status: string; dueDate: string | null }, now: string, timeZone: string): boolean {
  if (task.status === "completed") return false;
  return task.status === "blocked" || taskDueBucket(task, now, timeZone) === "overdue";
}

export function prioritizeTodayAttention(items: TodayAttentionItem[]): TodayAttentionItem[] {
  const weight = { urgent: 0, high: 1, medium: 2 };
  const dateValue = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : Number.POSITIVE_INFINITY;
  return [...new Map(items.map((item) => [item.id, item])).values()].sort((a, b) => {
    const urgency = weight[a.priority] - weight[b.priority];
    if (urgency) return urgency;
    const left = dateValue(a.dueAt), right = dateValue(b.dueAt);
    if (left !== right) return left < right ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}
