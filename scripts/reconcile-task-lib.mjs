export const CLASSIFICATIONS = Object.freeze({
  EXISTING_WORK_FOUND: "EXISTING_WORK_FOUND",
  NEW_WORK_REQUIRED: "NEW_WORK_REQUIRED",
  NO_ACTION_REQUIRED: "NO_ACTION_REQUIRED",
});

const STOP_WORDS = new Set([
  "a",
  "add",
  "an",
  "and",
  "as",
  "at",
  "be",
  "by",
  "chore",
  "docs",
  "feat",
  "fix",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "make",
  "of",
  "on",
  "or",
  "repair",
  "the",
  "this",
  "to",
  "update",
  "with",
]);

const TOKEN_ALIASES = new Map([
  ["writes", "persist"],
  ["write", "persist"],
  ["written", "persist"],
  ["persistence", "persist"],
  ["persisted", "persist"],
  ["persisting", "persist"],
  ["transactional", "transaction"],
  ["transactions", "transaction"],
  ["readiness", "health"],
  ["ready", "health"],
  ["probe", "health"],
  ["endpoint", "surface"],
  ["config", "configuration"],
  ["configs", "configuration"],
  ["owners", "owner"],
  ["ownership", "owner"],
  ["autonomous", "autonomy"],
  ["automation", "autonomy"],
  ["automated", "autonomy"],
  ["duplicates", "duplicate"],
  ["duplicated", "duplicate"],
  ["reconciled", "reconcile"],
  ["reconciliation", "reconcile"],
]);

function normalizeToken(token) {
  const aliased = TOKEN_ALIASES.get(token) ?? token;
  if (aliased.length > 5 && aliased.endsWith("ing")) return aliased.slice(0, -3);
  if (aliased.length > 4 && aliased.endsWith("ed")) return aliased.slice(0, -2);
  if (aliased.length > 4 && aliased.endsWith("s")) return aliased.slice(0, -1);
  return aliased;
}

