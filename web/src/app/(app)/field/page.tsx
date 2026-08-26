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
  description: "Assigned jobs, job context, field status actions, and notes for technicians.",
};

function formatAddress(address: FieldJobDetail["serviceAddress"]) {
  if (!address) return "Service address unavailable";
  return [address.addressLine1, address.addressLine2, `${address.city}, ${address.state} ${address.postalCode}`].filter(Boolean).join(", ");
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

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Field day</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Your assigned work</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">Job context, field actions, and notes in one place. Updates are saved to the job record and visible to the office.</p>
      </header>

      {query.updated ? <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary" role="status">Job updated successfully.</p> : null}

      {jobs.length === 0 ? (
        <EmptyState title="No assigned jobs today" description="Your dispatcher has not assigned work for today. This view only shows jobs assigned to your authenticated technician account." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(16rem,0.35fr)_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Today</CardTitle>
              <CardDescription>{jobs.length} assigned job{jobs.length === 1 ? "" : "s"}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {jobs.map((job) => (
                <a key={job.id} href={`/field?job=${encodeURIComponent(job.id)}`} className={`grid gap-1 rounded-xl border px-3 py-3 transition-colors hover:bg-muted/60 ${job.id === selectedId ? "border-primary bg-primary/5" : "border-border/70"}`}>
                  <span className="text-xs text-muted-foreground">#{job.jobNumber}</span>
                  <span className="font-medium">{job.title}</span>
                  <span className="text-sm text-muted-foreground">{job.scheduledStart ? formatScheduleInZone(job.scheduledStart, timezone) : "Unscheduled"}</span>
                  <StatusBadge status={job.status} />
                </a>
              ))}
            </CardContent>
          </Card>

          {selectedError ? <EmptyState title="Couldn't load this job" description={selectedError} /> : selectedJob ? (
            <div className="grid gap-6">
              <Card>
                <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">#{selectedJob.jobNumber} · {selectedJob.jobType}</p>
                    <CardTitle className="text-2xl">{selectedJob.title}</CardTitle>
                    <CardDescription>{selectedJob.project?.name ?? "No project linked"} · {selectedJob.customer?.name ?? "No customer linked"}</CardDescription>
                  </div>
                  <StatusBadge status={selectedJob.status} />
                </CardHeader>
                <CardContent className="grid gap-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Schedule</p><p className="mt-1">{selectedJob.scheduledStart ? formatScheduleInZone(selectedJob.scheduledStart, timezone) : "Unscheduled"}</p></div>
                    <div><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Arrival window</p><p className="mt-1">{selectedJob.arrivalWindowStart && selectedJob.arrivalWindowEnd ? `${formatScheduleInZone(selectedJob.arrivalWindowStart, timezone)} – ${formatScheduleInZone(selectedJob.arrivalWindowEnd, timezone)}` : "No arrival window"}</p></div>
                  </div>
                  <div><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Service address</p><p className="mt-1">{formatAddress(selectedJob.serviceAddress)}</p></div>
                  <div><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Job briefing</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{selectedJob.description || "No additional briefing was provided."}</p></div>
                  {selectedJob.equipment.length > 0 ? <div><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Equipment</p><ul className="mt-1 grid gap-1 text-sm text-muted-foreground">{selectedJob.equipment.map((item) => <li key={item.id}>{item.name}{item.serialNumber ? ` · ${item.serialNumber}` : ""}</li>)}</ul></div> : null}
                  <FieldJobActions job={selectedJob} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Job notes</CardTitle><CardDescription>Keep the office up to date with observations from the field.</CardDescription></CardHeader>
                <CardContent className="grid gap-5">
                  <FieldNoteForm jobId={selectedJob.id} />
                  {selectedJob.notes.length > 0 ? <div className="grid gap-3 border-t border-border/70 pt-4">{selectedJob.notes.map((note) => <article key={note.id} className="rounded-lg bg-muted/40 p-3"><p className="whitespace-pre-wrap text-sm">{note.body}</p><p className="mt-2 text-xs text-muted-foreground">{formatScheduleInZone(note.createdAt, timezone)}</p></article>)}</div> : <p className="text-sm text-muted-foreground">No notes yet.</p>}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
