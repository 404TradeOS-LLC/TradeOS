import test from "node:test";
import assert from "node:assert/strict";
import {
  PROPOSAL_STATUS_CHECK_COPY,
  PROPOSAL_REPLAY_NOTICE,
  PROPOSAL_STATUS_CHECK_LIST_ERROR,
  PROPOSAL_STATUS_CHECK_NO_MATCH_EVENT_TYPE,
  buildEstimateReviewUrl,
  buildNoMatchConfirmationDescription,
  buildProposalIdempotencyStorageKey,
  buildRecoveredProposalUrl,
  buildStatusCheckUrl,
  classifyProposalCreateError,
  clearProposalIdempotencyKey,
  findMatchingProposal,
  getIdempotencyKeyStorage,
  isValidIdempotencyKey,
  readProposalIdempotencyKey,
  resolveProposalIdempotencyKey,
} from "./proposal-status-check.ts";

// DES-10 status check (gap #6): the web side could not tell a created
// proposal from a replay, a known rejection, or an unknown outcome, and
// the form minted a fresh idempotency key per render, so a retry after
// reload could create a duplicate draft. These helpers are the pure,
// directly-executed core of the fix: outcome classification, the
// project+estimate match rule, and the per-attempt key lifecycle.

const UUID = "11111111-2222-3333-8444-555555555555";
const OTHER_UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function memoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

test("status-check copy is verbatim from the Figma guidance card", () => {
  assert.equal(PROPOSAL_STATUS_CHECK_COPY.heading, "Check proposal status");
  assert.equal(
    PROPOSAL_STATUS_CHECK_COPY.description,
    "Use the loaded Project proposals list to check before creating again. This guide does not fetch or infer a result.",
  );
  assert.equal(
    PROPOSAL_STATUS_CHECK_COPY.destination,
    "Existing Project route: /projects/{projectId}?tab=proposals. Compare loaded proposal rows against this Project and Estimate.",
  );
  assert.equal(PROPOSAL_STATUS_CHECK_COPY.matchingDraftFound.heading, "If a matching draft is present");
  assert.equal(
    PROPOSAL_STATUS_CHECK_COPY.matchingDraftFound.body,
    "Open the existing matching draft from the Project proposals list. Continue review there; do not create again.",
  );
  assert.equal(PROPOSAL_STATUS_CHECK_COPY.noMatch.heading, "If no match after the list is fully loaded");
  assert.equal(
    PROPOSAL_STATUS_CHECK_COPY.noMatch.body,
    "Return to Estimate Review only after confirming no proposal for this Project and Estimate is present. This state does not auto-retry.",
  );
});

test("replay notice and list-load error copy are fixed", () => {
  assert.equal(
    PROPOSAL_REPLAY_NOTICE,
    "This draft was already created by your earlier attempt — no duplicate was made.",
  );
  assert.equal(
    PROPOSAL_STATUS_CHECK_LIST_ERROR,
    "The proposals list could not be loaded. Do not create again until the list loads.",
  );
});

test("classifyProposalCreateError: 409 is key reuse with the server message verbatim", () => {
  const serverMessage = "This proposal request key was already used with different details. Check the project proposal list before starting a new draft.";
  const result = classifyProposalCreateError({ status: 409, message: serverMessage });
  assert.equal(result.outcome, "key-reuse");
  assert.equal(result.message, serverMessage);
});

test("classifyProposalCreateError: 4xx rejections are known rejections", () => {
  assert.deepEqual(classifyProposalCreateError({ status: 400, message: "Estimate not found." }), {
    outcome: "known-rejection",
    message: "Estimate not found.",
  });
  assert.deepEqual(classifyProposalCreateError({ status: 404, message: "Project not found." }), {
    outcome: "known-rejection",
    message: "Project not found.",
  });
});

test("classifyProposalCreateError: 5xx and transport failures are unknown outcomes", () => {
  assert.deepEqual(classifyProposalCreateError({ status: 500, message: "Database unavailable." }), {
    outcome: "unknown",
    message: "Database unavailable.",
  });
  assert.deepEqual(classifyProposalCreateError({ status: 503, message: "Service unavailable." }), {
    outcome: "unknown",
    message: "Service unavailable.",
  });
  assert.deepEqual(classifyProposalCreateError(new TypeError("fetch failed")), {
    outcome: "unknown",
    message: "Something went wrong.",
  });
  assert.deepEqual(classifyProposalCreateError(null), {
    outcome: "unknown",
    message: "Something went wrong.",
  });
});

