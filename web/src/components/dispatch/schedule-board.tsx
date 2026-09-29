import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { DispatchJobActions } from "@/components/dispatch/dispatch-job-actions";
import { AssignedTechnicians } from "@/components/shared/assigned-technicians";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { DispatchJob } from "@/lib/api";
import { formatScheduleInZone } from "@/lib/document-workflow";
import { cn } from "@/lib/utils";

export type ScheduleMode = "day" | "week" | "crew";

interface ScheduleBoardProps {
  mode: ScheduleMode;
  scheduledJobs: DispatchJob[];
  scheduledTotal: number;
  unscheduledJobs: DispatchJob[];
  unscheduledTotal: number;
  timezone: string;
  canManageInvoiceReadiness: boolean;
}

function crewGroup(job: DispatchJob): { key: string; label: string } {
  if (job.assignedTechnicians.length === 0) {
    return { key: "unassigned", label: "Unassigned" };
  }

  const technicians = [...job.assignedTechnicians].sort((left, right) => left.userId.localeCompare(right.userId));
  return {
    key: technicians.map((technician) => technician.userId).join("|"),
    label: technicians.map((technician) => technician.name).join(" + "),
  };
}

function localDateKey(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function localDayLabel(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

function bySchedule(left: DispatchJob, right: DispatchJob) {
  return (left.scheduledStart ?? "").localeCompare(right.scheduledStart ?? "");
}

function groupJobs(jobs: DispatchJob[], mode: ScheduleMode, timezone: string) {
  const groups = new Map<string, { label: string; jobs: DispatchJob[] }>();

  for (const job of [...jobs].sort(bySchedule)) {
    if (!job.scheduledStart) continue;
    const grouping =
      mode === "week"
        ? { key: localDateKey(job.scheduledStart, timezone), label: localDayLabel(job.scheduledStart, timezone) }
        : crewGroup(job);
    const current = groups.get(grouping.key) ?? { label: grouping.label, jobs: [] };
    current.jobs.push(job);
    groups.set(grouping.key, current);
  }

  return [...groups.entries()].map(([key, group]) => ({
    key,
    label: group.label,
    jobs: group.jobs,
  }));
}

function ScheduleJobCard({
  job,
  timezone,
  canManageInvoiceReadiness,
}: {
  job: DispatchJob;
  timezone: string;
  canManageInvoiceReadiness: boolean;
}) {
  return (
    <article className="rounded-xl border border-border/70 bg-background/80 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{job.title}</div>
          <div className="mt-0.5 truncate text-sm text-muted-foreground">
            {job.customer?.name ?? "No customer linked"}
            {job.project ? ` · ${job.project.name}` : ""}
          </div>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Schedule</p>
          <p className="mt-1 text-foreground">
            {job.scheduledStart ? formatScheduleInZone(job.scheduledStart, timezone) : "Unscheduled"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Crew</p>
          <div className="mt-1 text-foreground">
            <AssignedTechnicians technicians={job.assignedTechnicians} />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {job.priority ? <StatusBadge status={job.priority} /> : null}
        {job.isOverdue ? <StatusBadge status="overdue" /> : null}
        {job.needsAttention ? <StatusBadge status="needs_attention" /> : null}
      </div>

      <DispatchJobActions job={job} canManageInvoiceReadiness={canManageInvoiceReadiness} />
    </article>
  );
}

export function ScheduleModeNav({ mode }: { mode: ScheduleMode | "attention" | "queue" }) {
  const links = [
    { label: "Day", href: "/dispatch", active: mode === "day" },
    { label: "Week", href: "/dispatch?mode=week", active: mode === "week" },
    { label: "Crew", href: "/dispatch?mode=crew", active: mode === "crew" },
    { label: "Attention queue", href: "/dispatch?view=attention", active: mode === "attention" },
  ];

  return (
    <nav aria-label="Schedule views" className="flex gap-2 overflow-x-auto pb-1">
      {links.map((link) => (
        <Link
          key={link.label}
          href={link.href}
          aria-current={link.active ? "page" : undefined}
          className={cn(
            "min-h-10 shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
            link.active
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border/70 bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function ScheduleBoard({
  mode,
  scheduledJobs,
  scheduledTotal,
  unscheduledJobs,
  unscheduledTotal,
  timezone,
  canManageInvoiceReadiness,
}: ScheduleBoardProps) {
  const groups = groupJobs(scheduledJobs, mode, timezone);
  const visibleUnscheduledJobs = unscheduledJobs.slice(0, 6);
  const rangeLabel = mode === "day" ? "Today" : mode === "week" ? "This week" : "Crew schedule";

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-border/70 bg-card p-4 lg:sticky lg:top-20 lg:self-start" aria-labelledby="unscheduled-heading">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Planning tray</p>
            <h2 id="unscheduled-heading" className="mt-1 font-heading text-lg font-semibold">Unscheduled</h2>
          </div>
          <span className="text-sm font-semibold text-primary">{unscheduledTotal}</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Real Jobs waiting for a schedule slot.</p>

        <div className="mt-4 grid gap-3">
          {unscheduledJobs.length === 0 ? (
            <p className="rounded-xl bg-muted/30 px-3 py-4 text-sm text-muted-foreground">No unscheduled jobs.</p>
          ) : (
            visibleUnscheduledJobs.map((job) => (
              <div key={job.id} className="rounded-xl border border-border/70 bg-background/80 p-3">
                <div className="font-medium text-foreground">{job.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {job.customer?.name ?? "No customer linked"} · #{job.jobNumber}
                </div>
                <div className="mt-2">
                  <DispatchJobActions job={job} canManageInvoiceReadiness={canManageInvoiceReadiness} />
                </div>
              </div>
            ))
          )}
        </div>

        {unscheduledTotal > visibleUnscheduledJobs.length ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Showing {visibleUnscheduledJobs.length} of {unscheduledTotal} unscheduled jobs.
          </p>
        ) : null}

        <Link href="/dispatch?view=all&status=unscheduled" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4 w-full justify-center")}>
          Open all unscheduled
        </Link>
      </aside>

      <section className="min-w-0 space-y-4" aria-labelledby="schedule-board-heading">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border/70 pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{rangeLabel}</p>
            <h2 id="schedule-board-heading" className="mt-1 font-heading text-xl font-semibold">
              {mode === "week" ? "Scheduled work by day" : mode === "crew" ? "Scheduled work by crew" : "Scheduled work by crew"}
            </h2>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>{scheduledTotal} scheduled job{scheduledTotal === 1 ? "" : "s"}</div>
            <div>Times use {timezone}</div>
          </div>
        </header>

        {scheduledJobs.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title={mode === "day" ? "Nothing scheduled today" : "No scheduled work in this view"}
            description="Schedule an awarded Job from the Unscheduled tray or widen the view."
          />
        ) : (
          <div className="grid gap-4">
            {groups.map((group) => (
              <section key={group.key} className="rounded-2xl border border-border/70 bg-card p-4">
                <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
                  <h3 className="font-heading text-base font-semibold">{group.label}</h3>
                  <span className="text-xs text-muted-foreground">{group.jobs.length} job{group.jobs.length === 1 ? "" : "s"}</span>
                </div>
                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                  {group.jobs.map((job) => (
                    <ScheduleJobCard
                      key={job.id}
                      job={job}
                      timezone={timezone}
                      canManageInvoiceReadiness={canManageInvoiceReadiness}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {scheduledTotal > scheduledJobs.length ? (
          <p className="text-xs text-muted-foreground">
            Showing {scheduledJobs.length} of {scheduledTotal} scheduled jobs in this bounded workspace.
          </p>
        ) : null}

        <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          Schedule and reschedule writes use the existing Job schedule contract. Use Check conflicts before saving when timing or assignment may overlap; authorized conflict overrides still require the existing reason and backend policy.
        </div>
      </section>
    </div>
  );
}
