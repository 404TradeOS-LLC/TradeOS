import Link from "next/link";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { CustomerPortalProposalActions } from "@/components/proposals/customer-portal-proposal-actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProject, getProposal } from "@/lib/api";
import { buildProposalTimeline, formatCurrency, getProposalDisplayStatus } from "@/lib/document-workflow";
import { getSessionToken } from "@/lib/session";

export default async function CustomerPortalProposalPage({ params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;
  const token = await getSessionToken();
  const proposal = await getProposal(token ?? "", proposalId);
  const project = await getProject(token ?? "", proposal.projectId);
  const timeline = buildProposalTimeline(proposal);
  const displayStatus = getProposalDisplayStatus(proposal);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link href={`/portal/projects/${project.id}`} className="text-sm text-muted-foreground underline">
            ← Back to project portal
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">Proposal review</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">Review the scope, timeline, payment schedule, and approve the work when you are ready.</p>
        </div>
        <StatusBadge status={displayStatus} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Project summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 text-sm">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Customer</div>
              <div className="mt-2 font-medium">{project.customer?.name ?? "Customer"}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Project address</div>
              <div className="mt-2 font-medium">{project.siteAddress ?? "Address to be confirmed"}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 md:col-span-2">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Scope of work</div>
              <div className="mt-2 whitespace-pre-wrap text-muted-foreground">{proposal.scopeOfWork ?? "Scope will be finalized before production."}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Timeline</div>
              <div className="mt-2 font-medium">{proposal.timeline ?? "Scheduling to be confirmed"}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Investment</div>
              <div className="mt-2 font-medium">{formatCurrency(proposal.finalPrice ?? proposal.priceHigh ?? proposal.priceLow)}</div>
            </div>
          </CardContent>
        </Card>

        <ActivityTimeline title="Proposal timeline" items={timeline} />
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <a href={`/api/documents/proposals/${proposal.id}/pdf`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
            Download proposal PDF
          </a>

          <CustomerPortalProposalActions projectId={project.id} proposal={{ id: proposal.id, status: proposal.status }} />
        </CardContent>
      </Card>
    </div>
  );
}