export function tokenize(value) {
  const tokens = String(value ?? "")
    .toLowerCase()
    .replace(/([a-z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([a-z])/g, "$1 $2")
    .match(/[a-z0-9]+/g) ?? [];

  return new Set(
    tokens
      .map(normalizeToken)
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
  );
}

function itemText(item) {
  const files = Array.isArray(item.files)
    ? item.files.map((file) => (typeof file === "string" ? file : file.path)).filter(Boolean).join(" ")
    : "";
  return [item.title, item.body, item.message, item.name, item.headRefName, files]
    .filter(Boolean)
    .join(" ");
}

function identifiers(value) {
  return new Set(
    String(value ?? "")
      .toUpperCase()
      .match(/(?:#[0-9]+|\b(?:S|A|C)[0-9]+(?:\.[0-9]+)?\b)/g) ?? [],
  );
}

function intersectionSize(left, right) {
  let count = 0;
  for (const value of left) {
    if (right.has(value)) count += 1;
  }
  return count;
}

export function overlapScore(task, item) {
  const taskText = String(task ?? "");
  const evidenceText = itemText(item);
  const taskIds = identifiers(taskText);
  const evidenceIds = identifiers(evidenceText);
  if (intersectionSize(taskIds, evidenceIds) > 0) return 1;

  const taskTokens = tokenize(taskText);
  const evidenceTokens = tokenize(evidenceText);
  if (taskTokens.size === 0 || evidenceTokens.size === 0) return 0;

  const shared = intersectionSize(taskTokens, evidenceTokens);
  if (shared < 2) return 0;

  const taskCoverage = shared / taskTokens.size;
  const smallerCoverage = shared / Math.min(taskTokens.size, evidenceTokens.size);
  return Number((taskCoverage * 0.7 + smallerCoverage * 0.3).toFixed(3));
}

export function findMatches(task, items, threshold = 0.58) {
  return (items ?? [])
    .map((item) => ({ ...item, overlapScore: overlapScore(task, item) }))
    .filter((item) => item.overlapScore >= threshold)
    .sort((left, right) => right.overlapScore - left.overlapScore);
}

function branchName(branch) {
  return typeof branch === "string" ? branch : branch.name;
}

export function classifyTask(snapshot) {
  const task = snapshot.task;
  if (!task || String(task).trim() === "") {
    throw new Error("Task text is required for reconciliation");
  }

  const branches = snapshot.remoteBranches ?? [];
  const openMatches = findMatches(task, snapshot.openPrs);
  const closedMatches = findMatches(task, snapshot.closedPrs);
  const mainMatches = findMatches(task, snapshot.mainCommits);
  const branchMatches = findMatches(
    task,
    branches.map((branch) => ({ name: branchName(branch) })),
  );
  const referencedBranch = snapshot.referencedBranch?.trim() || null;
  const referencedBranchExists = referencedBranch
    ? branches.some((branch) => branchName(branch) === referencedBranch || branchName(branch) === `origin/${referencedBranch}`)
    : false;

  if (referencedBranchExists || openMatches.length > 0 || branchMatches.length > 0) {
    return {
      classification: CLASSIFICATIONS.EXISTING_WORK_FOUND,
      chosenAction: "Inspect and advance the existing branch or pull request; do not create another branch or PR.",
      reason: referencedBranchExists
        ? `Referenced branch ${referencedBranch} exists and must be inspected before new work.`
        : "An open pull request or remote branch substantially overlaps the task.",
      referencedBranchExists,
      staleReferencedBranch: false,
      openMatches,
      closedMatches,
      mainMatches,
      branchMatches,
    };
  }

  if (mainMatches.length > 0) {
    return {
      classification: CLASSIFICATIONS.NO_ACTION_REQUIRED,
      chosenAction: "Make no implementation change and report the main-branch evidence.",
      reason: "Recent origin/main history substantially matches the requested work.",
      referencedBranchExists,
      staleReferencedBranch: Boolean(referencedBranch),
      openMatches,
      closedMatches,
      mainMatches,
      branchMatches,
    };
  }

  return {
    classification: CLASSIFICATIONS.NEW_WORK_REQUIRED,
    chosenAction: "After reviewing surfaced closed attempts, create one bounded branch from current origin/main.",
    reason: closedMatches.length > 0
      ? "No viable open effort or implementation on main was found; related closed attempts require review before starting."
      : "No substantially overlapping open effort, remote branch, or implementation on main was found.",
    referencedBranchExists,
    staleReferencedBranch: Boolean(referencedBranch),
    openMatches,
    closedMatches,
    mainMatches,
    branchMatches,
  };
}

function formatPr(pr) {
  return `#${pr.number ?? "?"} ${pr.title ?? pr.headRefName ?? "untitled"}`;
}

function formatList(items, formatter) {
  return items.length > 0 ? items.map(formatter).join("; ") : "none";
}

export function formatAutonomyPreflight(snapshot, result) {
  return [
    "AUTONOMY PREFLIGHT",
    `Repository state: ${snapshot.repositoryState ?? "unknown"}`,
    `Current branch: ${snapshot.currentBranch ?? "unknown"}`,
    `Main SHA: ${snapshot.mainSha ?? "unknown"}`,
    `Open relevant PRs: ${formatList(result.openMatches, formatPr)}`,
    `Relevant remote branches: ${formatList(result.branchMatches, (branch) => branch.name)}`,
    `Recent related closed PRs: ${formatList(result.closedMatches, formatPr)}`,
    `Existing implementation on main: ${formatList(result.mainMatches, (commit) => `${commit.sha?.slice(0, 12) ?? "unknown"} ${commit.title ?? commit.message ?? ""}`.trim())}`,
    `Referenced branch: ${snapshot.referencedBranch ?? "none"}${result.staleReferencedBranch ? " (stale input)" : ""}`,
    `Classification: ${result.classification}`,
    `Chosen action: ${result.chosenAction}`,
    `Reason: ${result.reason}`,
  ].join("\n");
}
