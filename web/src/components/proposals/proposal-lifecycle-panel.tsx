"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createContractAction } from "@/app/actions/contracts";
import { acceptOfflineProposalAction, acceptProposalAction, duplicateProposalAction, rejectProposalAction, resendProposalAction, sendProposalAction } from "@/app/actions/proposals";
import { StatusBadge } from "@/components/shared/status-badge";
import { Timeline } from "@/components/shared/timeline";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Proposal } from "@/lib/api";
import { buildProposalTimeline, formatDateTime, getProposalDisplayStatus } from "@/lib/document-workflow";

interface ProposalLifecyclePanelProps {
  projectId: string;
  proposal: Proposal;
}

export function ProposalLifecyclePanel({ projectId, proposal }: ProposalLifecyclePanelProps) {
  const [sendState, sendFormAction, sendPending] = useActionState(sendProposalAction, undefined);
  const [resendState, resendFormAction, resendPending] = useActionState(resendProposalAction, undefined);
  const [acceptState, acceptFormAction, acceptPending] = useActionState(acceptProposalAction, undefined);
  const [offlineState, offlineFormAction, offlinePending] = useActionState(acceptOfflineProposalAction, undefined);
  const [rejectState, rejectFormAction, rejectPending] = useActionState(rejectProposalAction, undefined);
  const [contractState, contractFormAction, contractPending] = useActionState(createContractAction, undefined);
  const [duplicateState, duplicateFormAction, duplicatePending] = useActionState(duplicateProposalAction, undefined);

  const isPending = sendPending || resendPending || acceptPending || offlinePending || rejectPending || contractPending || duplicatePending;
  const displayStatus = getProposalDisplayStatus(proposal);
  const timeline = buildProposalTimeline(proposal);

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Workflow actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Current stage</div>
              <p className="mt-1 text-sm text-muted-foreground">{getStatusDescription(displayStatus)}</p>
            </div>
            <StatusBadge status={displayStatus} />
          </div>
        </div>

        <Timeline
          items={timeline.map((item) => ({ label: item.title, value: formatDateTime(item.at), active: item.active }))}
        />

        {proposal.status === "draft" && (
          <form action={sendFormAction} className="space-y-3">
            <HiddenFields projectId={projectId} proposalId={proposal.id} />
            <Button type="submit" className="w-full" disabled={isPending}>
              {sendPending ? "Sending…" : "Send to customer"}
            </Button>
            {sendState?.error && <p className="text-sm text-destructive">{sendState.error}</p>}
          </form>
        )}

        {proposal.status === "draft" && (
          <form action={offlineFormAction} className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
            <HiddenFields projectId={projectId} proposalId={proposal.id} />
            <div>
              <p className="font-medium">Customer accepted outside TradeOS</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Use only after the customer has actually approved the final written scope and price.
                This records an internal approval; it does not email the proposal or create a customer signature.
              </p>
            </div>
            <label className="grid gap-1 text-sm font-medium">
              How did the customer approve?
              <select name="channel" defaultValue="" required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="" disabled>Choose an approval method</option>
                <option value="in_person">In person</option>
                <option value="phone">Phone</option>
                <option value="signed_document">Signed copy received outside TradeOS</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Approval note
              <textarea
                name="note"
                minLength={10}
                maxLength={500}
                required
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Who approved the written scope and price, and when?"
              />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="confirmed" value="true" required className="mt-1" />
              <span>I confirm the customer approved the scope and final price outside TradeOS.</span>
            </label>
            <Button type="submit" variant="secondary" className="w-full" disabled={isPending}>
              {offlinePending ? "Recording acceptance…" : "Record offline acceptance"}
            </Button>
            {offlineState?.error && <p role="alert" className="text-sm text-destructive">{offlineState.error}</p>}
          </form>
        )}

        {(proposal.status === "sent" || proposal.status === "viewed") && (
          <div className="space-y-3">
            <form action={resendFormAction} className="space-y-3">
              <HiddenFields projectId={projectId} proposalId={proposal.id} />
              <Button type="submit" variant="outline" className="w-full" disabled={isPending}>
                {resendPending ? "Resending…" : "Resend proposal"}
              </Button>
              {resendState?.error && <p className="text-sm text-destructive">{resendState.error}</p>}
            </form>
            <form action={acceptFormAction} className="space-y-3">
              <HiddenFields projectId={projectId} proposalId={proposal.id} />
              <Button type="submit" className="w-full" disabled={isPending}>
                {acceptPending ? "Saving…" : "Mark accepted"}
              </Button>
              {acceptState?.error && <p className="text-sm text-destructive">{acceptState.error}</p>}
            </form>
            <form action={rejectFormAction} className="space-y-3">
              <HiddenFields projectId={projectId} proposalId={proposal.id} />
              <Button type="submit" variant="outline" className="w-full" disabled={isPending}>
                {rejectPending ? "Saving…" : "Mark declined"}
              </Button>
              {rejectState?.error && <p className="text-sm text-destructive">{rejectState.error}</p>}
            </form>
          </div>
        )}

        {proposal.status === "accepted" && (
          <form action={contractFormAction} className="space-y-3">
            <HiddenFields projectId={projectId} proposalId={proposal.id} />
            <Button type="submit" className="w-full" disabled={isPending}>
              {contractPending ? "Creating…" : "Create contract"}
            </Button>
            <p className="text-sm text-muted-foreground">Carry the approved scope and terms directly into a signable contract.</p>
            {contractState?.error && <p className="text-sm text-destructive">{contractState.error}</p>}
          </form>
        )}

        {proposal.status === "accepted" && (
          <div className="space-y-2">
            <Link
              href={`/projects/${projectId}/jobs/new?proposalId=${proposal.id}`}
              className={buttonVariants({ variant: "secondary", className: "w-full" })}
            >
              Create field job from accepted proposal
            </Link>
            <p className="text-sm text-muted-foreground">
              Confirm the service address and carry the approved scope and price into an unscheduled job.
              Scheduling and crew assignment remain separate actions.
            </p>
          </div>
        )}

        {proposal.status === "declined" && (
          <form action={duplicateFormAction} className="space-y-3">
            <HiddenFields projectId={projectId} proposalId={proposal.id} />
            <Button type="submit" variant="outline" className="w-full" disabled={isPending}>
              {duplicatePending ? "Duplicating…" : "Duplicate proposal into new draft"}
            </Button>
            <p className="text-sm text-muted-foreground">Revise scope or pricing on a clean copy and resend when you are ready to re-engage.</p>
            {duplicateState?.error && <p className="text-sm text-destructive">{duplicateState.error}</p>}
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function HiddenFields({ projectId, proposalId }: { projectId: string; proposalId: string }) {
  return (
    <>
      <input type="hidden" name="proposalId" value={proposalId} />
      <input type="hidden" name="projectId" value={projectId} />
    </>
  );
}

function getStatusDescription(status: string) {
  switch (status) {
    case "draft":
      return "Finish the proposal and send the PDF, or record a verified in-person/phone acceptance without sending it.";
    case "sent":
      return "The proposal has been issued. Update the record as soon as the customer responds.";
    case "viewed":
      return "The customer has reviewed the proposal. This is a good moment to follow up and close open questions.";
    case "accepted":
      return "The customer approved the proposal. Next, generate the contract so production handoff stays attached to the same project.";
    case "declined":
      return "The current draft did not move forward. Use the project context to revise and resend a stronger version.";
    case "expired":
      return "The sent proposal aged beyond the validity window. Resend it or duplicate a fresh draft before re-engaging the customer.";
    default:
      return "Review the current proposal state and keep the workflow moving.";
  }
}
