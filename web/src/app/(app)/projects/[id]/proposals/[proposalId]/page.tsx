import Link from "next/link";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { ProposalContextPanel } from "@/components/proposals/proposal-context-panel";
import { ProposalLifecyclePanel } from "@/components/proposals/proposal-lifecycle-panel";
import { ProposalReviewForm } from "@/components/proposals/proposal-review-form";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { SummaryMetricCard } from "@/components/shared/summary-metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProject, getProposal } from "@/lib/api";
import { buildProposalTimeline, formatInvoiceCurrency, getProposalDisplayStatus } from "@/lib/document-workflow";
import { getSessionToken } from "@/lib/session";

export default async function ProposalDetailPage({ params }: { params: Promise<{ id: string; proposalId: string }> }) {
  const { id: projectId, proposalId } = await params;
  const token = await getSessionToken();
  const [project, proposal] = await Promise.all([getProject(token ?? "", projectId), getProposal(token ?? "", proposalId)]);
  const paymentSchedule = Array.isArray(proposal.paymentScheduleJson) ? proposal.paymentScheduleJson : [];
  const timeline = buildProposalTimeline(proposal);
  const displayStatus = getProposalDisplayStatus(proposal);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Proposal Review"
        description="Review the final scope, pricing, and payment milestones before the proposal goes out. Keep this page as the source of truth from internal review through customer decision."
        backHref={`/projects/${projectId}`}
        backLabel="Back to project"
        action={<StatusBadge status={displayStatus} />}
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Draft editor</CardTitle>
          </CardHeader>
          <CardContent>
            <ProposalReviewForm projectId={projectId} proposal={proposal} />
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="border-border/70 bg-muted/10">
            <CardHeader>
              <CardTitle>Proposal snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Customer</div>
                <div className="mt-1 font-medium">{project.customer?.name ?? "No customer linked"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Project address</div>
                <div className="mt-1">{project.siteAddress ?? "No address saved"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Next milestone</div>
                <div className="mt-1 font-medium">{getNextMilestone(displayStatus)}</div>
              </div>
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
                <SummaryMetricCard label="Low" value={formatInvoiceCurrency(proposal.priceLow)} />
                <SummaryMetricCard label="High" value={formatInvoiceCurrency(proposal.priceHigh)} />
                <SummaryMetricCard label="Final" value={formatInvoiceCurrency(proposal.finalPrice)} />
              </div>
              <div className="flex flex-col gap-3">
                <Link href={`/projects/${projectId}/proposals/${proposal.id}/preview`} className={buttonVariants()}>
                  Preview PDF
                </Link>
                <a
                  href={`/api/documents/proposals/${proposal.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "outline" })}
                >
                  Download PDF
                </a>
              </div>
            </CardContent>
          </Card>

          <ProposalLifecyclePanel projectId={projectId} proposal={proposal} />

          <ActivityTimeline title="Proposal activity" items={timeline} />

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Payment schedule</CardTitle>
            </CardHeader>
            <CardContent>
              {paymentSchedule.length === 0 ? (
                <EmptyState title="No payment schedule saved." description="Add milestone payments before sending the proposal." />
              ) : (
                <ul className="space-y-3 text-sm">
                  {paymentSchedule.map((entry, index) => {
                    const item = entry as { label?: string; amountPercent?: number; notes?: string };
                    return (
                      <li key={`${item.label ?? "payment"}-${index}`} className="rounded-lg border border-border/60 p-3">
                        <div className="font-medium">{item.label ?? `Payment ${index + 1}`}</div>
                        <div className="text-muted-foreground">{item.amountPercent ?? 0}%</div>
                        {item.notes && <div className="mt-1 text-muted-foreground">{item.notes}</div>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <ProposalContextPanel latestVisit={project.siteVisits[0] ?? null} projectFiles={project.projectFiles} />
        </div>
      </div>
    </div>
  );
}

function getNextMilestone(status: string) {
  switch (status) {
    case "draft":
      return "Issue the proposal to the customer";
    case "sent":
      return "Track the customer response";
    case "viewed":
      return "Follow up and close the decision";
    case "accepted":
      return "Generate the contract";
    case "declined":
      return "Revise and resend a stronger draft";
    case "expired":
      return "Reissue or duplicate a fresh proposal";
    default:
      return "Review the current state";
  }
}