test("findMatchingProposal matches only on project + estimate", () => {
  const proposals = [
    { id: "proposal-other-estimate", estimateId: "estimate-2" },
    { id: "proposal-match", estimateId: "estimate-1" },
    { id: "proposal-intake", estimateId: null },
  ];
  assert.equal(findMatchingProposal(proposals, "estimate-1")?.id, "proposal-match");
  assert.equal(findMatchingProposal(proposals, "estimate-3"), null);
  // An intake-only attempt matches only an intake draft, never an estimate-backed row.
  assert.equal(findMatchingProposal(proposals, null)?.id, "proposal-intake");
  assert.equal(findMatchingProposal([], "estimate-1"), null);
});

test("idempotency storage key is scoped by project + estimate", () => {
  assert.equal(
    buildProposalIdempotencyStorageKey("project-1", "estimate-1"),
    "tradeos:proposal-idempotency:project-1:estimate-1",
  );
  assert.equal(
    buildProposalIdempotencyStorageKey("project-1", null),
    "tradeos:proposal-idempotency:project-1:intake",
  );
  assert.notEqual(
    buildProposalIdempotencyStorageKey("project-1", "estimate-1"),
    buildProposalIdempotencyStorageKey("project-1", "estimate-2"),
  );
});

test("resolveProposalIdempotencyKey reuses a stored valid key for the attempt", () => {
  const storage = memoryStorage({
    [buildProposalIdempotencyStorageKey("project-1", "estimate-1")]: UUID,
  });
  assert.equal(resolveProposalIdempotencyKey("project-1", "estimate-1", OTHER_UUID, storage), UUID);
  assert.equal(storage.store.size, 1);
});

test("resolveProposalIdempotencyKey mints and persists a fresh key when none is stored", () => {
  const storage = memoryStorage();
  const resolved = resolveProposalIdempotencyKey("project-1", "estimate-1", OTHER_UUID, storage);
  assert.ok(isValidIdempotencyKey(resolved));
  assert.notEqual(resolved, OTHER_UUID);
  assert.equal(storage.getItem(buildProposalIdempotencyStorageKey("project-1", "estimate-1")), resolved);
});

test("resolveProposalIdempotencyKey replaces a stored invalid key", () => {
  const storage = memoryStorage({
    [buildProposalIdempotencyStorageKey("project-1", "estimate-1")]: "not-a-uuid",
  });
  const resolved = resolveProposalIdempotencyKey("project-1", "estimate-1", OTHER_UUID, storage);
  assert.ok(isValidIdempotencyKey(resolved));
  assert.equal(storage.getItem(buildProposalIdempotencyStorageKey("project-1", "estimate-1")), resolved);
});

test("resolveProposalIdempotencyKey returns the seed when no storage is available", () => {
  assert.equal(resolveProposalIdempotencyKey("project-1", "estimate-1", OTHER_UUID, null), OTHER_UUID);
});

test("resolveProposalIdempotencyKey returns the seed when storage throws (Codex P2: QuotaExceededError)", () => {
  const throwingGet = {
    getItem: () => {
      throw new Error("QuotaExceededError");
    },
    setItem: () => {},
    removeItem: () => {},
  };
  assert.equal(resolveProposalIdempotencyKey("project-1", "estimate-1", OTHER_UUID, throwingGet), OTHER_UUID);
  const throwingSet = memoryStorage();
  throwingSet.setItem = () => {
    throw new Error("QuotaExceededError");
  };
  assert.equal(resolveProposalIdempotencyKey("project-1", "estimate-1", OTHER_UUID, throwingSet), OTHER_UUID);
  // A failed mint is not persisted, so a later healthy call mints fresh.
  assert.ok(isValidIdempotencyKey(resolveProposalIdempotencyKey("project-1", "estimate-1", OTHER_UUID, memoryStorage())));
});

test("clearProposalIdempotencyKey removes only when the stored key still matches the resolved one", () => {
  const storage = memoryStorage({
    [buildProposalIdempotencyStorageKey("project-1", "estimate-1")]: UUID,
  });
  // Revisiting an older landing after a newer attempt started: the stored
  // value is the newer key, so the older key must not clear it.
  clearProposalIdempotencyKey("project-1", "estimate-1", storage, OTHER_UUID);
  assert.equal(storage.getItem(buildProposalIdempotencyStorageKey("project-1", "estimate-1")), UUID);
  clearProposalIdempotencyKey("project-1", "estimate-1", storage, UUID);
  assert.equal(storage.getItem(buildProposalIdempotencyStorageKey("project-1", "estimate-1")), null);
  // A landing that carries no key cannot prove which attempt it resolves,
  // so it clears nothing.
  const storage2 = memoryStorage({
    [buildProposalIdempotencyStorageKey("project-1", "estimate-1")]: UUID,
  });
  clearProposalIdempotencyKey("project-1", "estimate-1", storage2, null);
  assert.equal(storage2.getItem(buildProposalIdempotencyStorageKey("project-1", "estimate-1")), UUID);
  // A throwing store never throws out of the clear.
  const throwing = memoryStorage({
    [buildProposalIdempotencyStorageKey("project-1", "estimate-1")]: UUID,
  });
  throwing.removeItem = () => {
    throw new Error("QuotaExceededError");
  };
  clearProposalIdempotencyKey("project-1", "estimate-1", throwing, UUID);
});

