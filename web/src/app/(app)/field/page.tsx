import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldJobActions } from "@/components/field/field-job-actions";
import { FieldNoteForm } from "@/components/field/field-note-form";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  getFieldJob,
  getDispatchSummary,
  getOrganizationSettings,
  listFieldJobs,
  ApiClientError,
  type FieldJobDetail,
} from "@/lib/api";
import { formatScheduleInZone } from "@/lib/document-workflow";
import { getSessionToken } from "@/lib/session";

export const metadata: Metadata = {
  title: "My field day | TradeOS",
  description: "A focused mobile workspace for technicians to see today's jobs, act on the current job, and report back to the office.",
};

function formatAddress(address: FieldJobDetail["serviceAddress"]) {
  if (!address) return "Service address unavailable";
  return [address.addressLine1, address.addressLine2, `${address.city}, ${address.state} ${address.postalCode}`].filter(Boolean).join(", ");
}

function mapsHref(address: FieldJobDetail["serviceAddress"]) {
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddress(address))}`;
}

function errorMessage(error: unknown) {
  return error instanceof ApiClientError ? error.message : "Unable to load the field workspace.";
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const FIELD_STATUS_PRIORITY: Record<FieldJobDetail["status"], number> = {
  on_site: 0,
  traveling: 1,
  paused: 2,
  dispatched: 3,
  scheduled: 4,
  unscheduled: 5,
  completed: 6,
  cancelled: 7,
};

function prioritizeFieldJobs(jobs: Awaited<ReturnType<typeof listFieldJobs>>) {
  return [...jobs].sort((left, right) => FIELD_STATUS_PRIORITY[left.status] - FIELD_STATUS_PRIORITY[right.status]);
}

export default async function FieldPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string | string[]; updated?: string | string[] }>;
}) {
  const token = await getSessionToken();
  if (!token) return <EmptyState title="Sign in to view your field day" description="Your assigned jobs appear here after authentication." />;

  const query = await searchParams;
  const settings = await getOrganizationSettings(token);
  if (settings.currentRole !== "technician") {
    return <EmptyState title="Technician workspace" description="This workspace is available to technician accounts. Open Dispatch for organization scheduling and coordination." />;
  }

  let jobs: Awaited<ReturnType<typeof listFieldJobs>> = [];
  let loadError: string | null = null;
  try {
    const summary = await getDispatchSummary(token);
    jobs = prioritizeFieldJobs(await listFieldJobs(token, summary.todayRangeUtc));
  } catch (error) {
    loadError = errorMessage(error);
  }

  const requestedJobId = firstSearchParam(query.job)?.trim() || null;
  const updated = firstSearchParam(query.updated);
  if (loadError && !requestedJobId) {
    return <EmptyState title="Couldn't load your field day" description={loadError} />;
  }

  const selectedId = requestedJobId ?? jobs[0]?.id;
  let selectedJob: FieldJobDetail | null = null;
  let selectedError: string | null = null;

  if (selectedId) {
    try {
      const job = await getFieldJob(token, selectedId);
      if (job.archivedAt) {
        selectedError = "This job is archived. Open an active assigned job instead.";
      } else {
        selectedJob = job;
      }
    } catch (error) {
      selectedError = errorMessage(error);
    }
  }

  const selectedOutsideToday = Boolean(
    selectedJob &&
      requestedJobId &&
      !loadError &&
      !jobs.some((job) => job.id === selectedJob.id)
  );
  const visibleJobs = selectedJob
    ? [selectedJob, ...jobs.filter((job) => job.id !== selectedJob.id)]
    : jobs;
  const timezone = settings.settings.timezone || "UTC";
  const addressLink = mapsHref(selectedJob?.serviceAddress ?? null);

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4 pb-28 sm:gap-5 2xl:pb-6">
      <header className="grid gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-copper">Field day</p>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              {selectedOutsideToday ? "Field job" : "Today"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {loadError
                ? "Today’s assigned job list is unavailable."
                : `${jobs.length} assigned job${jobs.length === 1 ? "" : "s"} today · current job first`}
            </p>
          </div>
          <a href="/dispatch" className="hidden shrink-0 text-sm font-medium text-copper hover:underline sm:block">Open Dispatch</a>
        </div>
      </header>

      {updated ? (
        <p className="rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success" role="status">
          Job updated successfully.
        </p>
      ) : null}

      {loadError && selectedJob ? (
        <p className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground" role="status">
          Today’s assigned job list couldn’t load. You’re viewing the assigned job you opened directly.
        </p>
      ) : null}

      {selectedOutsideToday ? (
        <p className="rounded-xl border border-info/30 bg-info/10 px-4 py-3 text-sm text-info-foreground" role="status">
          This assigned job is outside today’s list. You’re viewing it because it was opened directly.
        </p>
      ) : null}

      {!selectedId ? (
        <EmptyState title="No assigned jobs today" description="Your dispatcher has not assigned work for today. This view only shows jobs assigned to your authenticated technician account." />
      ) : selectedError ? (
        <EmptyState title="Couldn't load this job" description={selectedError} />
      ) : selectedJob ? (
        <>
          <nav aria-label="Field jobs" className="flex gap-2 overflow-x-auto pb-1">
            {visibleJobs.map((job) => (
              <a
                key={job.id}
                href={`/field?job=${encodeURIComponent(job.id)}`}
                aria-current={job.id === selectedId ? "page" : undefined}
                className={`min-w-[10rem] shrink-0 rounded-xl border px-3 py-2.5 transition-colors ${
                  job.id === selectedId ? "border-copper bg-copper/10" : "border-border/70 bg-card hover:bg-muted/50"
                }`}
              >
                <span className="block truncate text-xs text-muted-foreground">#{job.jobNumber}</span>
                <span className="mt-0.5 block truncate text-sm font-medium">{job.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {job.scheduledStart ? formatScheduleInZone(job.scheduledStart, timezone) : "Unscheduled"}
                </span>
              </a>
            ))}
          </nav>

          <section aria-labelledby="current-job-heading" className="grid gap-4">
            <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
              <header className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">#{selectedJob.jobNumber} · {selectedJob.jobType}</p>
                  <h2 id="current-job-heading" className="mt-1 truncate font-heading text-xl font-semibold tracking-tight sm:text-2xl">
                    {selectedJob.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedJob.customer?.name ?? "No customer linked"} · {selectedJob.project?.name ?? "No project linked"}
                  </p>
                </div>
                <StatusBadge status={selectedJob.status} />
              </header>

              <div className="grid gap-4 p-4 sm:p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <section className="rounded-xl border border-border/70 bg-background/70 p-3" aria-label="Job schedule">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {selectedOutsideToday ? "Schedule" : "Today on site"}
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {selectedJob.scheduledStart ? formatScheduleInZone(selectedJob.scheduledStart, timezone) : "Unscheduled"}
                    </p>
                    {selectedJob.arrivalWindowStart && selectedJob.arrivalWindowEnd ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Arrival {formatScheduleInZone(selectedJob.arrivalWindowStart, timezone)} – {formatScheduleInZone(selectedJob.arrivalWindowEnd, timezone)}
                      </p>
                    ) : null}
                    {selectedJob.actualStart ? (
                      <p className="mt-1 text-xs text-muted-foreground">Started {formatScheduleInZone(selectedJob.actualStart, timezone)}</p>
                    ) : null}
                  </section>

                  <section className="rounded-xl border border-border/70 bg-background/70 p-3" aria-label="Job location">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Location</p>
                    <p className="mt-1 text-sm font-medium">{formatAddress(selectedJob.serviceAddress)}</p>
                    {addressLink ? (
                      <a href={addressLink} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-10 items-center text-xs font-semibold text-copper hover:underline">
                        Open directions
                      </a>
                    ) : null}
                  </section>
                </div>

                {selectedJob.status === "completed" ? (
                  <section className="rounded-xl border border-success/30 bg-success/10 p-4" aria-label="Field completion">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-success">Field complete</p>
                    <p className="mt-1 text-sm font-medium text-foreground">Field work is complete.</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {selectedJob.readyForInvoiceAt
                        ? "The office has marked this job ready for invoice."
                        : "Ready for invoice is a separate office handoff; completing field work does not create or send an invoice."}
                    </p>
                  </section>
                ) : null}

                <section className="rounded-xl border border-border/70 bg-background/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {selectedJob.status === "completed" ? "Completed work" : "Work briefing"}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                    {selectedJob.description || "No additional briefing was provided."}
                  </p>
                </section>

                {selectedJob.equipment.length > 0 ? (
                  <details className="rounded-xl border border-border/70 bg-background/70">
                    <summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium">
                      Equipment <span className="ml-1 text-muted-foreground">({selectedJob.equipment.length})</span>
                    </summary>
                    <ul className="grid gap-2 border-t border-border/60 px-3 py-3 text-sm text-muted-foreground">
                      {selectedJob.equipment.map((item) => (
                        <li key={item.id}>{item.name}{item.serialNumber ? ` · ${item.serialNumber}` : ""}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            </section>

            {selectedJob.status !== "completed" && selectedJob.status !== "cancelled" ? (
              <section className="grid gap-2" aria-labelledby="field-action-heading">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Field action</p>
                  <h3 id="field-action-heading" className="mt-1 font-heading text-lg font-medium">What happens next?</h3>
                </div>
                <FieldJobActions job={selectedJob} />
              </section>
            ) : null}

            <section className="grid gap-4 rounded-2xl border border-border/70 bg-card p-4 sm:p-5" aria-labelledby="report-back-heading">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Report back</p>
                <h3 id="report-back-heading" className="mt-1 font-heading text-lg font-medium">Job notes</h3>
                <p className="mt-1 text-sm text-muted-foreground">Leave the office the field context it actually needs.</p>
              </div>

              {selectedJob.notes.length > 0 ? (
                <div className="grid gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Recent notes</p>
                  {selectedJob.notes.map((note) => (
                    <article key={note.id} className="rounded-xl bg-muted/40 p-3">
                      <p className="whitespace-pre-wrap text-sm">{note.body}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{formatScheduleInZone(note.createdAt, timezone)}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl bg-muted/30 px-3 py-3 text-sm text-muted-foreground">No field notes yet.</p>
              )}

              <div className="border-t border-border/70 pt-4">
                <FieldNoteForm jobId={selectedJob.id} />
              </div>
            </section>
          </section>
        </>
      ) : null}
    </div>
  );
}
