import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_REPAIR_MARKER_PREFIX,
  MAX_REPAIR_ATTEMPTS,
  buildAiRepairComment,
  failedCheckNames,
  isAiRepairEligible,
} from "../pr-commander-lib.mjs";

// Phase 4 (PR Commander AI repair worker): eligibility is fail-closed and
// the invocation comment carries the trigger phrase, the failing checks,
// the scope limits, and the prohibitions. The worker never approves,
// merges, dismisses, or resolves — the comment instructs Codex to do none
// of those, and the merge bar still decides every merge.

const BASE = {
  files: ["web/src/lib/example.ts"],
  isDraft: false,
  mergeable: "MERGEABLE",
  mergeStateStatus: "CLEAN",
  failedChecks: ["App lint, unit tests, and build"],
  unresolvedThreads: 0,
  attempts: 0,
  aiInvocations: 0,
  sameRepo: true,
};

test("AI repair is eligible for a same-repo REPAIRABLE PR with a failing check", () => {
  const result = isAiRepairEligible(BASE);
  assert.equal(result.eligible, true);
  assert.deepEqual(result.reasons, []);
});

test("AI repair is eligible when only unresolved threads stand (no failing check)", () => {
  const result = isAiRepairEligible({ ...BASE, failedChecks: [], unresolvedThreads: 2 });
  assert.equal(result.eligible, true);
});

test("AI repair is ineligible with nothing to address", () => {
  const result = isAiRepairEligible({ ...BASE, failedChecks: [], unresolvedThreads: 0 });
  assert.equal(result.eligible, false);
  assert.match(result.reasons.join(" "), /Nothing for the AI worker to address/);
});

test("AI repair is ineligible on a draft", () => {
  const result = isAiRepairEligible({ ...BASE, isDraft: true });
  assert.equal(result.eligible, false);
  assert.match(result.reasons.join(" "), /draft/);
});

test("AI repair is ineligible on a conflicting branch", () => {
  const result = isAiRepairEligible({ ...BASE, mergeable: "CONFLICTING", mergeStateStatus: "DIRTY" });
  assert.equal(result.eligible, false);
  assert.match(result.reasons.join(" "), /conflict/);
});

test("AI repair is ineligible on a behind branch (rebase first)", () => {
  const result = isAiRepairEligible({ ...BASE, mergeStateStatus: "BEHIND" });
  assert.equal(result.eligible, false);
  assert.match(result.reasons.join(" "), /behind/);
});

test("AI repair is ineligible when the PR touches a protected surface", () => {
  for (const files of [
    ["app/prisma/migrations/20261111000000_add_x/migration.sql"],
    ["app/modules/auth/service.ts"],
    ["app/tests/rls.integration.ts"],
    [".github/workflows/deploy-staging-migrations.yml"],
  ]) {
    const result = isAiRepairEligible({ ...BASE, files });
    assert.equal(result.eligible, false, JSON.stringify(files));
    assert.match(result.reasons.join(" "), /protected surface/);
  }
});

test("AI repair is ineligible for a fork PR", () => {
  const result = isAiRepairEligible({ ...BASE, sameRepo: false });
  assert.equal(result.eligible, false);
  assert.match(result.reasons.join(" "), /fork/);
});

test("AI repair is ineligible once the per-head attempt cap is reached", () => {
  const result = isAiRepairEligible({ ...BASE, attempts: MAX_REPAIR_ATTEMPTS });
  assert.equal(result.eligible, false);
  assert.match(result.reasons.join(" "), /exhausted/);
});

test("AI repair is ineligible after one invocation on the same head", () => {
  const result = isAiRepairEligible({ ...BASE, aiInvocations: 1 });
  assert.equal(result.eligible, false);
  assert.match(result.reasons.join(" "), /already invoked once/);
});

test("AI repair eligibility fails closed on unknown input", () => {
  assert.equal(isAiRepairEligible().eligible, false);
  assert.equal(isAiRepairEligible({}).eligible, false);
  assert.equal(isAiRepairEligible({ files: ["app/modules/x.ts"] }).eligible, false);
});

test("failedCheckNames lists only failed conclusions", () => {
  const names = failedCheckNames({
    checks: [
      { name: "Web lint and build", conclusion: "SUCCESS" },
      { name: "App lint, unit tests, and build", conclusion: "FAILURE" },
      { name: "App integration tests", conclusion: "CANCELLED" },
      { name: "Docs consistency", conclusion: null, status: "COMPLETED" },
      { name: "CodeQL", conclusion: "NEUTRAL" },
    ],
  });
  assert.deepEqual(names, ["App lint, unit tests, and build", "App integration tests"]);
});

test("failedCheckNames returns an empty list when nothing failed", () => {
  assert.deepEqual(failedCheckNames({ checks: [] }), []);
  assert.deepEqual(failedCheckNames({}), []);
});

test("AI repair comment carries the Codex trigger, the failing checks, and the head", () => {
  const body = buildAiRepairComment({
    pr: 937,
    headSha: "297e0432ddd02fc30d5eda16efa5acfd356e22cc",
    failingChecks: ["App lint, unit tests, and build"],
    unresolvedThreads: 0,
    runUrl: "https://github.com/404TradeOS-LLC/TradeOS/actions/runs/42966011831",
  });
  assert.match(body, /<!-- tradeos-pr-commander-ai-repair -->/);
  assert.match(body, /@codex address that feedback/);
  assert.match(body, /`App lint, unit tests, and build`/);
  assert.match(body, /`297e0432ddd02fc30d5eda16efa5acfd356e22cc`/);
  assert.match(body, /https:\/\/github\.com\/404TradeOS-LLC\/TradeOS\/actions\/runs\/42966011831/);
  assert.match(body, /PR #937/);
});

test("AI repair comment states the scope limits and prohibitions", () => {
  const body = buildAiRepairComment({
    pr: 1,
    headSha: "a".repeat(40),
    failingChecks: ["Web lint and build"],
    unresolvedThreads: 3,
    runUrl: "",
  });
  assert.match(body, /3 unresolved review thread\(s\) also stand/);
  assert.match(body, /Do not modify migrations, authentication\/authorization, row-level security, workflow files, or production configuration/);
  assert.match(body, /Push the fix to this PR's branch only — never to main/);
  assert.match(body, /Do not approve this PR, merge it, dismiss any review, or resolve any review thread/);
  assert.match(body, /add or update a regression test that fails before the fix and passes after it/);
  assert.match(body, /chain dependency/);
  assert.doesNotMatch(body, /Failing CI: $/m);
});

test("AI repair marker prefix is stable for the verdict-comment counter", () => {
  assert.equal(AI_REPAIR_MARKER_PREFIX, "ai-repair:");
  const line = `${AI_REPAIR_MARKER_PREFIX}${"b".repeat(40)}:1`;
  assert.match(line, /^ai-repair:[0-9a-f]{40}:[0-9]+$/);
});
