import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAthenaCapabilities, getFieldJob, getOrganizationSettings } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { canReviewAthenaApprovals, canUseJobAthena } from "@/lib/athena-job-access";
import { formatScheduleInZone } from "@/lib/document-workflow";
import { readApprovedJobBaseline } from "@/lib/job-approved-baseline";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { JobAthenaWorkspace } from "./job-athena-workspace";

export const metadata = {
  title: "Athena · Job workspace | TradeOS",
  description: "Ask Athena about this job with the record attached, and confirm job notes before they are saved.",
};

/**
 * DES-4 Option A — the job-scoped Athena contractor route (canonical Figma
 * frame 289:2). The workspace reuses the Athena kernel and tools; /athena
 * stays the owner/admin observability surface and is untouched here.
 *
 * Access is decided by canUseJobAthena: owner/admin/dispatcher for any job,
 * technician only for a job they are assigned to. The backend remains the
 * authority for every write (the note write goes through the existing Job
 * note service with scoped access and forced RLS).
 */
export default async function JobAthenaPage({
  params,
}: {
  params: Promise<{ id: string; jobId: string }>;
}) {
  const { id: projectId, jobId } = await params;
  const token = await getSessionToken();
  if (!token) redirect("/login");

  const settings = await getOrganizationSettings(token);
  const job = await getFieldJob(token, jobId);
  if (job.project?.id !== projectId) notFound();

  const access = canUseJobAthena(
    settings.currentRole,
    settings.currentUserId,
    job.assignedTechnicians.map((technician) => technician.userId)
  );
  if (!access.granted) {
    // Technicians reach this route from /field; everyone else from the job page.
    redirect(
      access.reason === "technician_not_assigned"
        ? `/field?job=${encodeURIComponent(jobId)}`
        : `/projects/${projectId}/jobs/${jobId}`
    );
  }

  const timezone = settings.settings.timezone || "UTC";
  const approved = readApprovedJobBaseline(job.acceptedBaselineJson);

  // Same capability gate as the app-shell navigation: when the kernel is
  // positively disabled, render an unavailable state instead of a workspace
  // that rejects every request. A failed check still renders the workspace
  // (fail open): the workspace surfaces the backend error if the kernel is
  // truly off, and works normally if the failure was transient.
  const athenaCapabilities = await getAthenaCapabilities(token).catch(() => null);
  if (athenaCapabilities?.kernelEnabled === false) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <PageHeader
          title={`Athena · ${job.title}`}
          description={`Field job #${job.jobNumber} · ${job.customer?.name ?? "Customer unavailable"}`}
          breadcrumbs={[
            { label: "Project", href: `/projects/${projectId}` },
            { label: "Job", href: `/projects/${projectId}/jobs/${jobId}` },
            { label: "Athena" },
          ]}
          action={<StatusBadge status={job.status} />}
        />
        <EmptyState
          title="Athena isn't enabled for this workspace yet"
          description="The Athena kernel is disabled, so this job workspace can't answer right now. Ask an owner or admin to enable it, or go back to the job."
          action={
            <Link href={`/projects/${projectId}/jobs/${jobId}`} className="font-medium text-copper underline">
              Back to the job
            </Link>
          }
        />
      </div>
    );
  }

  const latestNote = job.notes[0];
  const scopeDetails: Record<string, string> = {
    Job: `${job.title} · ${job.jobNumber} · ${job.status}`,
    Project: job.project?.name ?? "No project linked",
    Customer: job.customer?.name ?? "No customer linked",
    ...(approved ? { Estimate: "Accepted proposal baseline" } : {}),
    ...(latestNote
      ? { "Field notes": `Latest note ${formatScheduleInZone(latestNote.createdAt, timezone)}` }
      : {}),
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <PageHeader
        title={`Athena · ${job.title}`}
        description={`Field job #${job.jobNumber} · ${job.customer?.name ?? "Customer unavailable"}`}
        breadcrumbs={[
          { label: "Project", href: `/projects/${projectId}` },
          { label: "Job", href: `/projects/${projectId}/jobs/${jobId}` },
          { label: "Athena" },
        ]}
        action={<StatusBadge status={job.status} />}
      />

      <JobAthenaWorkspace
        jobId={job.id}
        projectId={projectId}
        customerId={job.customer?.id}
        jobNumber={job.jobNumber}
        jobTitle={job.title}
        scopeDetails={scopeDetails}
        canReviewApprovals={canReviewAthenaApprovals(settings.currentRole)}
      />

      <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5" aria-labelledby="job-athena-notes-heading">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Job notes</p>
        <h2 id="job-athena-notes-heading" className="mt-1 font-heading text-lg font-medium">
          Recent notes
        </h2>
        {job.notes.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {job.notes.slice(0, 5).map((note) => (
              <article key={note.id} className="rounded-xl bg-muted/40 p-3">
                <p className="whitespace-pre-wrap text-sm">{note.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">{formatScheduleInZone(note.createdAt, timezone)}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-muted/30 px-3 py-3 text-sm text-muted-foreground">No field notes yet.</p>
        )}
      </section>
    </div>
  );
}
