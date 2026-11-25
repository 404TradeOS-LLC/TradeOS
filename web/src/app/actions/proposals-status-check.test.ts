import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// DES-10 status check (gap #6): no jest/vitest/mock harness exists for
// `web/`'s Server Actions (see actions/invoices.test.ts for the precedent),
// so these tests pin the *shape* of the action and its wiring — the
// outcome contract lives in lib/proposal-status-check.test.ts, where the
// pure helpers execute directly. The tests below fail until the action
// distinguishes created / replayed / unknown / known-rejection /
// key-reuse, the form persists the idempotency key, and the proposals tab
// renders the recovery guidance.

const actionsSource = readFileSync(new URL("./proposals.ts", import.meta.url), "utf8");
const apiSource = readFileSync(new URL("../../lib/api.ts", import.meta.url), "utf8");
const formSource = readFileSync(
  new URL("../../app/(app)/projects/[id]/proposals/new/form.tsx", import.meta.url),
  "utf8",
);
const newPageSource = readFileSync(
  new URL("../../app/(app)/projects/[id]/proposals/new/page.tsx", import.meta.url),
  "utf8",
);
const projectPageSource = readFileSync(
  new URL("../../app/(app)/projects/[id]/page.tsx", import.meta.url),
  "utf8",
);
const workspaceSource = readFileSync(
  new URL("../../components/projects/project-workspace.tsx", import.meta.url),
  "utf8",
);
const detailPageSource = readFileSync(
  new URL("../../app/(app)/projects/[id]/proposals/[proposalId]/page.tsx", import.meta.url),
  "utf8",
);

function createProposalActionSource(): string {
  const start = actionsSource.indexOf("export async function createProposalAction");
  assert.notEqual(start, -1, "expected createProposalAction to exist");
  const next = actionsSource.indexOf("export async function ", start + 1);
  return actionsSource.slice(start, next === -1 ? undefined : next);
}

test("apiFetch exposes status and headers through apiFetchWithResponse", () => {
  assert.match(apiSource, /export async function apiFetchWithResponse<T>/);
  assert.match(apiSource, /status: response\.status/);
  assert.match(apiSource, /headers: response\.headers/);
  // apiFetch keeps its body-only contract by delegating to the wrapper.
  assert.match(apiSource, /apiFetchWithResponse<T>\(path, options\)/);
});

test("createProposalAction reads the replay signal instead of the body alone", () => {
  const fnSource = createProposalActionSource();
  assert.match(fnSource, /apiFetchWithResponse<Proposal>/);
  assert.match(fnSource, /Idempotency-Replayed/);
});

test("createProposalAction redirects a replay to the original draft with the replay notice", () => {
  const fnSource = createProposalActionSource();
  assert.match(fnSource, /replayed/);
  assert.match(fnSource, /\?replayed=1/);
});

test("createProposalAction distinguishes unknown, known-rejection, and key-reuse outcomes", () => {
  const fnSource = createProposalActionSource();
  // Classification is delegated to the pure helper (executed in
  // lib/proposal-status-check.test.ts); the action branches on its
  // outcome and returns the matching state shape.
  assert.match(fnSource, /classifyProposalCreateError\(err\)/);
  assert.match(fnSource, /if \(outcome === "known-rejection"\)/);
  assert.match(fnSource, /return \{ error: message, statusCheck: true, outcome \}/);
  // A known server rejection is an inline error only: no statusCheck flag.
  assert.match(fnSource, /if \(outcome === "known-rejection"\) \{\n\s*return \{ error: message \};/);
});

test("createProposalAction never sets statusCheck for a known rejection", () => {
  const fnSource = createProposalActionSource();
  // Exactly one statusCheck return exists — the unknown/key-reuse one —
  // and it carries the classified outcome, never known-rejection.
  assert.equal([...fnSource.matchAll(/statusCheck: true/g)].length, 1);
  assert.doesNotMatch(fnSource, /statusCheck: true[^}]*known-rejection/);
  assert.match(fnSource, /return \{ error: message \};/);
});

test("confirm action records the explicit no-match decision then returns to Estimate Review", () => {
  assert.match(actionsSource, /export async function confirmProposalStatusCheckAction/);
  assert.match(actionsSource, /\/api\/v1\/intelligence\/activity/);
  // The event type lives in the shared constants (executed in
  // lib/proposal-status-check.test.ts); the action references the
  // constant, never a second copy of the string.
  assert.match(actionsSource, /PROPOSAL_STATUS_CHECK_NO_MATCH_EVENT_TYPE/);
  assert.match(actionsSource, /buildEstimateReviewUrl\(projectId, estimateId \|\| null\)/);
});

test("new-proposal form persists the idempotency key for the attempt", () => {
  assert.match(formSource, /resolveProposalIdempotencyKey/);
  assert.match(formSource, /getIdempotencyKeyStorage/);
  // The hidden key is uncontrolled with the per-render seed as its
  // hydration value; the effect writes the resolved (persisted) key to
  // the DOM node, so the submitted value is the attempt key, never a
  // fresh seed — and no setState runs inside an effect.
  assert.match(formSource, /name="idempotencyKey" defaultValue=\{initialIdempotencyKey\}/);
  assert.match(formSource, /keyInputRef\.current\.value = resolveProposalIdempotencyKey/);
  assert.doesNotMatch(formSource, /setIdempotencyKey/);
});

test("form error box offers status check + same-key retry only on an unknown outcome", () => {
  // The check URL is built by the shared helper (executed in
  // lib/proposal-status-check.test.ts); the form passes the attempt's
  // estimate so the match rule can apply.
  assert.match(formSource, /buildStatusCheckUrl\(projectId, selectedEstimateId \|\| null\)/);
  assert.match(formSource, /Check proposal status/);
  assert.match(formSource, /Try again with the same details/);
  // The retry renders only under the unknown outcome: the 409 key-reuse
  // state shows the server message + check link only, and a known
  // rejection shows the error alone.
  assert.match(formSource, /outcome === "unknown"/);
  const retryIndex = formSource.indexOf("Try again with the same details");
  const unknownIndex = formSource.indexOf('outcome === "unknown"');
  assert.ok(unknownIndex !== -1 && unknownIndex < retryIndex, "retry must sit inside the unknown-outcome branch");
});

test("new-proposal page still seeds a key for the first render", () => {
  assert.match(newPageSource, /randomUUID\(\)/);
  assert.match(newPageSource, /initialIdempotencyKey/);
});

test("project page carries the status check into the proposals tab", () => {
  assert.match(projectPageSource, /statusCheck/);
  assert.match(projectPageSource, /estimateId/);
  assert.match(projectPageSource, /PROPOSAL_STATUS_CHECK_LIST_ERROR/);
});

test("project workspace renders the guidance card above the proposals list on a status check", () => {
  assert.match(workspaceSource, /ProposalStatusCheckCard/);
  assert.match(workspaceSource, /statusCheck/);
  assert.match(workspaceSource, /This is your draft/);
});

test("proposal detail page shows the replay notice and clears the resolved attempt key", () => {
  assert.match(detailPageSource, /replayed/);
  assert.match(detailPageSource, /PROPOSAL_REPLAY_NOTICE/);
  assert.match(detailPageSource, /ClearProposalAttemptKey/);
});
