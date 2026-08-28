// Phase 30 — the single canonical developer entrypoint: `npm run beta:evidence`.
//
// Configuration comes from environment variables and flags only; nothing here
// requires editing source to change the RC URL.
//
//   npm run beta:evidence
//   npm run beta:evidence -- --viewport=390
//   npm run beta:evidence -- --headed
//   npm run beta:evidence -- --skip-isolation

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VIEWPORTS } from "./lib/evidence-artifacts.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

function flagValue(name) {
  const match = args.find((arg) => arg.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : undefined;
}
const hasFlag = (name) => args.includes(`--${name}`);

if (hasFlag("help")) {
  console.log(
    [
      "Usage: npm run beta:evidence -- [options]",
      "",
      "Options:",
      "  --viewport=<1440|1024|768|390>  Capture a single viewport instead of all four",
      "  --headed                        Run the browser headed (local debugging)",
      "  --skip-isolation                Skip the tenant-isolation probe",
      "  --help                          Show this message",
      "",
      "Required environment:",
      "  BETA_RC_BASE_URL              Approved non-production RC URL",
      "  BETA_EXPECTED_ENVIRONMENT     preview | staging",
      "  BETA_ACTUAL_ENVIRONMENT       must equal BETA_EXPECTED_ENVIRONMENT",
      "  BETA_SMOKE_EMAIL              RC smoke identity",
      "  BETA_SMOKE_PASSWORD           RC smoke identity password",
      "  BETA_RC_SUPABASE_PROJECT_REF  Non-production Supabase project ref (mutating runs)",
      "  BETA_STORAGE_STATE_PATH       Path OUTSIDE the repository for session state",
      "",
      "See docs/testing/BETA_EVIDENCE.md for the full contract.",
    ].join("\n"),
  );
  process.exit(0);
}

const requestedViewport = flagValue("viewport");
if (requestedViewport && !VIEWPORTS.some((viewport) => viewport.name === requestedViewport)) {
  console.error(
    `--viewport must be one of ${VIEWPORTS.map((viewport) => viewport.name).join(", ")}; received "${requestedViewport}".`,
  );
  process.exit(2);
}
const viewports = requestedViewport
  ? VIEWPORTS.filter((viewport) => viewport.name === requestedViewport)
  : VIEWPORTS;

const runId = process.env.BETA_RUN_ID || `local-${Date.now()}`;
const storageStatePath =
  process.env.BETA_STORAGE_STATE_PATH || path.join("/tmp", `tradeos-beta-storage-state-${runId}.json`);

const baseEnv = {
  ...process.env,
  BETA_RUN_ID: runId,
  BETA_STORAGE_STATE_PATH: storageStatePath,
  BETA_ALLOW_MUTATIONS: process.env.BETA_ALLOW_MUTATIONS ?? "true",
  BETA_STARTED_AT: process.env.BETA_STARTED_AT ?? new Date().toISOString(),
  ...(hasFlag("headed") ? { PWDEBUG: "0", BETA_HEADED: "true" } : {}),
};

function runStep(label, script, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n--- ${label} ---`);
    const child = spawn(process.execPath, [path.join(here, script)], {
      stdio: "inherit",
      env: { ...baseEnv, ...extraEnv },
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${label} failed (exit ${code}). Phase: ${label}.`));
    });
  });
}

try {
  await runStep("resolve RC target", "resolve-rc-target.mjs");

  // resolve-rc-target.mjs is the single source of truth for the URL; re-read it
  // rather than trusting the raw input a second time.
  const fs = await import("node:fs/promises");
  const outDir = process.env.BETA_EVIDENCE_DIR || "../artifacts/beta-evidence";
  const target = JSON.parse(await fs.readFile(path.join(outDir, "rc-target.json"), "utf8"));
  baseEnv.BETA_RC_BASE_URL_RESOLVED = target.baseUrl;

  await runStep("authenticate and bootstrap storage state", "auth-setup.mjs");

  for (const viewport of viewports) {
    await runStep(`capture evidence at ${viewport.width}px`, "capture-evidence.mjs", {
      BETA_VIEWPORT: viewport.name,
    });
  }

  if (!hasFlag("skip-isolation")) {
    await runStep("tenant isolation probe", "tenant-isolation.mjs");
  }

  await runStep("validate artifacts and write metadata", "validate-artifacts.mjs", {
    // A targeted run validates only what it captured; the validator reports
    // PARTIAL rather than PASS in that case.
    BETA_VALIDATE_VIEWPORTS: viewports.map((viewport) => viewport.name).join(","),
  });
  console.log("\nBeta evidence run complete.");
} catch (error) {
  console.error(`\nBeta evidence run FAILED: ${error.message}`);
  process.exit(1);
} finally {
  // Never leave a reusable session lying around after a local run.
  if (!process.env.BETA_KEEP_STORAGE_STATE) {
    const fs = await import("node:fs/promises");
    await fs.rm(storageStatePath, { force: true }).catch(() => {});
  }
}
