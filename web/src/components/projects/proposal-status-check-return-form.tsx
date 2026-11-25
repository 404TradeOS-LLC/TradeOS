"use client";

import { useActionState, useEffect, useRef } from "react";
import { confirmProposalStatusCheckAction } from "@/app/actions/proposals";
import { Button } from "@/components/ui/button";
import { getIdempotencyKeyStorage, readProposalIdempotencyKey } from "@/lib/proposal-status-check";

// DES-10 status check: the explicit, persisted no-match confirmation.
// Shown only after the proposals list fully loads with no matching draft.
// The click records the decision as an activity entry (never a silent
// default) and returns to Estimate Review — or to the proposal form for
// intake-only attempts, which have no estimate to return to. Creating
// again from there is permitted only after this confirmation.
export function ProposalStatusCheckReturnForm({
  projectId,
  estimateId,
}: {
  projectId: string;
  estimateId: string | null;
}) {
  const [state, formAction, isPending] = useActionState(confirmProposalStatusCheckAction, undefined);
  // The attempt key lives in sessionStorage (the form that minted it);
  // read it without minting so the recorded entry carries the real key
  // or none at all — never a fresh one invented at return time. The
  // input is uncontrolled: the effect writes the read key to the DOM
  // node directly (no setState in an effect).
  const keyInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (keyInputRef.current) {
      keyInputRef.current.value =
        readProposalIdempotencyKey(projectId, estimateId, getIdempotencyKeyStorage()) ?? "";
    }
  }, [projectId, estimateId]);
  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="estimateId" value={estimateId ?? ""} />
      <input ref={keyInputRef} type="hidden" name="idempotencyKey" defaultValue="" />
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={isPending} className="min-h-11">
        {isPending ? "Recording…" : estimateId ? "Return to Estimate Review" : "Return to the proposal form"}
      </Button>
    </form>
  );
}
