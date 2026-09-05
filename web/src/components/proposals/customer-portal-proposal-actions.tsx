"use client";

import { useActionState } from "react";
import { acceptProposalAction, markProposalViewedAction, rejectProposalAction } from "@/app/actions/proposals";
import { Button } from "@/components/ui/button";
import type { Proposal } from "@/lib/api";

interface CustomerPortalProposalActionsProps {
  projectId: string;
  proposal: Pick<Proposal, "id" | "status">;
}

export function CustomerPortalProposalActions({ projectId, proposal }: CustomerPortalProposalActionsProps) {
  const [viewState, viewAction, viewPending] = useActionState(markProposalViewedAction, undefined);
  const [acceptState, acceptAction, acceptPending] = useActionState(acceptProposalAction, undefined);
  const [rejectState, rejectAction, rejectPending] = useActionState(rejectProposalAction, undefined);
  const isPending = viewPending || acceptPending || rejectPending;

  return (
    <div className="flex flex-col gap-3">
      {proposal.status === "sent" && (
        <form action={viewAction}>
          <PortalProposalFields projectId={projectId} proposalId={proposal.id} />
          <Button type="submit" variant="outline" className="w-full" disabled={isPending}>
            {viewPending ? "Saving…" : "Mark proposal viewed"}
          </Button>
          {viewState?.error && <p className="mt-2 text-sm text-destructive">{viewState.error}</p>}
        </form>
      )}

      {(proposal.status === "sent" || proposal.status === "viewed") && (
        <>
          <form action={acceptAction}>
            <PortalProposalFields projectId={projectId} proposalId={proposal.id} />
            <Button type="submit" className="w-full" disabled={isPending}>
              {acceptPending ? "Saving…" : "Accept proposal"}
            </Button>
            {acceptState?.error && <p className="mt-2 text-sm text-destructive">{acceptState.error}</p>}
          </form>

          <form action={rejectAction}>
            <PortalProposalFields projectId={projectId} proposalId={proposal.id} />
            <Button type="submit" variant="outline" className="w-full" disabled={isPending}>
              {rejectPending ? "Saving…" : "Decline proposal"}
            </Button>
            {rejectState?.error && <p className="mt-2 text-sm text-destructive">{rejectState.error}</p>}
          </form>
        </>
      )}

      {proposal.status === "accepted" && <p className="text-sm text-muted-foreground">This proposal has been accepted.</p>}
      {proposal.status === "declined" && <p className="text-sm text-muted-foreground">This proposal has been declined.</p>}
    </div>
  );
}

function PortalProposalFields({ projectId, proposalId }: { projectId: string; proposalId: string }) {
  return (
    <>
      <input type="hidden" name="proposalId" value={proposalId} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="portal" value="true" />
    </>
  );
}
