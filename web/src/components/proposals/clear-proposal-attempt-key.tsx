"use client";

import { useEffect } from "react";
import { clearProposalIdempotencyKey, getIdempotencyKeyStorage } from "@/lib/proposal-status-check";

// DES-10 status check: clears the resolved idempotency key for a create
// attempt once the attempt is confirmed created (?created=1), replayed
// (?replayed=1), or recovered through the matching draft (?recovered=1)
// — a later new attempt for the same project + estimate then mints fresh
// instead of replaying this one. Rendered only on those three redirect
// landings; ordinary visits to the detail page never clear the key, so an
// unconfirmed attempt keeps its key for a retry. The landing carries the
// resolved attempt's key, and storage is removed only when its current
// value still matches that key — revisiting an older landing URL (browser
// history) after a newer attempt started must not delete the newer
// attempt's key. With no key carried, nothing is cleared.
export function ClearProposalAttemptKey({
  projectId,
  estimateId,
  resolvedKey,
}: {
  projectId: string;
  estimateId: string | null;
  resolvedKey?: string | null;
}) {
  useEffect(() => {
    clearProposalIdempotencyKey(projectId, estimateId, getIdempotencyKeyStorage(), resolvedKey ?? null);
  }, [projectId, estimateId, resolvedKey]);
  return null;
}
