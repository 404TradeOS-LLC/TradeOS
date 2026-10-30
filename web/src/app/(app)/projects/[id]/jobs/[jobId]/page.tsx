import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getFieldJob, getOrganizationSettings } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { formatApprovedMoney, readApprovedJobBaseline } from "@/lib/job-approved-baseline";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";

const MANAGER_ROLES = new Set(["owner", "admin", "dispatcher"]);

export default async function JobApprovalHandoffPage({
  params,
}: {
  params: Promise<{ id: string; jobId: string }>;
}) {
  const { id: projectId, jobId } = await params;
  const token = await getSessionToken();
  if (!token) redirect("/login");

  const settings = await getOrganizationSettings(token);
  if (!MANAGER_ROLES.has(settings.currentRole)) redirect(`/projects/${projectId}`);

  // The job endpoint uses scoped Job access and forced RLS; never fetch the
  // approved proposal directly from a caller-supplied cross-tenant ID.
  const job = await getFieldJob(token, jobId);
  if (job.project?.id !== projectId) notFound();
  const approved = readApprovedJobBaseline(job.acceptedBaselineJson);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <PageHeader
        title={job.title}
        description={`Field job #${job.jobNumber} · ${job.customer?.name ?? "Customer unavailable"}`}
        breadcrumbs={[
          { label: "Project", href: `/projects/${projectId}` },
          { label: "Approved job handoff" },
        ]}
        action={<StatusBadge status={job.status} />}
      />
      <section className="rounded-2xl border border-border/70 bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold">Accepted proposal baseline</h2>
          {approved ? (
            <Link className="text-sm font-semibold text-copper underline-offset-4 hover:underline"
              href={`/projects/${projectId}/proposals/${approved.proposalId}`}>
              Open original approved proposal
            </Link>
          ) : null}
        </div>
        {approved ? (
          <div className="mt-4 grid gap-4">
            <div className="rounded-lg bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Approved contract amount</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{formatApprovedMoney(approved.finalPrice)}</p>
              {approved.finalPrice === null ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  This proposal has no finalized price. Its approved range is informational, not a guaranteed job total.
                </p>
              ) : null}
              {(approved.priceLow || approved.priceHigh) ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Original range: {formatApprovedMoney(approved.priceLow)}–{formatApprovedMoney(approved.priceHigh)}
                </p>
              ) : null}
            </div>
            <div>
              <h3 className="text-sm font-semibold">Approved scope</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm">{approved.scopeOfWork ?? "No written scope recorded in the accepted proposal."}</p>
            </div>
            {([
              ["Assumptions", approved.assumptions],
              ["Exclusions", approved.exclusions],
              ["Timeline", approved.timeline],
              ["Payment terms", approved.termsAndConditions],
            ] as const).filter((entry) => entry[1]).map(([title, value]) => (
              <div key={title}>
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{value}</p>
              </div>
            ))}
            {approved.paymentMilestones.length > 0 ? (
              <section aria-label="Accepted payment milestones">
                <h3 className="text-sm font-semibold">Payment milestones</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {approved.paymentMilestones.map((entry, i) => (
                    <li key={i}>{entry.label}: {entry.amountPercent}%</li>
                  ))}
                </ul>
              </section>
            ) : null}
            <p className="text-xs text-muted-foreground">
              This is the immutable approval snapshot. Later change orders do not silently replace the baseline.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            This job was not created from an accepted proposal or its approval snapshot is unavailable.
          </p>
        )}
      </section>
      <div className="flex flex-wrap gap-4 text-sm">
        <Link href={`/projects/${projectId}`} className="font-medium text-copper underline">Project workspace</Link>
        <Link href={`/dispatch?view=all&q=${encodeURIComponent(job.jobNumber)}`} className="font-medium text-copper underline">Open Dispatch</Link>
      </div>
    </div>
  );
}
