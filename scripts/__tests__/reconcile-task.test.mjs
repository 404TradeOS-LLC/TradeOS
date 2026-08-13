import assert from "node:assert/strict";
import test from "node:test";
import {
  CLASSIFICATIONS,
  classifyTask,
  formatAutonomyPreflight,
  overlapScore,
} from "../reconcile-task-lib.mjs";

function snapshot(overrides = {}) {
  return {
    task: "",
    mainSha: "abc123",
    currentBranch: "main",
    repositoryState: "## main...origin/main",
    openPrs: [],
    closedPrs: [],
    remoteBranches: [],
    mainCommits: [],
    ...overrides,
  };
}

test("classifies a semantically overlapping open PR as existing work", () => {
  const result = classifyTask(snapshot({
    task: "Add production health endpoint",
    openPrs: [{ number: 178, title: "feat: add production readiness health surface" }],
  }));

  assert.equal(result.classification, CLASSIFICATIONS.EXISTING_WORK_FOUND);
  assert.equal(result.openMatches[0].number, 178);
});

test("treats a missing historical branch as stale when main already contains the change", () => {
  const result = classifyTask(snapshot({
    task: "Make canonical event persistence transactional",
    referencedBranch: "chore/old-transaction-branch",
    mainCommits: [{ sha: "feedface", title: "wrap canonical event write in database transaction" }],
  }));

  assert.equal(result.classification, CLASSIFICATIONS.NO_ACTION_REQUIRED);
  assert.equal(result.staleReferencedBranch, true);
});

test("detects a matching main commit beyond the first 20 history entries", () => {
  const mainCommits = Array.from({ length: 20 }, (_, index) => ({
    sha: `unrelated-${index + 1}`,
    title: `fix invoice rounding ${index + 1}`,
  }));
  mainCommits.push({
    sha: "older-match",
    title: "wrap canonical event write in database transaction",
  });

  const result = classifyTask(snapshot({
    task: "Make canonical event persistence transactional",
    mainCommits,
  }));

  assert.equal(result.classification, CLASSIFICATIONS.NO_ACTION_REQUIRED);
  assert.equal(result.mainMatches[0].sha, "older-match");
});

test("permits new work only when no viable overlapping evidence exists", () => {
  const result = classifyTask(snapshot({
    task: "Add governance preflight for duplicate pull requests",
    mainCommits: [{ sha: "1234", title: "fix invoice rounding" }],
  }));

  assert.equal(result.classification, CLASSIFICATIONS.NEW_WORK_REQUIRED);
  assert.equal(result.openMatches.length, 0);
  assert.equal(result.mainMatches.length, 0);
});

test("surfaces a recently closed duplicate before classifying new work", () => {
  const result = classifyTask(snapshot({
    task: "Add production health endpoint",
    closedPrs: [{ number: 174, title: "feat: add production readiness health surface" }],
  }));

  assert.equal(result.classification, CLASSIFICATIONS.NEW_WORK_REQUIRED);
  assert.equal(result.closedMatches[0].number, 174);
  assert.match(result.reason, /closed attempts require review/i);
});

test("an explicitly referenced existing branch blocks new branch creation", () => {
  const result = classifyTask(snapshot({
    task: "Repair event persistence",
    referencedBranch: "fix/event-persistence",
    remoteBranches: ["origin/fix/event-persistence"],
  }));

  assert.equal(result.classification, CLASSIFICATIONS.EXISTING_WORK_FOUND);
  assert.equal(result.referencedBranchExists, true);
});

test("semantic scoring recognizes transactional persistence phrasing", () => {
  assert.ok(
    overlapScore(
      "make event persistence transactional",
      { title: "wrap canonical event write in database transaction" },
    ) >= 0.58,
  );
});

test("formats the required autonomy preflight evidence fields", () => {
  const input = snapshot({
    task: "Add production health endpoint",
    openPrs: [{ number: 178, title: "production readiness health surface" }],
  });
  const report = formatAutonomyPreflight(input, classifyTask(input));

  assert.match(report, /^AUTONOMY PREFLIGHT/m);
  assert.match(report, /^Main SHA:/m);
  assert.match(report, /^Open relevant PRs:/m);
  assert.match(report, /^Relevant remote branches:/m);
  assert.match(report, /^Recent related closed PRs:/m);
  assert.match(report, /^Existing implementation on main:/m);
  assert.match(report, /^Classification: EXISTING_WORK_FOUND$/m);
  assert.match(report, /^Chosen action:/m);
  assert.match(report, /^Reason:/m);
});
