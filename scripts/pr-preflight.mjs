#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  ensureConfigExists,
  evaluateOwnership,
  getChangedFiles,
  loadOwnershipConfig,
  repoPath,
  resolveBaseRef,
} from "./docs-check-lib.mjs";

export function parsePreflightArgs(argv) {
  const args = { base: null, run: false, json: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--base") {
      args.base = argv[index + 1] ?? null;
      index += 1;
    } else if (value === "--run") {
      args.run = true;
    } else if (value === "--json") {
      args.json = true;
    } else if (value === "--help" || value === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return args;
}

export function buildVerificationPlan(changedFiles) {
  const appChanged = changedFiles.some(
    (file) => file.startsWith("app/") || file.startsWith("packages/knowledge-engine/")
  );
  const webChanged = changedFiles.some((file) => file.startsWith("web/"));
  const integrationSensitive = changedFiles.some((file) =>
    [
      "app/prisma/schema.prisma",
      "app/prisma/migrations/",
      "app/db/",
      "app/backend/middleware/databaseSession.ts",
      "app/backend/middleware/auth.ts",
      "app/backend/middleware/platformProvisioningAuth.ts",
      "app/modules/auth/",
      "app/tests/rls.integration.ts",
    ].some((prefix) => file === prefix || file.startsWith(prefix))
  );

  const commands = [{ label: "Diff whitespace", command: "git", args: ["diff", "--check"] }];

  if (appChanged) {
    commands.push(
      { label: "App unit tests", command: "npm", args: ["--prefix", "app", "test"] },
      { label: "App lint/typecheck", command: "npm", args: ["--prefix", "app", "run", "lint"] },
      { label: "App build", command: "npm", args: ["--prefix", "app", "run", "build"] }
    );
    if (integrationSensitive) {
      commands.push({ label: "App integration tests", command: "npm", args: ["--prefix", "app", "run", "test:integration"] });
    }
  }

  if (webChanged) {
    commands.push(
      { label: "Web unit tests", command: "npm", args: ["--prefix", "web", "test"] },
      { label: "Web lint", command: "npm", args: ["--prefix", "web", "run", "lint"] },
      { label: "Web build", command: "npm", args: ["--prefix", "web", "run", "build"] }
    );
  }

  return { appChanged, webChanged, integrationSensitive, commands };
}

export function buildPreflight({ baseRef, changedFiles, ownership }) {
  return {
    baseRef,
    changedFiles,
    requiredDocs: ownership.requiredDocs,
    missingDocs: ownership.missingDocs,
    verification: buildVerificationPlan(changedFiles),
  };
}

function formatCommand(step) {
  return [step.command, ...step.args].join(" ");
}

export function formatPreflight(preflight) {
  const lines = [
    `Base ref: ${preflight.baseRef}`,
    `Changed files: ${preflight.changedFiles.length}`,
  ];

  if (preflight.changedFiles.length > 0) {
    lines.push(...preflight.changedFiles.map((file) => `  - ${file}`));
  }

  lines.push("Required docs:");
  lines.push(...(preflight.requiredDocs.length ? preflight.requiredDocs.map((doc) => `  - ${doc}`) : ["  - none"]));

  lines.push("Missing required docs:");
  lines.push(...(preflight.missingDocs.length ? preflight.missingDocs.map((doc) => `  - ${doc}`) : ["  - none"]));

  lines.push("Recommended verification:");
  lines.push(...preflight.verification.commands.map((step) => `  - ${step.label}: ${formatCommand(step)}`));

  if (preflight.verification.appChanged && !preflight.verification.integrationSensitive) {
    lines.push("Integration note: app changed, but no schema/RLS/request-session/auth-sensitive path changed; local integration is optional unless the implementation risk requires it.");
  }

  return lines.join("\n");
}

function runStep(step) {
  console.log(`\n> ${step.label}: ${formatCommand(step)}`);
  execFileSync(step.command, step.args, { stdio: "inherit" });
}

export function runPreflight(preflight) {
  if (preflight.missingDocs.length > 0) {
    throw new Error(`Preflight blocked: add meaningful updates to required docs before expensive verification: ${preflight.missingDocs.join(", ")}`);
  }
  for (const step of preflight.verification.commands) runStep(step);
}

function helpText() {
  return [
    "TradeOS PR preflight",
    "",
    "Usage:",
    "  npm run pr:preflight -- [--base <git-ref>] [--json] [--run]",
    "",
    "The default mode reports changed paths, required documentation, missing docs, and the minimum local verification plan.",
    "Use --run only after required docs are present; it fails fast on documentation drift before running expensive app/web verification.",
  ].join("\n");
}

function main() {
  const args = parsePreflightArgs(process.argv.slice(2));
  if (args.help) {
    console.log(helpText());
    return;
  }

  const configPath = repoPath("docs", "DOC_OWNERSHIP.yml");
  ensureConfigExists(configPath);
  const config = loadOwnershipConfig(configPath);
  const baseRef = resolveBaseRef({ argsBase: args.base });
  const changedFiles = getChangedFiles(baseRef);
  const ownership = evaluateOwnership({ changedFiles, config });
  const preflight = buildPreflight({ baseRef, changedFiles, ownership });

  console.log(args.json ? JSON.stringify(preflight, null, 2) : formatPreflight(preflight));
  if (args.run) runPreflight(preflight);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath === import.meta.url) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
