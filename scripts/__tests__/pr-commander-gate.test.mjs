import assert from "node:assert/strict";
import test from "node:test";
import { evaluateGate, headVerdictKey } from "../pr-commander-lib.mjs";

// Tests for the PR Commander coordinator gate (Workstream C).
//
// Contract under test (Workstream B builds `scripts/pr-commander-lib.mjs`):
//   evaluateGate(snapshot) -> { verdict, reasons[], nextActions[], founderItems[] }
//   headVerdictKey(snapshot) -> the exact head SHA the verdict stands on
// Verdicts: MERGE_READY | REPAIRABLE | BLOCKED | BLOCKED_ESCALATED | DRY_RUN_ONLY
//
// Merge bar (docs/REPOSITORY_GOVERNANCE.md + AGENTS.md): non-draft, the four
// required checks green, current branch, zero unresolved threads, no standing
// change request, ADR-009 record where required.
//
// Assumptions the brief leaves unspecified (flagged for the coordinator if the
// lib disagrees — these tests assert the contract as written, not a guess
// about B's internals):
//   - "Current branch" is mergeStateStatus "CLEAN" with mergeable "MERGEABLE";
//     "BEHIND" means the branch is stale, "DIRTY"/"CONFLICTING" means conflict.
//   - A standing change request is visible via reviewDecision ===
//     "CHANGES_REQUESTED" and/or a CHANGES_REQUESTED entry in `reviews`.
//   - An ADR-009 record is required when the snapshot's files include a
//     PR-only category (here: migration files); that requirement is derived
//     from `files`, since the snapshot carries no separate ADR/category field.
//   - Dry-run arming reaches evaluateGate as a second argument
//     `{ armed: false }` and yields DRY_RUN_ONLY instead of MERGE_READY.

const REQUIRED_CHECKS = [
  "Web lint and build",
  "App lint, unit tests, and build",
  "App integration tests",
  "Docs consistency",
];

const HEAD_A = "a".repeat(40);
const HEAD_B = "b".repeat(40);

function readySnapshot(overrides = {}) {
  return {
    number: 945,
    headSha: HEAD_A,
    isDraft: false,
    mergeStateStatus: "CLEAN",
    mergeable: "MERGEABLE",
    reviewDecision: null,
    checks: REQUIRED_CHECKS.map((name) => ({ name, conclusion: "SUCCESS" })),
    threads: { total: 0, unresolved: 0 },
    reviews: [],
    baseRefName: "main",
    files: ["web/src/app/page.tsx"],
    ...overrides,
  };
}

function assertGateShape(result) {
  assert.equal(typeof result, "object");
  assert.ok(
    ["MERGE_READY", "REPAIRABLE", "BLOCKED", "BLOCKED_ESCALATED", "DRY_RUN_ONLY"].includes(result.verdict),
    `unknown verdict: ${result.verdict}`,
  );
  assert.ok(Array.isArray(result.reasons), "reasons must be an array");
  assert.ok(Array.isArray(result.nextActions), "nextActions must be an array");
  assert.ok(Array.isArray(result.founderItems), "founderItems must be an array");
}

test("MERGE_READY only when every gate condition holds", () => {
  const result = evaluateGate(readySnapshot());
  assertGateShape(result);
  assert.equal(result.verdict, "MERGE_READY");
  assert.deepEqual(result.founderItems, []);
});

test("reviewDecision absent (field omitted) is as ready as null", () => {
  const snapshot = readySnapshot();
  delete snapshot.reviewDecision;
  assert.equal(evaluateGate(snapshot).verdict, "MERGE_READY");
});

test("extra green checks beyond the four required do not block MERGE_READY", () => {
  const snapshot = readySnapshot({
    checks: [
      ...REQUIRED_CHECKS.map((name) => ({ name, conclusion: "SUCCESS" })),
      { name: "Extra optional check", conclusion: "SUCCESS" },
    ],
  });
  assert.equal(evaluateGate(snapshot).verdict, "MERGE_READY");
});

test("draft flips the verdict away from MERGE_READY", () => {
  const result = evaluateGate(readySnapshot({ isDraft: true }));
  assertGateShape(result);
  assert.notEqual(result.verdict, "MERGE_READY");
  assert.ok(result.reasons.length > 0);
});

test("one required check failing flips the verdict to REPAIRABLE", () => {
  const snapshot = readySnapshot();
  snapshot.checks = snapshot.checks.map((check) =>
    check.name === "Docs consistency" ? { ...check, conclusion: "FAILURE" } : check,
  );
  const result = evaluateGate(snapshot);
  assertGateShape(result);
  assert.equal(result.verdict, "REPAIRABLE");
  assert.ok(result.reasons.length > 0);
  assert.ok(result.nextActions.length > 0, "a repairable failure must name a next action");
});

