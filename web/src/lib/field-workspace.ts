export type FieldJobMembership = "today" | "outside_today" | "unknown";

export function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function resolveRequestedFieldJobId(value: string | string[] | undefined) {
  return firstSearchParam(value)?.trim() || null;
}

export function resolveSelectedFieldJobId(
  value: string | string[] | undefined,
  jobs: ReadonlyArray<{ id: string }>
) {
  return resolveRequestedFieldJobId(value) ?? jobs[0]?.id ?? null;
}

export function resolveFieldJobMembership(input: {
  requestedJobId: string | null;
  selectedJobId: string | null;
  todayJobIds: ReadonlyArray<string>;
  listFailed: boolean;
}): FieldJobMembership {
  if (!input.selectedJobId || input.listFailed) return "unknown";
  if (input.todayJobIds.includes(input.selectedJobId)) return "today";
  return input.requestedJobId ? "outside_today" : "unknown";
}

export function getFieldWorkspaceLabels(membership: FieldJobMembership) {
  return membership === "today"
    ? { heading: "Today", schedule: "Today on site" }
    : { heading: "Field job", schedule: "Schedule" };
}

export function resolveFieldJobLoad<T extends { archivedAt: string | null }>(input: {
  job?: T | null;
  error?: string | null;
}): {
  job: T | null;
  error: string | null;
  actionable: boolean;
} {
  if (input.error) {
    return { job: null, error: input.error, actionable: false };
  }
  if (!input.job) {
    return { job: null, error: null, actionable: false };
  }
  if (input.job.archivedAt) {
    return {
      job: null,
      error: "This job is archived. Open an active assigned job instead.",
      actionable: false,
    };
  }
  return { job: input.job, error: null, actionable: true };
}

export function getProjectFieldJobHref(
  role: string,
  job: { id: string; archivedAt: string | null }
) {
  if (role !== "technician" || job.archivedAt) return null;
  return `/field?job=${encodeURIComponent(job.id)}`;
}
