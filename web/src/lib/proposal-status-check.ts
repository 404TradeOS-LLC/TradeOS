// DES-10 status check (gap #6): pure helpers for the proposal
// recovery-guidance flow. No imports — this module executes directly in
// node:test. The server idempotency chain already returns everything the
// web needs (200 vs 201 + `Idempotency-Replayed`); the web side is what
// could not tell the outcomes apart, and the form minted a fresh key per
// render, so a retry after reload could create a duplicate draft.

export const PROPOSAL_STATUS_CHECK_COPY = {
  heading: "Check proposal status",
  description:
    "Use the loaded Project proposals list to check before creating again. This guide does not fetch or infer a result.",
  destination:
    "Existing Project route: /projects/{projectId}?tab=proposals. Compare loaded proposal rows against this Project and Estimate.",
  matchingDraftFound: {
    heading: "If a matching draft is present",
    body: "Open the existing matching draft from the Project proposals list. Continue review there; do not create again.",
  },
  noMatch: {
    heading: "If no match after the list is fully loaded",
    body: "Return to Estimate Review only after confirming no proposal for this Project and Estimate is present. This state does not auto-retry.",
  },
} as const;

export const PROPOSAL_REPLAY_NOTICE =
  "This draft was already created by your earlier attempt — no duplicate was made.";

export const PROPOSAL_STATUS_CHECK_LIST_ERROR =
  "The proposals list could not be loaded. Do not create again until the list loads.";

export const PROPOSAL_STATUS_CHECK_NO_MATCH_EVENT_TYPE = "proposal.status_check_no_match";

export const PROPOSAL_STATUS_CHECK_NO_MATCH_TITLE = "Proposal status check: no matching draft";

export function buildNoMatchConfirmationDescription(at: Date): string {
  return `Contractor confirmed no proposal for this Project and Estimate was present in the loaded list; created again at ${at.toISOString()}.`;
}

const IDEMPOTENCY_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidIdempotencyKey(value: string): boolean {
  return IDEMPOTENCY_KEY_PATTERN.test(value);
}

export type ProposalCreateOutcome = "unknown" | "known-rejection" | "key-reuse";

/**
 * Tell a failed create apart. Only a definitive 4xx rejection means the
 * server said no — a 409 is the key-reuse conflict (a draft *does* exist
 * for this key), and anything else (5xx, network drop, timeout, abort)
 * leaves the outcome unknown, so the contractor must check the list.
 */
export function classifyProposalCreateError(error: unknown): {
  outcome: ProposalCreateOutcome;
  message: string;
} {
  const status =
    typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
      ? error.status
      : null;
  // A response carries a real server message; a transport failure has
  // none, so it keeps the existing generic copy.
  const message =
    status !== null &&
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message
      ? error.message
      : "Something went wrong.";
  if (status === 409) return { outcome: "key-reuse", message };
  if (status !== null && status >= 400 && status < 500) return { outcome: "known-rejection", message };
  return { outcome: "unknown", message };
}

export function findMatchingProposal<T extends { id: string; estimateId: string | null }>(
  proposals: T[],
  estimateId: string | null,
): T | null {
  return proposals.find((proposal) => proposal.estimateId === estimateId) ?? null;
}

export function buildProposalIdempotencyStorageKey(projectId: string, estimateId: string | null): string {
  return `tradeos:proposal-idempotency:${projectId}:${estimateId ?? "intake"}`;
}

export interface IdempotencyKeyStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** sessionStorage when it exists and is reachable; null on the server or when storage is blocked. */
export function getIdempotencyKeyStorage(): IdempotencyKeyStorage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/**
 * One key per create attempt, persisted for that attempt (sessionStorage,
 * keyed by project + estimate). A retry — from the form's "Try again"
 * action or after a page reload — submits the same key, so the server
 * replays instead of duplicating. A fresh key is minted only when none is
 * stored (or the stored value is not a UUID); the resolved key is cleared
 * once the attempt is confirmed created or replayed (see
 * ClearProposalAttemptKey on the proposal detail page). With no storage
 * available (server render), the caller-supplied seed is returned.
 */
export function resolveProposalIdempotencyKey(
  projectId: string,
  estimateId: string | null,
  seed: string,
  storage: IdempotencyKeyStorage | null,
): string {
  if (!storage) return seed;
  const storageKey = buildProposalIdempotencyStorageKey(projectId, estimateId);
  const stored = storage.getItem(storageKey);
  if (stored && isValidIdempotencyKey(stored)) return stored;
  const minted = crypto.randomUUID();
  storage.setItem(storageKey, minted);
  return minted;
}

export function clearProposalIdempotencyKey(
  projectId: string,
  estimateId: string | null,
  storage: IdempotencyKeyStorage | null,
): void {
  storage?.removeItem(buildProposalIdempotencyStorageKey(projectId, estimateId));
}

/** Read the stored key for an attempt without minting one. */
export function readProposalIdempotencyKey(
  projectId: string,
  estimateId: string | null,
  storage: IdempotencyKeyStorage | null,
): string | null {
  if (!storage) return null;
  const stored = storage.getItem(buildProposalIdempotencyStorageKey(projectId, estimateId));
  return stored && isValidIdempotencyKey(stored) ? stored : null;
}

export function buildStatusCheckUrl(projectId: string, estimateId?: string | null): string {
  const base = `/projects/${projectId}?tab=proposals&statusCheck=1`;
  return estimateId ? `${base}&estimateId=${encodeURIComponent(estimateId)}` : base;
}

export function buildEstimateReviewUrl(projectId: string, estimateId?: string | null): string {
  return estimateId ? `/projects/${projectId}/estimates/${estimateId}` : `/projects/${projectId}/proposals/new`;
}
