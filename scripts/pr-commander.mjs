#!/usr/bin/env node
// pr-commander.mjs — CLI for the TradeOS Autonomous PR Commander.
//
// Reads one PR snapshot, evaluates it with scripts/pr-commander-lib.mjs, and
// prints the verdict JSON plus the dry-run plan. This CLI is READ-ONLY: it
// never writes to the repository, never comments, never merges, never pushes.
// Writes happen only in `.github/workflows/pr-commander.yml` (job `act`),
// behind the armed variable. The `--mode` flag only changes how the plan is
// worded; it never arms anything from this process.
//
// Snapshot sources (first match wins):
//   --snapshot <file>   JSON file with a lib snapshot (or a `gh pr view`
//                       --json payload, which is normalized automatically)
//   --stdin             read the snapshot JSON from stdin
//   --pr <number>       fetch a live snapshot with `gh` (requires gh auth)
//   <positional>        a JSON string
//
// The lib snapshot shape is:
//   { number, headSha, isDraft, mergeStateStatus, mergeable, reviewDecision,
//     checks: [{ name, conclusion, status? }], threads: { total, unresolved },
//     reviews: [{ state }], baseRefName, headRefName, files[], attempts?,
//     adr009Record?, prOnlyCategory? }
//
// Usage:
//   node scripts/pr-commander.mjs --help
//   node scripts/pr-commander.mjs --snapshot pr-921.json
//   gh pr view 921 --json number,isDraft,mergeStateStatus,mergeable,reviewDecision,headRefOid,baseRefName,headRefName,files,reviews,statusCheckRollup | node scripts/pr-commander.mjs --stdin
//   node scripts/pr-commander.mjs --pr 921 --mode dry-run
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";
import {
  ARMED_VARIABLE,
  COMMANDER_MARKER,
  FOUNDER_LABEL,
  MAX_REPAIR_ATTEMPTS,
  evaluateGate,
  headVerdictKey,
  isArmed,
  nextRetryDelayMs,
  normalizeSnapshot,
} from "./pr-commander-lib.mjs";

const MODES = ["audit", "dry-run", "armed"];

function helpText() {
  return [
    "TradeOS PR Commander — evaluate one PR snapshot against the merge bar",
    "",
    "Usage:",
    "  node scripts/pr-commander.mjs --snapshot <file> [--mode audit|dry-run|armed] [--attempts N]",
    "  node scripts/pr-commander.mjs --stdin [--mode audit|dry-run|armed] [--attempts N]",
    "  node scripts/pr-commander.mjs --pr <number> [--mode audit|dry-run|armed]",
    "  node scripts/pr-commander.mjs --help",
    "",
    "Options:",
    "  --snapshot <file>   Read the snapshot JSON from a file.",
    "  --stdin             Read the snapshot JSON from stdin.",
    "  --pr <number>       Fetch a live snapshot with `gh pr view` (read-only).",
    "  --mode <mode>       audit | dry-run (default) | armed. Only changes how",
    "                      the plan is worded; this CLI never performs writes.",
    "  --attempts <n>      Repair attempts already made on this head (default 0).",
    "  --help              Show this help.",
    "",
    "Output: the verdict JSON, then the plan. In dry-run mode every planned",
    `write is printed as "dry-run: would <action>" and none is performed.`,
    `Arming is read from the environment (${ARMED_VARIABLE}=true, the`,
    "repository variable); this CLI performs no writes itself.",
    "",
    `Verdict comment marker: ${COMMANDER_MARKER}`,
    `Founder label: ${FOUNDER_LABEL}`,
    `Max repair attempts per head: ${MAX_REPAIR_ATTEMPTS}`,
  ].join("\n");
}

function parseArgs(argv) {
  const args = { snapshot: null, stdin: false, pr: null, mode: "dry-run", attempts: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--help" || value === "-h") args.help = true;
    else if (value === "--stdin") args.stdin = true;
    else if (value === "--snapshot" || value === "--pr" || value === "--mode" || value === "--attempts") {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) throw new Error(`${value} requires a value`);
      if (value === "--snapshot") args.snapshot = next;
      else if (value === "--pr") args.pr = next;
      else if (value === "--mode") args.mode = next;
      else args.attempts = next;
      i += 1;
    } else if (value.startsWith("--")) {
      throw new Error(`Unknown argument: ${value}`);
    } else if (!args.positional) {
      args.positional = value;
    } else {
      throw new Error(`Unexpected argument: ${value}`);
    }
  }
  if (!MODES.includes(args.mode)) throw new Error(`--mode must be one of: ${MODES.join(", ")}`);
  if (args.attempts !== null) {
    const n = Number(args.attempts);
    if (!Number.isInteger(n) || n < 0) throw new Error("--attempts must be a non-negative integer");
    args.attempts = n;
  }
  if (args.pr !== null && !/^\d+$/.test(args.pr)) throw new Error("--pr must be a PR number");
  const sources = [args.snapshot, args.stdin, args.pr, args.positional].filter(Boolean).length;
  if (!args.help && sources !== 1) {
    throw new Error("Provide exactly one snapshot source: --snapshot, --stdin, --pr, or a JSON argument.");
  }
  return args;
}

