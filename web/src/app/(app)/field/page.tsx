import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldJobActions } from "@/components/field/field-job-actions";
import { FieldNoteForm } from "@/components/field/field-note-form";
import { StatusBadge } from "@/components/shared/status-badge";
import { getFieldJob, getDispatchSummary, getOrganizationSettings, listFieldJobs, ApiClientError, type FieldJobDetail } from "@/lib/api";
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

export default async function FieldPage({ searchParams }: { searchParams: Promise<{ job?: string; updated?: string }> }) {
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
    jobs = await listFieldJobs(token, summary.todayRangeUtc);
  } catch (error) {
    loadError = errorMessage(error);
  }

  if (loadError) return <EmptyState title="Couldn't load your field day" description={loadError} />;

  const selectedId = query.job && jobs.some((job) => job.id === query.job) ? query.job : jobs[0]?.id;
  let selectedJob: FieldJobDetail | null = null;
  let selectedError: string | null = null;

  if (selectedId) {
    try {
      selectedJob = await getFieldJob(token, selectedId);
    } catch (error) {
      selectedError = errorMessage(error);
    }
  }

  const timezone = settings.settings.timezone || "UTC";
  const addressLink = mapsHref(selectedJob?.serviceAddress ?? null);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 pb-6 sm:gap-6">
      <header className="grid gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-foreground">Field day</p>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Today</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {jobs.length} assigned job{jobs.length === 1 ? "" : "s"} · work from the current job
            </p>
          </div>
          <a href="/dispatch" className="hidden text-sm font-medium text-copper hover:underline sm:block">Open Dispatch</a>
        </div>
      </header>

      {query.updated ? (
        <p className="rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success" role="status">
          Job updated successfully.
        </p>
      ) : null}

      {jobs.length === 0 ? (
        <EmptyState title="No assigned jobs today" description="Your dispatcher has not assigned work for today. This view only shows jobs assigned to your authenticated technician account." />
      ) : selectedError ? (
        <EmptyState title="Couldn't load this job" description={selectedError} />
      ) : selectedJob ? (
        <>
          <nav aria-label="Today's jobs" className="flex gap-2 overflow-x-auto pb-1">
            {jobs.map((job) => (
              <a
                key={job.id}
                href={`/field?job=${encodeURIComponent(job.id)}`}
                aria-current={job.id === selectedId ? "page" : undefined}
                className={`min-w-[10rem] shrink-0 rounded-xl border px-3 py-2.5 transition-colors ${job.id === selectedId ? "border-copper bg-copper/10" : "border-border/70 bg-card hover:bg-muted/50"}`}
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
            <Card className="overflow-hidden border-copper/30 shadow-sm">
              <CardHeader className="gap-3 border-b border-border/60 bg-muted/15 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">#{selectedJob.jobNumber} · {selectedJob.jobType}</p>
                    <CardTitle id="current-job-heading" className="mt-1 text-xl sm:text-2xl">{selectedJob.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {selectedJob.customer?.name ?? "No customer linked"} · {selectedJob.project?.name ?? "No project linked"}
                    </CardDescription>
                  </div>
                  <StatusBadge status={selectedJob.status} />
                </div>
              </CardHeader>

              <CardContent className="grid gap-4 p-4 sm:p-5">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/70 bg-background p-3">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Schedule</p>
                    <p className="mt-1 text-sm font-medium">
                      {selectedJob.scheduledStart ? formatScheduleInZone(selectedJob.scheduledStart, timezone) : "Unscheduled"}
                    </p>
                    {selectedJob.arrivalWindowStart && selectedJob.arrivalWindowEnd ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Arrival {formatScheduleInZone(selectedJob.arrivalWindowStart, timezone)} – {formatScheduleInZone(selectedJob.arrivalWindowEnd, timezone)}
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-border/70 bg-background p-3">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Site</p>
                    <p className="mt-1 text-sm font-medium">{formatAddress(selectedJob.serviceAddress)}</p>
                    {addressLink ? (
                      <a href={addressLink} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-medium text-copper hover:underline">
                        Open directions
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-background p-3">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Job briefing</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                    {selectedJob.description || "No additional briefing was provided."}
                  </p>
                </div>

                {selectedJob.equipment.length > 0 ? (
                  <details className="rounded-xl border border-border/70 bg-background">
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

                <div className="rounded-xl border border-copper/25 bg-copper/5 p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Next action</p>
                  <FieldJobActions job={selectedJob} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 sm:p-5">
                <CardTitle className="text-lg">Report back</CardTitle>
                <CardDescription>Add a note the office can act on without leaving the job.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 p-4 pt-0 sm:p-5 sm:pt-0">
                <FieldNoteForm jobId={selectedJob.id} />
                {selectedJob.notes.length > 0 ? (
                  <div className="grid gap-2 border-t border-border/70 pt-4">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Recent notes</p>
                    {selectedJob.notes.map((note) => (
                      <article key={note.id} className="rounded-xl bg-muted/40 p-3">
                        <p className="whitespace-pre-wrap text-sm">{note.body}</p>
                        <p className="mt-2 text-xs text-muted-foreground">{formatScheduleInZone(note.createdAt, timezone)}</p>
                      </article>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}
