import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Proposal } from "@/lib/api";
import { formatDateTime } from "@/lib/document-workflow";

// DES-10-F7: the recorded portal signature was stored on the proposal row
// and carried by the Proposal DTO, but the staff proposal page never
// rendered it — there was no acceptance section at all. This card shows the
// recorded signature image with the signer name and date. It renders
// nothing when the proposal carries no acceptance evidence (for example an
// accepted proposal recorded without a signature), so the lifecycle panel
// stays the only acceptance signal in that case.
export function ProposalAcceptanceCard({ proposal }: { proposal: Proposal }) {
  const hasAcceptanceEvidence =
    proposal.status === "accepted" &&
    (proposal.signatureDataUrl != null || proposal.signerName != null || proposal.signedAt != null);
  if (!hasAcceptanceEvidence) return null;

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Acceptance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {proposal.signatureDataUrl ? (
          <div className="rounded-lg bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={proposal.signatureDataUrl} alt={`Signature of ${proposal.signerName ?? "the customer"}`} className="h-16 w-auto max-w-full" />
          </div>
        ) : null}
        {proposal.signerName ? (
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Accepted by</div>
            <div className="mt-1 font-medium">{proposal.signerName}</div>
          </div>
        ) : null}
        {proposal.signedAt ? (
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Signed</div>
            <div className="mt-1">{formatDateTime(proposal.signedAt)}</div>
          </div>
        ) : null}
        {proposal.signerEmail ? (
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Signer email</div>
            <div className="mt-1 text-muted-foreground">{proposal.signerEmail}</div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
