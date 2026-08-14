import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
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

test("does not treat reverted base-history evidence as current implementation", () => {
  const result = classifyTask(snapshot({
    task: "Make canonical event persistence transactional",
    mainCommits: [
      {
        sha: "badc0ffee",
        title: 'Revert "wrap canonical event write in database transaction"',
        body: "This reverts commit feedfacefeedfacefeedfacefeedfacefeedface.",
      },
      {
        sha: "feedfacefeedfacefeedfacefeedfacefeedface",
        title: "wrap canonical event write in database transaction",
      },
    ],
  }));

  assert.equal(result.classification, CLASSIFICATIONS.NEW_WORK_REQUIRED);
  assert.equal(result.mainMatches.length, 1);
  assert.equal(result.revertedMainMatches[0].sha, "feedfacefeedfacefeedfacefeedfacefeedface");
  assert.equal(result.revertedMainMatches[0].revertedBy.sha, "badc0ffee");
});

test("CLI scans complete base history rather than a recent commit window", () => {
  const fixtureDir = mkdtempSync(join(tmpdir(), "tradeos-reconcile-"));
  const binDir = join(fixtureDir, "bin");
  const gitLogPath = join(fixtureDir, "git-argv.log");
  const repoDir = join(fixtureDir, "repo");
  const history = [
    ...Array.from({ length: 20 }, (_, index) => [
      `unrelated${index + 1}`,
      `fix invoice rounding ${index + 1}`,
      "",
    ]),
    ["oldermatch", "wrap canonical event write in database transaction", ""],
  ];

  mkdirSync(binDir, { recursive: true });
  mkdirSync(repoDir, { recursive: true });

  const gitScript = `#!/usr/bin/env node
import { appendFileSync } from "node:fs";
const argv = process.argv.slice(2);
appendFileSync(${JSON.stringify(gitLogPath)}, argv.join(" ") + "\\n");
if (argv[0] === "rev-parse" && argv[1] === "--show-toplevel") console.log(${JSON.stringify(repoDir)});
else if (argv[0] === "branch" && argv[1] === "-r") console.log("");
else if (argv[0] === "log") {
  if (argv.includes("-20")) process.exit(42);
  console.log(${JSON.stringify(history.map((record) => record.join("\u001f")).join("\u001e"))});
}
else if (argv[0] === "status") console.log("## main...origin/main");
else if (argv[0] === "branch" && argv[1] === "--show-current") console.log("main");
else if (argv[0] === "rev-parse") console.log("basesha");
else process.exit(0);
`;
  const ghScript = `#!/usr/bin/env node
console.log("[]");
`;
  writeFileSync(join(binDir, "git"), gitScript);
  writeFileSync(join(binDir, "gh"), ghScript);
  chmodSync(join(binDir, "git"), 0o755);
  chmodSync(join(binDir, "gh"), 0o755);

  const scriptPath = fileURLToPath(new URL("../reconcile-task.mjs", import.meta.url));
  const completed = spawnSync(process.execPath, [
    scriptPath,
    "--no-fetch",
    "--json",
    "--task",
    "Make canonical event persistence transactional",
  ], {
    cwd: repoDir,
    env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` },
    encoding: "utf8",
  });

  assert.equal(completed.status, 0, completed.stderr);
  const parsed = JSON.parse(completed.stdout);
  assert.equal(parsed.result.classification, CLASSIFICATIONS.NO_ACTION_REQUIRED);
  assert.equal(parsed.result.mainMatches[0].sha, "oldermatch");
  assert.doesNotMatch(readFileSync(gitLogPath, "utf8"), /\s-20(?:\s|$)/);
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
  assert.match(report, /^Reverted main evidence:/m);
  assert.match(report, /^Classification: EXISTING_WORK_FOUND$/m);
  assert.match(report, /^Chosen action:/m);
  assert.match(report, /^Reason:/m);
});
