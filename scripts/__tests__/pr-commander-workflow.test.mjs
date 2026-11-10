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
  assert.ok(increments, "expected one increment");
  assert.equal(increments.length, 1, "exactly one increment site");
  const incrementAt = workflow.indexOf("attempts=$((attempts + 1))");
  const checkoutAt = workflow.indexOf('if gh pr checkout "$pr"');
  const lintFixAt = workflow.indexOf("npm run lint -- --fix");
  const pushAt = workflow.indexOf('git push origin "HEAD:');
  assert.ok(checkoutAt > -1 && lintFixAt > -1 && pushAt > -1);
  assert.ok(
    incrementAt > checkoutAt && incrementAt < lintFixAt,
    "increment happens after checkout succeeds, before the fix runs"
  );
  assert.ok(
    workflow.indexOf("attempts=$((attempts + 1))", pushAt) === -1,
    "no increment after a successful push"
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
