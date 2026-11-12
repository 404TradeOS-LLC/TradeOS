import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const workflow = fs.readFileSync(
  new URL("../../.github/workflows/pr-commander.yml", import.meta.url),
  "utf8"
);

// Regression tests for the CodeRabbit thread fixes on PR #964 (2026-11-10).
// The Commander workflow is YAML + inline shell, so these tests pin the
// exact contract lines the fixes establish; the behavior they protect is
// also simulated in docs (see the repair log for the live evidence).

test("evaluate uploads a per-PR verdict artifact (upload-artifact v4 forbids two jobs sharing one name)", () => {
  assert.match(workflow, /name: pr-commander-verdict-\$\{\{ matrix\.pr \}\}/);
  assert.doesNotMatch(workflow, /name: pr-commander-verdicts\b/);
  assert.doesNotMatch(workflow, /--name pr-commander-verdicts\b/);
});

test("report and act download verdicts by pattern, not by single shared name", () => {
  const downloads = workflow.match(/gh run download[^;\n]*--pattern 'pr-commander-verdict-\*'[^;\n]*/g);
  assert.ok(downloads, "expected pattern downloads");
  assert.equal(downloads.length, 2, "report job + act job");
});

test("attempt-count reads match both GraphQL and REST bot logins", () => {
  // `gh pr view --json comments` (GraphQL) reports the bot as
  // `github-actions`; the REST API reports `github-actions[bot]`.
  // Filtering on either alone misses the stored count and the per-head
  // cap can never trigger (verified live: coderabbitai vs
  // coderabbitai[bot] on the same comment).
  const reads = workflow.match(
    /gh pr view "\$PR_NUMBER" --repo "\$GITHUB_REPOSITORY" --json comments[\s\S]{0,200}?author\.login == "github-actions" or \.author\.login == "github-actions\[bot\]"/g
  );
  assert.ok(reads, "expected GraphQL reads matching both logins");
  assert.equal(reads.length, 1, "evaluate snapshot step");
  assert.match(
    workflow,
    /recorded_attempts\(\) \{[\s\S]*?select\(\.author\.login == "github-actions" or \.author\.login == "github-actions\[bot\]"\)/
  );
  // The REST lookup inside upsert_verdict_comment still uses the REST
  // login — that one is correct as-is.
  assert.match(
    workflow,
    /select\(\.user\.login == "github-actions\[bot\]" and \(\.body \| contains\("<!-- tradeos-pr-commander -->"\)\)\)/
  );
});

test("auto-merge is pinned to the validated head SHA (TOCTOU)", () => {
  assert.match(
    workflow,
    /gh pr merge --auto --squash --match-head-commit "\$head_sha" "\$pr" --repo "\$GITHUB_REPOSITORY"/
  );
});

test("repair attempt counter advances exactly once per attempt, on attempt start", () => {
  const increments = workflow.match(/attempts=\$\(\(attempts \+ 1\)\)/g);
  assert.ok(increments, "expected increments");
  // One increment site per repair path: the lint repair, the rebase
  // dispatch, and the AI (Codex) invocation. Each path advances the
  // counter exactly once, at its attempt start, and never again — so a
  // single attempt is never double-counted.
  assert.equal(increments.length, 3, "exactly one increment site per repair path");
  // Lint path: increment after checkout succeeds, before the fix runs.
  const lintIncrementAt = workflow.indexOf("attempts=$((attempts + 1))");
  const checkoutAt = workflow.indexOf('if gh pr checkout "$pr"');
  const lintFixAt = workflow.indexOf("npm run lint -- --fix");
  const pushAt = workflow.indexOf('git push origin "HEAD:');
  assert.ok(checkoutAt > -1 && lintFixAt > -1 && pushAt > -1);
  assert.ok(
    lintIncrementAt > checkoutAt && lintIncrementAt < lintFixAt,
    "lint increment happens after checkout succeeds, before the fix runs"
  );
  // Rebase path: increment only after a successful pr-maintenance dispatch.
  const dispatchAt = workflow.indexOf("gh workflow run pr-maintenance.yml");
  assert.ok(dispatchAt > -1, "expected a pr-maintenance dispatch");
  const rebaseIncrementAt = workflow.indexOf("attempts=$((attempts + 1))", dispatchAt);
  assert.ok(
    rebaseIncrementAt > dispatchAt,
    "rebase increment happens after a successful dispatch"
  );
  // AI path: increment only after the Codex invocation comment posts
  // successfully. It is the third and last increment site: it runs after
  // the rebase dispatch (a dispatched rebase skips the AI tier, since the
  // head is about to move), and nothing increments after it.
  const aiCommentPostAt = workflow.indexOf('$(cat ai-comment.md)');
  assert.ok(aiCommentPostAt > -1, "expected the AI invocation comment post");
  const aiIncrementAt = workflow.indexOf("attempts=$((attempts + 1))", rebaseIncrementAt + 1);
  assert.ok(aiIncrementAt > -1, "expected an AI invocation increment");
  assert.ok(
    aiIncrementAt > aiCommentPostAt,
    "AI increment happens after the Codex invocation comment posts"
  );
  assert.equal(
    workflow.indexOf("attempts=$((attempts + 1))", aiIncrementAt + 1),
    -1,
    "no increment after the AI invocation"
  );
  // The AI invocation also advances its own once-per-head counter.
  assert.match(workflow, /ai_invocations=\$\(\(ai_invocations \+ 1\)\)/);
});

test("rebase dispatch guard reads merge state from the snapshot, not the verdict", () => {
  // evaluateGate returns { verdict, reasons, nextActions, founderItems,
  // headSha } — no `snapshot` field — so fresh-verdict.json has no
  // `.snapshot`. The rebase guard must read mergeStateStatus/baseRefName
  // from fresh.json (the build_snapshot payload), or the dispatch would
  // never fire. (CodeRabbit, PR #966.)
  assert.doesNotMatch(workflow, /\.snapshot\.mergeStateStatus/);
  assert.doesNotMatch(workflow, /\.snapshot\.baseRefName/);
  assert.match(
    workflow,
    /jq -r '\.mergeStateStatus' fresh\.json.*" = "BEHIND"/
  );
  assert.match(
    workflow,
    /jq -r '\.baseRefName' fresh\.json.*" = "main"/
  );
});

test("repair block failures skip only the current PR (set -e guards)", () => {
  assert.match(workflow, /if git diff --check && \(cd web && npm test/);
  assert.match(workflow, /if git push origin "HEAD:\$\(git branch --show-current\)"; then/);
  // No bare, unguarded fallible repair commands remain.
  const bareDiffCheck = workflow.match(/^ *git diff --check$/gm);
  assert.equal(bareDiffCheck, null, "git diff --check must be guarded");
  const barePush = workflow.match(/^ *git push origin "HEAD:/gm);
  assert.equal(barePush, null, "git push must be guarded");
  assert.match(workflow, /git switch main 2>\/dev\/null \|\| true/);
});

test("repair push uses an explicit CI-triggering credential and fails closed if none is installed", () => {
  // A real git push authenticated by GITHUB_TOKEN does not generate PR CI
  // workflow runs; the deterministic repair lane must not use that fallback.
  assert.match(
    workflow,
    /token: \$\{\{ secrets\.TRADEOS_PR_COMMANDER_PUSH_TOKEN \|\| github\.token \}\}/,
  );
  assert.match(
    workflow,
    /persist-credentials: \$\{\{ secrets\.TRADEOS_PR_COMMANDER_PUSH_TOKEN != '' \}\}/,
  );
  assert.match(
    workflow,
    /REPAIR_PUSH_TOKEN_AVAILABLE: \$\{\{ secrets\.TRADEOS_PR_COMMANDER_PUSH_TOKEN != '' \}\}/,
  );
  const guard = 'if [ "$fresh_verdict" = "REPAIRABLE" ] && [ "$attempts" -lt 3 ] && [ "$REPAIR_PUSH_TOKEN_AVAILABLE" = "true" ]; then';
  const guardIndex = workflow.indexOf(guard);
  const checkoutIndex = workflow.indexOf('if gh pr checkout "$pr"');
  const pushIndex = workflow.indexOf('git push origin "HEAD:');
  assert.ok(guardIndex !== -1 && checkoutIndex > guardIndex && pushIndex > checkoutIndex);
  assert.match(
    workflow,
    /Skipping deterministic repair push: no founder-provisioned CI-triggering credential/,
  );
});

test("stacked-base guard proceeds only when the base is actually MERGED", () => {
  // `gh pr merge --auto` returns as soon as auto-merge is enabled, not
  // when the merge completes, so membership in `merged` (auto-merge enabled
  // this run) is not proof the base merged. The guard must re-read
  // base_state from GitHub and proceed only on MERGED; a dependent whose
  // base is still open waits for the next run. (CodeRabbit, PR #967.)
  assert.doesNotMatch(workflow, /\*\\" \$base_pr \\"\*/);
  assert.doesNotMatch(workflow, /Base PR #\$base_pr merged in this run/);
  assert.match(
    workflow,
    /base_state=\$\(gh pr view "\$base_pr" --repo "\$GITHUB_REPOSITORY" --json state --jq \.state\)/
  );
  assert.match(workflow, /if \[ "\$base_state" = "MERGED" \]; then/);
  // The `merged` list is still kept for the repair-loop skip and the run
  // summary — only the base guard must not consult it.
  assert.match(workflow, /case " \$merged " in \*" \$pr "\*\) continue ;; esac/);
});

test("AI repair invocation is gated on the repair outcome flags and the lib eligibility", () => {
  // The AI tier runs only when the deterministic tier did not push and no
  // rebase was dispatched (either moves, or is about to move, the head).
  // Eligibility itself is enforced by the lib (isAiRepairEligible); the
  // workflow only invokes Codex when the lib writes ai-comment.md.
  assert.match(
    workflow,
    /if \[ "\$fresh_verdict" = "REPAIRABLE" \] && \[ "\$attempts" -lt 3 \] && \[ "\$repair_pushed" != "true" \] && \[ "\$rebase_dispatched" != "true" \]; then/
  );
  assert.match(workflow, /repair_pushed="true"/);
  assert.match(workflow, /rebase_dispatched="true"/);
  assert.match(
    workflow,
    /import \{ buildAiRepairComment, failedCheckNames, isAiRepairEligible, normalizeSnapshot \}/
  );
  assert.match(workflow, /fs\.writeFileSync\('ai-comment\.md', body\)/);
  assert.match(workflow, /if \[ -s ai-comment\.md \]; then/);
  // Fork PRs never get an AI invocation (same-repo only).
  assert.match(workflow, /PR #\$pr is from fork \$head_repo; no AI repair invocation\./);
});

test("verdict comment records the AI invocation count per head", () => {
  // The ai-repair marker rides in the verdict comment next to the
  // repair-attempts counter, so the once-per-head guard survives across
  // runs. Every upsert call site must pass the recorded count, or a
  // re-write would reset the marker to 0 and the guard would never hold.
  assert.match(workflow, /'ai-repair:' \+ verdict\.headSha \+ ':' \+ \(process\.env\.AI_INVOCATIONS_RECORDED \?\? '0'\)/);
  const upserts = workflow.match(/AI_INVOCATIONS_RECORDED="\$ai_invocations" upsert_verdict_comment/g);
  assert.ok(upserts, "expected AI_INVOCATIONS_RECORDED at upsert call sites");
  assert.equal(upserts.length, 5, "ready loop (3) + repair loop (2)");
  const reads = workflow.match(/ai_invocations=\$\(recorded_ai_invocations "\$pr" "\$head_sha"\)/g);
  assert.ok(reads, "expected recorded_ai_invocations reads");
  assert.equal(reads.length, 2, "ready loop + repair loop");
  assert.match(
    workflow,
    /recorded_ai_invocations\(\) \{[\s\S]*?grep -o "ai-repair:\$\{head_sha\}:\[0-9\]\*"/
  );
});

test("act step enforces exact \"true\" in the shell before any write", () => {
  // GitHub expression `==` compares strings case-insensitively, so the job
  // `if` cannot enforce the exact value — a variable set to `TRUE` would
  // pass it. The case-sensitive enforcement is a bash check at the top of
  // the "Apply verdicts" step, before any write, for both variables.
  // (CodeRabbit, PR #968. Corrects the PR #967 rebuttal that claimed the
  // job `if` was case-sensitive; it is not.)
  const applyStep = workflow.slice(workflow.indexOf("Apply verdicts in dependency order"));
  assert.match(
    applyStep,
    /TRADEOS_PR_COMMANDER_UNATTENDED_ENABLED: \$\{\{ vars\.TRADEOS_PR_COMMANDER_UNATTENDED_ENABLED \}\}/
  );
  assert.match(
    applyStep,
    /if \[ "\$TRADEOS_PR_COMMANDER_WRITE_ENABLED" != "true" \]; then/
  );
  assert.match(
    applyStep,
    /if \[ "\$GITHUB_EVENT_NAME" = "schedule" \] && \[ "\$TRADEOS_PR_COMMANDER_UNATTENDED_ENABLED" != "true" \]; then/
  );
  // The exact check must precede the first write (git config is the first
  // command after it; every gh/git-push write comes later in the step).
  const checkAt = applyStep.indexOf('if [ "$TRADEOS_PR_COMMANDER_WRITE_ENABLED" != "true" ]');
  const gitConfigAt = applyStep.indexOf('git config user.name');
  const firstMergeAt = applyStep.indexOf("gh pr merge");
  assert.ok(checkAt > -1 && gitConfigAt > checkAt && firstMergeAt > checkAt);
});
