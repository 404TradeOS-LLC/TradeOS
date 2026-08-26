import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { minimatch } from "minimatch";
import yaml from "js-yaml";

export const EXIT_CODES = {
  OK: 0,
  MISSING_DOCS: 1,
  CONFIG_ERROR: 2,
  GIT_ERROR: 3,
};

export function parseArgs(argv) {
  const args = { help: false, base: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") {
      args.help = true;
      continue;
    }
    if (value === "--base") {
      args.base = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

export function helpText() {
  return [
    "TradeOS docs consistency checker",
    "",
    "Usage:",
    "  npm run docs:check -- [--base <git-ref>]",
    "",
    "Options:",
    "  --base <git-ref>   Override the base ref used for diff detection.",
    "  --help             Show this help output.",
    "",
    "Exit codes:",
    `  ${EXIT_CODES.OK}  pass`,
    `  ${EXIT_CODES.MISSING_DOCS}  required documentation files are missing from the diff`,
    `  ${EXIT_CODES.CONFIG_ERROR}  invalid configuration or invalid command usage`,
    `  ${EXIT_CODES.GIT_ERROR}  git base resolution or diff execution failed`,
  ].join("\n");
}

export function loadOwnershipConfig(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = yaml.load(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("DOC_OWNERSHIP config must be a YAML object");
  }
  const rules = validateEntries(parsed.rules, "rules", "requires");
  const exemptions = validateEntries(parsed.exemptions ?? [], "exemptions", "reason");
  return { rules, exemptions };
}

function validateEntries(entries, fieldName, secondaryKey) {
  if (!Array.isArray(entries)) {
    throw new Error(`DOC_OWNERSHIP ${fieldName} must be an array`);
  }
  return entries.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`DOC_OWNERSHIP ${fieldName}[${index}] must be an object`);
    }
    if (!Array.isArray(entry.paths) || entry.paths.length === 0 || entry.paths.some((item) => typeof item !== "string")) {
      throw new Error(`DOC_OWNERSHIP ${fieldName}[${index}].paths must be a non-empty string array`);
    }
    if (secondaryKey === "requires") {
      if (!Array.isArray(entry.requires) || entry.requires.length === 0 || entry.requires.some((item) => typeof item !== "string")) {
        throw new Error(`DOC_OWNERSHIP ${fieldName}[${index}].requires must be a non-empty string array`);
      }
    } else if (typeof entry.reason !== "string" || entry.reason.trim() === "") {
      throw new Error(`DOC_OWNERSHIP ${fieldName}[${index}].reason must be a non-empty string`);
    }
    return entry;
  });
}

export function resolveBaseRef({ argsBase = null, env = process.env, git = defaultGit }) {
  const explicit = argsBase || env.DOCS_CHECK_BASE || (env.GITHUB_BASE_REF ? `origin/${env.GITHUB_BASE_REF}` : null);
  if (explicit) return explicit;
  try {
    git(["rev-parse", "--verify", "origin/main"]);
    return "origin/main";
  } catch {
    return "main";
  }
}

export function getChangedFiles(baseRef, git = defaultGit) {
  try {
    const committed = collectPathsFromNameStatus(splitOutput(git(["diff", "--name-status", "-M", `${baseRef}...HEAD`])));
    const staged = collectPathsFromNameStatus(splitOutput(git(["diff", "--name-status", "-M", "--cached"])));
    const unstaged = collectPathsFromNameStatus(splitOutput(git(["diff", "--name-status", "-M"])));
    const untracked = splitOutput(git(["ls-files", "--others", "--exclude-standard"]));
    return [...new Set([...committed, ...staged, ...unstaged, ...untracked])].sort();
  } catch (error) {
    throw new Error(`Unable to compute changed files against ${baseRef}: ${error.message}`);
  }
}

export function evaluateOwnership({ changedFiles, config }) {
  const changedSet = new Set(changedFiles);
  const docChanges = changedFiles.filter((file) => file.startsWith("docs/"));
  const exemptionMatches = collectMatches(changedFiles, config.exemptions);
  const matchingRules = collectMatches(changedFiles, config.rules);
  const requiredDocs = new Set();
  for (const rule of matchingRules) {
    for (const doc of rule.requires) {
      requiredDocs.add(doc);
    }
  }
  const missingDocs = [...requiredDocs].filter((doc) => !changedSet.has(doc)).sort();
  return {
    changedFiles,
    docChanges,
    matchingRules,
    exemptionMatches,
    requiredDocs: [...requiredDocs].sort(),
    missingDocs,
  };
}

function collectMatches(changedFiles, entries) {
  return entries.filter((entry) => changedFiles.some((file) => entry.paths.some((pattern) => pathMatches(file, pattern))));
}

export function pathMatches(filePath, pattern) {
  return filePath === pattern || minimatch(filePath, pattern, { dot: true, nocase: false });
}

export function formatReport({ baseRef, result }) {
  const lines = [];
  lines.push(`Base ref: ${baseRef}`);
  lines.push(`Changed files: ${result.changedFiles.length}`);
  if (result.changedFiles.length > 0) {
    lines.push(...result.changedFiles.map((file) => `  - ${file}`));
  }
  if (result.matchingRules.length === 0) {
    lines.push("Matched ownership rules: none");
  } else {
    lines.push("Matched ownership rules:");
    for (const rule of result.matchingRules) {
      const label = rule.explanation ? `${rule.paths.join(", ")} (${rule.explanation})` : rule.paths.join(", ");
      lines.push(`  - ${label}`);
    }
  }
  if (result.exemptionMatches.length > 0) {
    lines.push("Matched exemptions:");
    for (const exemption of result.exemptionMatches) {
      lines.push(`  - ${exemption.paths.join(", ")} (${exemption.reason})`);
    }
  }
  if (result.requiredDocs.length === 0) {
    lines.push("Required documentation files: none");
  } else {
    lines.push("Required documentation files:");
    lines.push(...result.requiredDocs.map((doc) => `  - ${doc}`));
  }
  if (result.missingDocs.length === 0) {
    lines.push("Result: PASS");
  } else {
    lines.push("Missing documentation updates:");
    lines.push(...result.missingDocs.map((doc) => `  - ${doc}`));
    lines.push("Result: FAIL");
  }
  return lines.join("\n");
}

function defaultGit(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function splitOutput(output) {
  return output.split("\n").map((line) => line.trim()).filter(Boolean);
}

function collectPathsFromNameStatus(lines) {
  const paths = [];
  for (const line of lines) {
    const parts = line.split("\t").filter(Boolean);
    if (parts.length < 2) {
      throw new Error(`Malformed git diff --name-status line: ${line}`);
    }
    const status = parts[0];
    if (status.startsWith("R") || status.startsWith("C")) {
      if (parts.length < 3 || !parts[1] || !parts[2]) {
        throw new Error(`Malformed rename/copy git diff --name-status line: ${line}`);
      }
      paths.push(parts[1]);
      paths.push(parts[2]);
      continue;
    }
    if (!parts[1]) {
      throw new Error(`Malformed git diff --name-status line: ${line}`);
    }
    paths.push(parts[1]);
  }
  return paths;
}

export function ensureConfigExists(configPath) {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing required config: ${configPath}`);
  }
}

export function repoPath(...parts) {
  return path.join(process.cwd(), ...parts);
}
