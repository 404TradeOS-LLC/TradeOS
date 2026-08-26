import Link from "next/link";
import { voidContractAction } from "@/app/actions/contracts";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getContract, getProject } from "@/lib/api";
import { buildContractTimeline, formatDateTime } from "@/lib/document-workflow";
import { getSessionToken } from "@/lib/session";
import { SignContractForm } from "./sign-form";

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string; contractId: string }> }) {
  const { id: projectId, contractId } = await params;
  const token = await getSessionToken();
  const [project, contract] = await Promise.all([getProject(token ?? "", projectId), getContract(token ?? "", contractId)]);
  const proposal = project.proposals.find((item) => item.id === contract.proposalId) ?? null;
  const timeline = buildContractTimeline(contract);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Contract"
        backHref={`/projects/${projectId}`}
        backLabel="Back to project"
        action={<StatusBadge status={contract.status} />}
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Contract overview</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Customer</div>
              <div className="mt-2 font-medium">{project.customer?.name ?? "No customer linked"}</div>
              <div className="mt-1 text-sm text-muted-foreground">{project.customer?.email ?? "No customer email saved"}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Project</div>
              <div className="mt-2 font-medium">{project.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">{project.siteAddress ?? "No address saved"}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Scope</div>
              <div className="mt-2 text-sm text-muted-foreground">{proposal?.scopeOfWork ?? "Scope follows the accepted proposal draft."}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Completion status</div>
              <div className="mt-2 font-medium">{contract.status === "signed" ? "Signed and ready for invoicing" : "Awaiting customer signature"}</div>
              <div className="mt-1 text-sm text-muted-foreground">Attachments reuse the same proposal PDF and project files already stored on the job.</div>
            </div>
          </CardContent>
        </Card>

        <ActivityTimeline title="Contract audit trail" items={timeline} />
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Terms</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">{contract.termsText}</p>
        </CardContent>
      </Card>

      {contract.status === "signed" && (
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Signature audit</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 text-sm">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="font-medium">Typed signature</div>
              <p className="mt-2">{contract.signerName}</p>
              {contract.signerEmail && <p className="text-muted-foreground">{contract.signerEmail}</p>}
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="font-medium">Audit trail</div>
              <p className="mt-2 text-muted-foreground">Timestamp: {formatDateTime(contract.signedAt)}</p>
              <p className="text-muted-foreground">Signer network record: {contract.signatureIp ?? "Not captured for this signature"}</p>
            </div>
            {contract.signatureDataUrl && (
              <div className="rounded-xl border border-border/60 bg-white p-4 md:col-span-2">
                <div className="mb-3 text-sm font-medium text-foreground">Drawn signature capture</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={contract.signatureDataUrl} alt="Captured customer signature" className="max-h-32 w-auto" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/70">
        <CardContent className="flex flex-col gap-4 pt-6">
          <a
            href={`/api/documents/contracts/${contract.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            Download PDF
          </a>

          <Link href={`/portal/contracts/${contract.id}`} className={buttonVariants({ variant: "outline" })}>
            Open customer portal view
          </Link>

          {contract.status !== "signed" && contract.status !== "voided" && (
            <>
              <SignContractForm contractId={contract.id} projectId={projectId} />
              <form action={voidContractAction}>
                <input type="hidden" name="contractId" value={contract.id} />
                <input type="hidden" name="projectId" value={projectId} />
                <Button type="submit" variant="destructive">
                  Void contract
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
