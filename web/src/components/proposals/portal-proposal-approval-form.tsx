"use client";

import { useActionState, useState } from "react";
import { acceptPortalProposalAction, declinePortalProposalAction } from "@/app/actions/proposals";
import { SignaturePad } from "@/components/contracts/signature-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * DES-10-F7: governed public-portal approval + signature. The customer
 * answers from a redeemed magic-link session — no staff login. Acceptance
 * requires all three: the review confirmation (Figma 361:119: "I have
 * reviewed the scope, allowances and terms."), the printed full name, and
 * a drawn signature. A typed name alone is not attributable, so the
 * submit stays disabled until the pad holds ink, and the server re-checks
 * every requirement. Declining is the same governed path minus the
 * signature, with an optional reason recorded in the audit event.
 */
export function PortalProposalApprovalForm({ proposalId, projectId }: { proposalId: string; projectId: string }) {
  const [acceptState, acceptAction, acceptPending] = useActionState(acceptPortalProposalAction, undefined);
  const [declineState, declineAction, declinePending] = useActionState(declinePortalProposalAction, undefined);
  const [reviewed, setReviewed] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [hasSignature, setHasSignature] = useState(false);
  const isPending = acceptPending || declinePending;
  const canAccept = reviewed && signerName.trim().length > 0 && hasSignature && !isPending;

  return (
    <div className="flex flex-col gap-6">
      <form action={acceptAction} className="flex flex-col gap-4">
        <input type="hidden" name="proposalId" value={proposalId} />
        <input type="hidden" name="projectId" value={projectId} />
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="reviewed"
            value="true"
            checked={reviewed}
            onChange={(event) => setReviewed(event.target.checked)}
            className="mt-1"
          />
          <span>I have reviewed the scope, allowances, and terms.</span>
        </label>
        <div className="flex flex-col gap-2">
          <Label htmlFor="portal-signer-name">Full name</Label>
          <Input
            id="portal-signer-name"
            name="signerName"
            value={signerName}
            onChange={(event) => setSignerName(event.target.value)}
            required
            autoComplete="name"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Drawn signature</Label>
          <SignaturePad inputName="signatureDataUrl" onSignatureChange={setHasSignature} />
          <p className="text-xs text-muted-foreground">
            Your signature is recorded with this proposal, together with the name above and the portal link it was signed from.
          </p>
        </div>
        {acceptState?.error && <p className="text-sm text-destructive">{acceptState.error}</p>}
        <Button type="submit" disabled={!canAccept}>
          {acceptPending ? "Recording acceptance…" : "Accept proposal"}
        </Button>
      </form>

      <form action={declineAction} className="flex flex-col gap-4 border-t border-border/60 pt-6">
        <input type="hidden" name="proposalId" value={proposalId} />
        <input type="hidden" name="projectId" value={projectId} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="portal-decline-reason">Decline reason (optional)</Label>
          <Textarea id="portal-decline-reason" name="reason" maxLength={500} rows={3} />
        </div>
        {declineState?.error && <p className="text-sm text-destructive">{declineState.error}</p>}
        <Button type="submit" variant="outline" disabled={isPending}>
          {declinePending ? "Recording decline…" : "Decline proposal"}
        </Button>
      </form>
    </div>
  );
}
