import Link from "next/link";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getContract, getProject } from "@/lib/api";
import { buildContractTimeline, formatDateTime } from "@/lib/document-workflow";
import { getSessionToken } from "@/lib/session";
import { SignContractForm } from "@/app/(app)/projects/[id]/contracts/[contractId]/sign-form";

export default async function CustomerPortalContractPage({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = await params;
  const token = await getSessionToken();
  const contract = await getContract(token ?? "", contractId);
  const project = await getProject(token ?? "", contract.projectId);
  const proposal = project.proposals.find((item) => item.id === contract.proposalId) ?? null;
  const timeline = buildContractTimeline(contract);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link href={`/portal/projects/${project.id}`} className="text-sm text-muted-foreground underline">
            ← Back to project portal
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">Contract review</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">Review the agreement terms, confirm the project scope, and sign when you are ready.</p>
        </div>
        <StatusBadge status={contract.status} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Agreement summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Project</div>
              <div className="mt-2 font-medium">{project.name}</div>
              <div className="mt-1 text-muted-foreground">{project.siteAddress ?? "Address to be confirmed"}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Scope</div>
              <div className="mt-2 whitespace-pre-wrap text-muted-foreground">{proposal?.scopeOfWork ?? "Scope follows the accepted proposal."}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Terms</div>
              <div className="mt-2 whitespace-pre-wrap text-muted-foreground">{contract.termsText}</div>
            </div>
          </CardContent>
        </Card>

        <ActivityTimeline title="Contract timeline" items={timeline} />
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <a href={`/api/documents/contracts/${contract.id}/pdf`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
            Download signed contract PDF
          </a>
          {contract.status !== "signed" && contract.status !== "voided" ? (
            <SignContractForm contractId={contract.id} projectId={project.id} portal />
          ) : (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              Signed on {formatDateTime(contract.signedAt)}. Audit capture includes the typed name, drawn signature, and the saved network record when available.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