function fetchLiveSnapshot(prNumber) {
  const fields = [
    "number", "isDraft", "mergeStateStatus", "mergeable", "reviewDecision",
    "headRefOid", "baseRefName", "headRefName", "files", "reviews",
    "statusCheckRollup",
  ].join(",");
  let out;
  try {
    out = execFileSync("gh", ["pr", "view", String(prNumber), "--json", fields], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    throw new Error(`gh pr view failed for #${prNumber}: ${(error.stderr || error.message || "").trim()}`);
  }
  const raw = JSON.parse(out);
  // `gh pr view` has no reviewThreads field; fetch them via GraphQL (read-only).
  try {
    const gql = execFileSync(
      "gh",
      [
        "api", "graphql",
        "-F", `owner=${process.env.GITHUB_REPOSITORY?.split("/")[0] ?? "404TradeOS-LLC"}`,
        "-F", "name=TradeOS",
        "-F", `number=${prNumber}`,
        "-f",
        "query=query($owner: String!, $name: String!, $number: Int!) { repository(owner: $owner, name: $name) { pullRequest(number: $number) { reviewThreads(first: 100) { nodes { isResolved } pageInfo { hasNextPage } } } } }",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    const threads = JSON.parse(gql).data?.repository?.pullRequest?.reviewThreads;
    if (threads && threads.pageInfo?.hasNextPage === false) raw.reviewThreads = threads;
  } catch {
    // Threads stay unknown; the evaluator treats a missing thread count as
    // zero only when the snapshot says so — here we leave it absent and the
    // workflow re-reads threads before any write. Never invent thread data.
  }
  return normalizeSnapshot(raw);
}

function readStdin() {
  return fs.readFileSync(0, "utf8");
}

// Build the plan: what the Commander WOULD do for this verdict. In dry-run
// (the default) every line is a "would" and nothing is executed. The
// workflow's `act` job executes the same plan, in dependency order, only
// when armed — and it re-reads the snapshot at the exact head first.
function buildPlan(snapshot, verdict) {
  const armed = isArmed(process.env);
  const verb = armed ? "armed: will" : "dry-run: would";
  const lines = [];
  const head = headVerdictKey(snapshot);
  lines.push(`${verb} record the verdict for PR #${snapshot.number ?? "?"} at head ${head ?? "unknown"} as ${verdict.verdict} (artifact JSON + run summary).`);
  lines.push(`${verb} update the single verdict comment in place (marker ${COMMANDER_MARKER}) with the verdict, reasons, evidence links, and repair-attempt count.`);
  if (verdict.founderItems.length > 0) {
    lines.push(`${verb} apply label ${FOUNDER_LABEL} to PR #${snapshot.number ?? "?"} (founder decision required; no email, no external message).`);
    for (const item of verdict.founderItems) lines.push(`${verb} surface founder item: ${item}`);
  }
  for (const action of verdict.nextActions) lines.push(`${verb} ${action}`);
  if (verdict.verdict === "MERGE_READY" || verdict.verdict === "DRY_RUN_ONLY") {
    lines.push(`${verb} re-read the PR at the exact head ${head} immediately before merging; if the head moved or the verdict changed, stop with no merge.`);
    if (verdict.verdict === "MERGE_READY") {
      lines.push(`${verb} enable auto-merge with: gh pr merge --auto --squash ${snapshot.number ?? "<pr>"}`);
    } else {
      lines.push(`${verb} enable auto-merge with: gh pr merge --auto --squash ${snapshot.number ?? "<pr>"} — only once armed (repository variable ${ARMED_VARIABLE}=true plus a dispatch with mode=armed).`);
    }
  }
  if (verdict.verdict === "REPAIRABLE") {
    const nextAttempt = (snapshot.attempts ?? 0) + 1;
    const delay = nextRetryDelayMs(nextAttempt);
    if (delay === null) {
      lines.push(`${verb} escalate: repair attempts exhausted for this head; no further automatic repair.`);
    } else {
      lines.push(`${verb} wait ${delay / 1000}s (exponential backoff, attempt ${(snapshot.attempts ?? 0) + 1} of ${MAX_REPAIR_ATTEMPTS}) before the next repair attempt.`);
      lines.push(`${verb} repair deterministically first (lint autofix pattern), delegate security findings to CodeQL Autofix, and request CodeRabbit re-review after the repair push (rate-limited; back off, do not hammer).`);
    }
  }
  if (verdict.verdict === "BLOCKED_ESCALATED") {
    lines.push(`${verb} stop all automatic repair for this head; notify the founder via the verdict comment + ${FOUNDER_LABEL} label only.`);
  }
  return lines;
}

function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`error: ${error.message}\n\n${helpText()}\n`);
    return 1;
  }
  if (args.help) {
    process.stdout.write(`${helpText()}\n`);
    return 0;
  }
  let raw;
  try {
    if (args.snapshot) raw = JSON.parse(fs.readFileSync(args.snapshot, "utf8"));
    else if (args.stdin) raw = JSON.parse(readStdin());
    else if (args.positional) raw = JSON.parse(args.positional);
    else raw = fetchLiveSnapshot(Number(args.pr));
  } catch (error) {
    process.stderr.write(`error: could not read snapshot: ${error.message}\n`);
    return 1;
  }
  let snapshot;
  try {
    snapshot = normalizeSnapshot(raw);
  } catch (error) {
    process.stderr.write(`error: ${error.message}\n`);
    return 1;
  }
  if (args.attempts !== null) snapshot.attempts = args.attempts;
  if (args.pr !== null) snapshot.number = Number(args.pr);
  // Armed state comes only from the environment (the repository variable),
  // never from --mode: a local --mode armed without the variable set still
  // evaluates as dry-run. The workflow's `act` job sets the variable from
  // vars.TRADEOS_PR_COMMANDER_WRITE_ENABLED before invoking this CLI.
  const verdict = evaluateGate(snapshot, { armed: isArmed(process.env) });
  const plan = buildPlan(snapshot, verdict);
  process.stdout.write(`${JSON.stringify({ snapshot: { number: snapshot.number, headSha: verdict.headSha }, verdict }, null, 2)}\n`);
  process.stdout.write(`\nPlan (${args.mode}${isArmed(process.env) ? ", armed variable set" : ", dry-run"}):\n`);
  for (const line of plan) process.stdout.write(`- ${line}\n`);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