test("one required check missing/unreported flips the verdict away from MERGE_READY", () => {
  const snapshot = readySnapshot({
    checks: REQUIRED_CHECKS.slice(0, 3).map((name) => ({ name, conclusion: "SUCCESS" })),
  });
  const result = evaluateGate(snapshot);
  assertGateShape(result);
  assert.notEqual(result.verdict, "MERGE_READY");
  assert.ok(result.reasons.length > 0);
});

test("a required check still pending (no conclusion) flips the verdict away from MERGE_READY", () => {
  const snapshot = readySnapshot();
  snapshot.checks = snapshot.checks.map((check) =>
    check.name === "App integration tests" ? { ...check, conclusion: null } : check,
  );
  const result = evaluateGate(snapshot);
  assertGateShape(result);
  assert.notEqual(result.verdict, "MERGE_READY");
  assert.ok(result.reasons.length > 0);
});

test("branch BEHIND flips the verdict away from MERGE_READY", () => {
  const result = evaluateGate(readySnapshot({ mergeStateStatus: "BEHIND" }));
  assertGateShape(result);
  assert.notEqual(result.verdict, "MERGE_READY");
  assert.ok(result.reasons.length > 0);
});

test("one unresolved thread flips the verdict away from MERGE_READY", () => {
  const result = evaluateGate(readySnapshot({ threads: { total: 1, unresolved: 1 } }));
  assertGateShape(result);
  assert.notEqual(result.verdict, "MERGE_READY");
  assert.ok(result.reasons.length > 0);
});

test("standing CHANGES_REQUESTED via reviewDecision is BLOCKED with a dismissal founder item", () => {
  const result = evaluateGate(readySnapshot({ reviewDecision: "CHANGES_REQUESTED" }));
  assertGateShape(result);
  assert.equal(result.verdict, "BLOCKED");
  assert.match(result.founderItems.join(" "), /dismiss/i);
});

test("standing CHANGES_REQUESTED via the reviews array is BLOCKED with a dismissal founder item", () => {
  const result = evaluateGate(readySnapshot({
    reviews: [{ state: "CHANGES_REQUESTED", author: "reviewer", submittedAt: "2026-11-10T00:00:00Z" }],
  }));
  assertGateShape(result);
  assert.equal(result.verdict, "BLOCKED");
  assert.match(result.founderItems.join(" "), /dismiss/i);
});

test("DIRTY/CONFLICTING routes to human resolution even when all reported checks are green", () => {
  // A conflicting branch gets NO pull_request CI runs, so green reported
  // checks are stale evidence and the branch is not repairable by CI.
  const result = evaluateGate(readySnapshot({
    mergeStateStatus: "DIRTY",
    mergeable: "CONFLICTING",
  }));
  assertGateShape(result);
  assert.notEqual(result.verdict, "MERGE_READY");
  assert.notEqual(result.verdict, "REPAIRABLE");
  assert.ok(
    ["BLOCKED", "BLOCKED_ESCALATED"].includes(result.verdict),
    `conflict must route to a human-held verdict, got ${result.verdict}`,
  );
  assert.match(
    [...result.reasons, ...result.nextActions].join(" "),
    /conflict|human|rebase|escalat|founder/i,
  );
});

test("headVerdictKey returns the exact head SHA the verdict stands on", () => {
  assert.equal(headVerdictKey(readySnapshot()), HEAD_A);
  assert.equal(headVerdictKey(readySnapshot({ headSha: HEAD_B })), HEAD_B);
});

test("stale-evidence rule: a verdict key for head A differs from the key for head B", () => {
  const keyA = headVerdictKey(readySnapshot({ headSha: HEAD_A }));
  const keyB = headVerdictKey(readySnapshot({ headSha: HEAD_B }));
  assert.notEqual(keyA, keyB);
  assert.equal(keyA, HEAD_A);
  assert.equal(keyB, HEAD_B);
  assert.equal(
    headVerdictKey(readySnapshot({ headSha: HEAD_A })),
    keyA,
    "the same head must always yield the same key",
  );
});

test("migration files without an ADR-009 record are BLOCKED with an ADR-009 founder item", () => {
  const result = evaluateGate(readySnapshot({
    files: ["app/prisma/migrations/20261110_add_permit_tasks/migration.sql"],
  }));
  assertGateShape(result);
  assert.equal(result.verdict, "BLOCKED");
  assert.match(result.founderItems.join(" "), /ADR-009/);
});

test("ordinary files with no protected category do not create ADR-009 founder items", () => {
  const result = evaluateGate(readySnapshot({
    files: ["web/src/app/page.tsx", "app/modules/estimates/service.ts"],
  }));
  assert.equal(result.verdict, "MERGE_READY");
  assert.deepEqual(result.founderItems, []);
});

test("dry-run guard: an unarmed evaluation never reports MERGE_READY", () => {
  const result = evaluateGate(readySnapshot(), { armed: false });
  assertGateShape(result);
  assert.equal(result.verdict, "DRY_RUN_ONLY");
});

test("armed evaluation of a ready snapshot still reports MERGE_READY", () => {
  const result = evaluateGate(readySnapshot(), { armed: true });
  assert.equal(result.verdict, "MERGE_READY");
});
