import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const workflow = fs.readFileSync(new URL("../../.github/workflows/pr-commander.yml", import.meta.url), "utf8");

test("scheduled write automation requires two explicit repository controls", () => {
  assert.match(workflow, /vars\.TRADEOS_PR_COMMANDER_WRITE_ENABLED == 'true'/);
  assert.match(workflow, /vars\.TRADEOS_PR_COMMANDER_UNATTENDED_ENABLED == 'true'/);
  assert.match(workflow, /github\.event_name == 'schedule'/);
});

test("pull request events cannot enter the write job", () => {
  const actGate = workflow.slice(workflow.indexOf("\n  act:"), workflow.indexOf("\n    runs-on:", workflow.indexOf("\n  act:")));
  assert.match(actGate, /github\.event_name == 'schedule'/);
  assert.match(actGate, /github\.event_name == 'workflow_dispatch'/);
  assert.doesNotMatch(actGate, /github\.event_name == 'pull_request'/);
});

test("scheduled automation is disabled when either opt-in variable is absent", () => {
  const actGate = workflow.slice(workflow.indexOf("\n  act:"), workflow.indexOf("\n    runs-on:", workflow.indexOf("\n  act:")));
  assert.match(actGate, /vars\.TRADEOS_PR_COMMANDER_WRITE_ENABLED == 'true'/);
  assert.match(actGate, /vars\.TRADEOS_PR_COMMANDER_UNATTENDED_ENABLED == 'true'/);
});

test("armed action still revalidates exact head and uses pinned auto merge", () => {
  assert.match(workflow, /--match-head-commit "\$head_sha"/);
  assert.match(workflow, /build_snapshot "\$pr"/);
});

test("act gate re-checks the raw variables at job admission (kill-switch)", () => {
  // The act job must re-derive arming from the repository variables at job
  // admission, not consume discovery's effective_armed output: flipping
  // either variable off after discovery but before the act job starts
  // prevents the write job from running. This does NOT abort an
  // already-running act job — cancel that separately. (Codex review, PR #968.)
  // Exact "true" is enforced here, in discovery, and in isArmed().
  const actGate = workflow.slice(workflow.indexOf("\n  act:"), workflow.indexOf("\n    runs-on:", workflow.indexOf("\n  act:")));
  assert.match(actGate, /vars\.TRADEOS_PR_COMMANDER_WRITE_ENABLED == 'true'/);
  assert.match(actGate, /vars\.TRADEOS_PR_COMMANDER_UNATTENDED_ENABLED == 'true'/);
  assert.doesNotMatch(actGate, /needs\.\w+\.outputs\.effective_armed/);
});
