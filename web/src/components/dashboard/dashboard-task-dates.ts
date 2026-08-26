export type DashboardTaskDueStatus = "todo" | "in_progress" | "blocked" | "completed";
export type DashboardTaskDueBucket = "overdue" | "today" | "upcoming" | "none";

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

export function getStoredCalendarDayOrdinal(value: string | null | undefined) {
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

export function getTaskDueBucket(
  task: { dueDate: string | null | undefined; status: DashboardTaskDueStatus },
  now: Date,
  timeZone: string
): DashboardTaskDueBucket {
  if (task.status === "completed") return "none";

  const dueOrdinal = getStoredCalendarDayOrdinal(task.dueDate);
  if (dueOrdinal === null) return "none";

  const todayOrdinal = getZonedDayOrdinal(now, timeZone);
  if (dueOrdinal < todayOrdinal) return "overdue";
  if (dueOrdinal === todayOrdinal) return "today";
  return "upcoming";
}

export function formatTaskDueLabel(
  task: { dueDate: string | null | undefined; status: DashboardTaskDueStatus },
  now: Date,
  timeZone: string
) {
  if (!task.dueDate) return "No due date";

  const dueOrdinal = getStoredCalendarDayOrdinal(task.dueDate);
  if (dueOrdinal === null) return "No due date";
  const dueDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(new Date(dueOrdinal * 86_400_000));

  switch (getTaskDueBucket(task, now, timeZone)) {
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
