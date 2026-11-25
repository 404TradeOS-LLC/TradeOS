"use client";

import { useEffect } from "react";
import { clearProposalIdempotencyKey, getIdempotencyKeyStorage } from "@/lib/proposal-status-check";

// DES-10 status check: clears the resolved idempotency key for a create
// attempt once the attempt is confirmed created (?created=1) or replayed
// (?replayed=1) — a later new attempt for the same project + estimate
// then mints fresh instead of replaying this one. Rendered only on those
// two redirect landings; ordinary visits to the detail page never clear
// the key, so an unconfirmed attempt keeps its key for a retry.
export function ClearProposalAttemptKey({
  projectId,
  estimateId,
}: {
  projectId: string;
  estimateId: string | null;
}) {
  useEffect(() => {
    clearProposalIdempotencyKey(projectId, estimateId, getIdempotencyKeyStorage());
  }, [projectId, estimateId]);
  return null;
}