test("readProposalIdempotencyKey returns null when storage throws", () => {
  const throwing = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {},
    removeItem: () => {},
  };
  assert.equal(readProposalIdempotencyKey("project-1", "estimate-1", throwing), null);
});

test("clearProposalIdempotencyKey removes only that attempt's key", () => {
  const storage = memoryStorage({
    [buildProposalIdempotencyStorageKey("project-1", "estimate-1")]: UUID,
    [buildProposalIdempotencyStorageKey("project-1", "estimate-2")]: OTHER_UUID,
  });
  clearProposalIdempotencyKey("project-1", "estimate-1", storage);
  assert.equal(storage.getItem(buildProposalIdempotencyStorageKey("project-1", "estimate-1")), null);
  assert.equal(storage.getItem(buildProposalIdempotencyStorageKey("project-1", "estimate-2")), OTHER_UUID);
  // Clearing a missing key (or with no storage) is a no-op, never a throw.
  clearProposalIdempotencyKey("project-1", "estimate-9", storage);
  clearProposalIdempotencyKey("project-1", "estimate-1", null);
});

test("isValidIdempotencyKey accepts UUIDs and rejects anything else", () => {
  assert.equal(isValidIdempotencyKey(UUID), true);
  assert.equal(isValidIdempotencyKey("not-a-uuid"), false);
  assert.equal(isValidIdempotencyKey(""), false);
});

test("readProposalIdempotencyKey reads without minting", () => {
  const storage = memoryStorage({
    [buildProposalIdempotencyStorageKey("project-1", "estimate-1")]: UUID,
  });
  assert.equal(readProposalIdempotencyKey("project-1", "estimate-1", storage), UUID);
  assert.equal(readProposalIdempotencyKey("project-1", "estimate-2", storage), null);
  assert.equal(readProposalIdempotencyKey("project-1", "estimate-1", null), null);
  assert.equal(storage.store.size, 1);
});

test("getIdempotencyKeyStorage returns null where sessionStorage is unavailable", () => {
  assert.equal(getIdempotencyKeyStorage(), null);
});

test("status-check URL carries the check and the attempt estimate", () => {
  assert.equal(
    buildStatusCheckUrl("project-1", "estimate-1"),
    "/projects/project-1?tab=proposals&statusCheck=1&estimateId=estimate-1",
  );
  assert.equal(buildStatusCheckUrl("project-1", null), "/projects/project-1?tab=proposals&statusCheck=1");
  assert.equal(buildStatusCheckUrl("project-1"), "/projects/project-1?tab=proposals&statusCheck=1");
});

test("status-check URL carries the resolved attempt key when valid, omits it otherwise", () => {
  assert.equal(
    buildStatusCheckUrl("project-1", "estimate-1", UUID),
    `/projects/project-1?tab=proposals&statusCheck=1&estimateId=estimate-1&key=${UUID}`,
  );
  assert.equal(
    buildStatusCheckUrl("project-1", "estimate-1", "not-a-uuid"),
    "/projects/project-1?tab=proposals&statusCheck=1&estimateId=estimate-1",
  );
  assert.equal(buildStatusCheckUrl("project-1", null, null), "/projects/project-1?tab=proposals&statusCheck=1");
});

test("recovered draft URL marks the recovery landing and carries the resolved attempt key", () => {
  assert.equal(
    buildRecoveredProposalUrl("project-1", "proposal-1", UUID),
    `/projects/project-1/proposals/proposal-1?recovered=1&key=${UUID}`,
  );
  assert.equal(
    buildRecoveredProposalUrl("project-1", "proposal-1", null),
    "/projects/project-1/proposals/proposal-1?recovered=1",
  );
  assert.equal(
    buildRecoveredProposalUrl("project-1", "proposal-1", "not-a-uuid"),
    "/projects/project-1/proposals/proposal-1?recovered=1",
  );
});

test("estimate review URL returns to the estimate, or the proposal form for intake-only attempts", () => {
  assert.equal(buildEstimateReviewUrl("project-1", "estimate-1"), "/projects/project-1/estimates/estimate-1");
  assert.equal(buildEstimateReviewUrl("project-1", null), "/projects/project-1/proposals/new");
});

test("no-match confirmation records the explicit decision with its time", () => {
  const at = new Date("2026-11-25T09:00:00.000Z");
  assert.equal(
    buildNoMatchConfirmationDescription(at),
    "Contractor confirmed no proposal for this Project and Estimate was present in the loaded list; created again at 2026-11-25T09:00:00.000Z.",
  );
  assert.equal(PROPOSAL_STATUS_CHECK_NO_MATCH_EVENT_TYPE, "proposal.status_check_no_match");
});
