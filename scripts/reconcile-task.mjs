#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import process from "node:process";
import { classifyTask, formatAutonomyPreflight } from "./reconcile-task-lib.mjs";

function parseArgs(argv) {
  const args = { task: null, referencedBranch: null, base: "origin/main", fetch: true, json: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") args.help = true;
    else if (value === "--no-fetch") args.fetch = false;
    else if (value === "--json") args.json = true;
    else if (["--task", "--referenced-branch", "--base"].includes(value)) {
      const next = argv[index + 1];
      if (!next) throw new Error(`${value} requires a value`);
      const key = value === "--task" ? "task" : value === "--base" ? "base" : "referencedBranch";
      args[key] = next;
      index += 1;
    } else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function helpText() {
  return [
    "TradeOS autonomy reconciliation preflight",
    "",
    "Usage:",
    "  npm run autonomy:reconcile -- --task <objective> [--referenced-branch <branch>] [--base origin/main]",
    "",
    "Options:",
    "  --task <objective>             Required task objective used for semantic overlap search.",
    "  --referenced-branch <branch>   Historical branch named by the task, if any.",
    "  --base <ref>                   Base ref to inspect (default: origin/main).",
    "  --no-fetch                     Skip git fetch --all --prune (diagnostic use only).",
    "  --json                         Emit the snapshot and classification as JSON.",
    "  --help                         Show this help.",
    "",
    "Requires authenticated GitHub CLI access. This helper surfaces evidence; the agent must inspect matches before acting.",
  ].join("\n");
}

function run(command, args) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function git(args) {
  return run("git", args);
}

function ghJson(args) {
  try {
    const output = run("gh", args);
    return output ? JSON.parse(output) : [];
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error("GitHub CLI (gh) is required for live PR reconciliation");
    }
    throw new Error(`Unable to inspect GitHub pull requests: ${error.message}`);
  }
}

function parseCommitLog(output) {
  return output
    .split("\u001e")
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [sha, title, body] = record.split("\u001f");
      return { sha, title, body };
    });
}

function recentClosed(prs, days = 30) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return prs.filter((pr) => {
    const timestamp = pr.closedAt ?? pr.mergedAt;
    return timestamp && Date.parse(timestamp) >= cutoff;
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(helpText());
    return;
  }
  if (!args.task) throw new Error("--task is required");

  git(["rev-parse", "--show-toplevel"]);
  if (args.fetch) git(["fetch", "--all", "--prune"]);

  const prFields = "number,title,body,state,isDraft,headRefName,baseRefName,closedAt,mergedAt,files";
  const openPrs = ghJson(["pr", "list", "--state", "open", "--limit", "100", "--json", prFields]);
  const closedPrs = recentClosed(
    ghJson(["pr", "list", "--state", "closed", "--limit", "100", "--json", prFields]),
  );
  const remoteBranches = git(["branch", "-r", "--format=%(refname:short)"])
    .split("\n")
    .map((branch) => branch.trim())
    .filter((branch) => branch && branch !== "origin" && branch !== "origin/HEAD" && !branch.startsWith("origin/pr/"));
  const mainCommits = parseCommitLog(
    git(["log", "-n", "20", "--format=%H%x1f%s%x1f%b%x1e", args.base]),
  );

  const snapshot = {
    task: args.task,
    referencedBranch: args.referencedBranch,
    repositoryState: git(["status", "--short", "--branch"]),
    currentBranch: git(["branch", "--show-current"]),
    mainSha: git(["rev-parse", args.base]),
    openPrs,
    closedPrs,
    remoteBranches,
    mainCommits,
  };
  const result = classifyTask(snapshot);

  if (args.json) console.log(JSON.stringify({ snapshot, result }, null, 2));
  else console.log(formatAutonomyPreflight(snapshot, result));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
