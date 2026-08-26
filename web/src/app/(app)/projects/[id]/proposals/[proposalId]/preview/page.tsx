import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SummaryMetricCard } from "@/components/shared/summary-metric-card";
import { getProject, getProposal } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export default async function ProposalPreviewPage({
  params,
}: {
  params: Promise<{ id: string; proposalId: string }>;
}) {
  const { id: projectId, proposalId } = await params;
  const token = await getSessionToken();
  const [project, proposal] = await Promise.all([getProject(token ?? "", projectId), getProposal(token ?? "", proposalId)]);
  const pdfUrl = `/api/documents/proposals/${proposal.id}/pdf?disposition=inline`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link href={`/projects/${projectId}/proposals/${proposalId}`} className="text-sm text-muted-foreground underline">
            ← Back to proposal review
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">Proposal PDF Preview</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            This is the client-facing PDF for {project.customer?.name ?? "the customer"}. Project-first drafts and estimate-backed proposals both render here.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={proposal.status} />
          <a href={pdfUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
            Open in new tab
          </a>
        </div>
      </div>

      <Card className="border-border/70">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{proposal.estimateId ? "Estimate-backed PDF" : "Project draft PDF"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <SummaryMetricCard label="Customer" value={project.customer?.name ?? "Not linked"} />
            <SummaryMetricCard
              label="Price"
              value={proposal.finalPrice !== null ? formatCurrency(proposal.finalPrice) : proposal.priceHigh !== null ? formatCurrency(proposal.priceHigh) : "In progress"}
            />
            <SummaryMetricCard label="Timeline" value={proposal.timeline ?? "Not set"} />
          </div>
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/20">
            <iframe
              src={pdfUrl}
              title="Proposal PDF Preview"
              className="h-[78vh] w-full bg-white"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
