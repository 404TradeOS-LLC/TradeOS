import Link from "next/link";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPortalProposal, getPortalProject } from "@/lib/api";
import { buildProposalTimeline, formatCurrency, getProposalDisplayStatus } from "@/lib/document-workflow";

export default async function CustomerPortalProposalPage({ params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;
  const proposal = await getPortalProposal(proposalId);
  const project = await getPortalProject(proposal.projectId);
  return <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10"><div className="space-y-3"><Link href={`/customer-portal/projects/${project.id}`} className="text-sm text-muted-foreground underline">← Back to project</Link><h1 className="text-3xl font-semibold tracking-tight">Proposal review</h1><div><StatusBadge status={getProposalDisplayStatus(proposal)} /></div></div><div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]"><Card><CardHeader><CardTitle>Project summary</CardTitle></CardHeader><CardContent className="space-y-4 text-sm"><div><div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Project</div><div className="mt-1 font-medium">{project.name}</div></div><div><div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Scope of work</div><div className="mt-1 whitespace-pre-wrap text-muted-foreground">{proposal.scopeOfWork ?? "Scope will be finalized before production."}</div></div><div><div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Investment</div><div className="mt-1 font-medium">{formatCurrency(proposal.finalPrice ?? proposal.priceHigh ?? proposal.priceLow)}</div></div><div><div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Timeline</div><div className="mt-1 text-muted-foreground">{proposal.timeline ?? "Scheduling to be confirmed"}</div></div></CardContent></Card><ActivityTimeline title="Proposal timeline" items={buildProposalTimeline(proposal)} /></div><Card><CardHeader><CardTitle>Document</CardTitle></CardHeader><CardContent><a href={`/api/customer-portal/proposals/${proposal.id}/pdf`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>Download proposal PDF</a></CardContent></Card></main>;
}
