import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableSection } from "@/components/shared/table-section";
import type { DispatchJob } from "@/lib/api";
import { formatScheduleInZone } from "@/lib/document-workflow";

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

// Attention flags reuse the shared STATUS_TONES palette (via StatusBadge)
// instead of hand-rolled colors, so "overdue" here always matches
// "overdue" everywhere else in the app and any future palette change only
// has one place to update.
function AttentionIndicator({ job }: { job: DispatchJob }) {
  const flags: string[] = [];

  if (job.isOverdue) flags.push("overdue");
  if (job.needsAttention) flags.push("needs_attention");
  if (job.isUnassigned) flags.push("unassigned");

  if (flags.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {flags.map((flag) => (
        <StatusBadge key={flag} status={flag} />
      ))}
    </div>
  );
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
    <>
      <TableSection
        className="hidden md:block"
        title="Work queue"
        description={`${total} job${total === 1 ? "" : "s"} matching the current filters.`}
      >
        {/* Table is desktop-only (md:block above); the card list below is the mobile equivalent, not a duplicate render. */}
        <table className="min-w-[820px] text-left text-sm">
        <thead>
          <tr className="border-b border-border/70 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <th scope="col" className="px-3 py-2">Customer / Project</th>
            <th scope="col" className="px-3 py-2">Status</th>
            <th scope="col" className="px-3 py-2">Schedule</th>
            <th scope="col" className="px-3 py-2">Assigned</th>
            <th scope="col" className="px-3 py-2">Priority</th>
            <th scope="col" className="px-3 py-2">Attention</th>
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

      <div className="grid gap-3 md:hidden">
        {jobs.map((job) => (
          <article key={job.id} className="rounded-2xl border border-border/60 bg-background/80 p-4">
            <div className="flex items-start justify-between gap-3">
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
              <StatusBadge status={job.status} />
            </div>

            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Schedule</p>
                <p className="mt-1 text-foreground">
                  {job.scheduledStart ? formatScheduleInZone(job.scheduledStart, timezone) : "Unscheduled"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Assigned</p>
                <p className="mt-1 text-foreground">
                  {job.assignedTechnicians.length > 0 ? job.assignedTechnicians.map((tech) => tech.name).join(", ") : "Unassigned"}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {job.priority ? <StatusBadge status={job.priority} /> : null}
              <AttentionIndicator job={job} />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
