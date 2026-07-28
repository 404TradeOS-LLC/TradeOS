import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableSection } from "@/components/shared/table-section";
import type { DispatchJob } from "@/lib/api";
import { cn } from "@/lib/utils";

interface DispatchWorkQueueTableProps {
  jobs: DispatchJob[];
  isFiltered: boolean;
  total: number;
  /**
   * IANA timezone to render schedule times in - the organization's
   * configured timezone (or "UTC" when the caller is on the fallback path).
   * Deliberately NOT using the shared `formatDateTime` helper from
   * `@/lib/document-workflow`, which has no `timeZone` option and formats
   * using the Next.js server process's own local timezone - on a
   * deployment where that isn't the organization's configured timezone,
   * the table would silently disagree with the summary strip's caption
   * ("times use the organization timezone") and with the org-tz-aware
   * "today"/"this week" filters above it.
   */
  timezone: string;
}

function AttentionIndicator({ job }: { job: DispatchJob }) {
  const flags: { label: string; className: string }[] = [];

  if (job.isOverdue) {
    flags.push({ label: "Overdue", className: "border-rose-600/20 bg-rose-500/10 text-rose-700 dark:text-rose-300" });
  }
  if (job.needsAttention) {
    flags.push({ label: "Needs attention", className: "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-300" });
  }
  if (job.isUnassigned) {
    flags.push({ label: "Unassigned", className: "border-slate-600/20 bg-slate-500/10 text-slate-700 dark:text-slate-300" });
  }

  if (flags.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {flags.map((flag) => (
        <Badge key={flag.label} variant="outline" className={cn("border-border/70", flag.className)}>
          {flag.label}
        </Badge>
      ))}
    </div>
  );
}

/**
 * Formats an ISO instant in a specific IANA timezone. Falls back to "UTC"
 * (labeled) for an empty/invalid timezone rather than silently falling
 * through to the runtime's default - `resolveOrgTimezone` on the backend
 * already guarantees `timezone` is a validated IANA string or "UTC", but
 * this stays defensive in case a future caller passes something else
 * through, so the fallback is truthful instead of just crashing or
 * quietly rendering in the wrong zone.
 */
function formatScheduleInZone(value: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value));
  } catch {
    return `${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value))} (UTC)`;
  }
}

export function DispatchWorkQueueTable({ jobs, isFiltered, total, timezone }: DispatchWorkQueueTableProps) {
  if (jobs.length === 0) {
    return (
      <TableSection title="Work queue" description="Jobs needing dispatcher attention.">
        {isFiltered ? (
          <EmptyState
            title="No jobs match these filters"
            description="Try widening the schedule range, clearing the status or assignment filter, switching the view to All jobs, or searching a different term."
            action={
              <Link href="/dispatch?view=all" className={buttonVariants({ variant: "outline" })}>
                Clear filters
              </Link>
            }
          />
        ) : (
          <EmptyState
            title="No jobs yet"
            description="This organization has no jobs recorded yet. Jobs created from a project will appear here once they exist - nothing here is fabricated."
          />
        )}
      </TableSection>
    );
  }

  return (
    <TableSection title="Work queue" description={`${total} job${total === 1 ? "" : "s"} matching the current filters.`}>
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border/70 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <th className="px-3 py-2">Customer / Project</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Schedule</th>
            <th className="px-3 py-2">Assigned</th>
            <th className="px-3 py-2">Priority</th>
            <th className="px-3 py-2">Attention</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="border-b border-border/50 align-top">
              <td className="max-w-64 px-3 py-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-foreground">{job.customer?.name ?? "No customer linked"}</div>
                  {job.project ? (
                    <Link
                      href={`/projects/${job.project.id}`}
                      className="block truncate text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                      {job.project.name}
                    </Link>
                  ) : (
                    <div className="truncate text-sm text-muted-foreground">No project</div>
                  )}
                  <div className="truncate text-xs text-muted-foreground">
                    #{job.jobNumber} · {job.title}
                  </div>
                </div>
              </td>
              <td className="px-3 py-3">
                <StatusBadge status={job.status} />
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-sm text-foreground">
                {job.scheduledStart ? formatScheduleInZone(job.scheduledStart, timezone) : <span className="text-muted-foreground">Unscheduled</span>}
              </td>
              <td className="px-3 py-3 text-sm text-foreground">
                {job.assignedTechnicians.length > 0 ? (
                  job.assignedTechnicians.map((tech) => tech.name).join(", ")
                ) : (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </td>
              <td className="px-3 py-3">{job.priority ? <StatusBadge status={job.priority} /> : <span className="text-sm text-muted-foreground">—</span>}</td>
              <td className="px-3 py-3">
                <AttentionIndicator job={job} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableSection>
  );
}
