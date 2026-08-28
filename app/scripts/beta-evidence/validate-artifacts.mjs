// Phase 21/22/29 — prove the evidence bundle is real, then write the metadata
// artifact and the Actions summary.
//
// Uploading an artifact is not proof the artifact is valid: this step reads
// every screenshot off disk, checks it is a non-empty PNG, and verifies its
// intrinsic pixel width matches the viewport it claims to represent.

import fs from "node:fs/promises";
import path from "node:path";
import {
  VIEWPORTS,
  readPngDimensions,
  validateEvidenceSet,
} from "./lib/evidence-artifacts.mjs";

const outDir = process.env.BETA_EVIDENCE_DIR || "../artifacts/beta-evidence";
const summaryPath = process.env.GITHUB_STEP_SUMMARY;

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function collectScreenshots() {
  const captured = [];
  for (const viewport of VIEWPORTS) {
    const dir = path.join(outDir, viewport.name, "screenshots");
    let entries;
    try {
      entries = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith(".png")) continue;
      const filePath = path.join(dir, entry);
      const [stat, buffer] = await Promise.all([fs.stat(filePath), fs.readFile(filePath)]);
      const dimensions = readPngDimensions(buffer);
      captured.push({
        file: entry,
        bytes: stat.size,
        width: dimensions?.width ?? -1,
        height: dimensions?.height ?? -1,
      });
    }
  }
  return captured;
}

const target = await readJsonIfPresent(path.join(outDir, "rc-target.json"));
const auth = await readJsonIfPresent(path.join(outDir, "auth-setup-report.json"));
const isolation = await readJsonIfPresent(path.join(outDir, "tenant-isolation-report.json"));

const viewportReports = {};
for (const viewport of VIEWPORTS) {
  viewportReports[viewport.name] = await readJsonIfPresent(
    path.join(outDir, viewport.name, "capture-report.json"),
  );
}

const captured = await collectScreenshots();
const validation = validateEvidenceSet(captured);

const viewportResult = (name) => {
  const report = viewportReports[name];
  if (!report) return "FAIL";
  return report.result === "PASS" ? "PASS" : "FAIL";
};

const authResult = auth?.result === "PASS" ? "PASS" : "FAIL";
const isolationResult = isolation?.result === "PASS" ? "PASS" : "FAIL";
const artifactResult = validation.ok ? "PASS" : "FAIL";

const downstreamReported = VIEWPORTS.some((viewport) =>
  (viewportReports[viewport.name]?.checkpoints ?? []).some((checkpoint) => checkpoint.name === "downstream-state"),
);

const allViewportsPass = VIEWPORTS.every((viewport) => viewportResult(viewport.name) === "PASS");
const overall =
  authResult === "PASS" && isolationResult === "PASS" && artifactResult === "PASS" && allViewportsPass
    ? "PASS"
    : "FAIL";

// Phase 21 — machine-readable metadata. Carries no passwords, tokens, cookies,
// or storage state.
const metadata = {
  repository: process.env.GITHUB_REPOSITORY ?? "404TradeOS-LLC/TradeOS",
  commitSha: process.env.GITHUB_SHA ?? null,
  branch: process.env.GITHUB_REF_NAME ?? null,
  previewUrl: target?.baseUrl ?? null,
  environment: target?.environment ?? null,
  deploymentCommitSha: target?.deploymentCommitSha ?? null,
  shaCorrelated: target?.shaCorrelated ?? false,
  workflow: process.env.GITHUB_WORKFLOW ?? "Beta Evidence",
  runId: process.env.GITHUB_RUN_ID ?? null,
  smokeTenant: process.env.BETA_SMOKE_TENANT_LABEL ?? null,
  viewports: VIEWPORTS.map((viewport) => viewport.width),
  startedAt: process.env.BETA_STARTED_AT ?? null,
  completedAt: new Date().toISOString(),
  results: {
    authentication: authResult,
    tenantIsolation: isolationResult,
    artifacts: artifactResult,
    viewports: Object.fromEntries(VIEWPORTS.map((viewport) => [viewport.width, viewportResult(viewport.name)])),
  },
  screenshotCount: captured.length,
  artifactFailures: validation.failures,
  result: overall,
};

await fs.writeFile(path.join(outDir, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);

// Phase 29 — Actions summary. No secrets.
const rows = [
  ["Repository", metadata.repository],
  ["Commit", metadata.commitSha ?? "unknown"],
  ["Branch", metadata.branch ?? "unknown"],
  ["RC URL", metadata.previewUrl ?? "UNRESOLVED"],
  ["Environment", metadata.environment ?? "UNRESOLVED"],
  ["Deployment SHA correlated", metadata.shaCorrelated ? "YES" : "NO"],
  ["Smoke tenant", metadata.smokeTenant ?? "unset"],
  ["Authentication", authResult],
  ["Tenant isolation", isolationResult],
  ["1440", viewportResult("1440")],
  ["1024", viewportResult("1024")],
  ["768", viewportResult("768")],
  ["390", viewportResult("390")],
  ["Downstream workflow", downstreamReported ? "PASS" : "N/A"],
  ["Artifact validation", artifactResult],
  ["Overall", overall],
];

const summary = [
  "# TradeOS Beta Evidence",
  "",
  "| Check | Result |",
  "| --- | --- |",
  ...rows.map(([label, value]) => `| ${label} | ${value} |`),
  "",
];

if (!validation.ok) {
  summary.push("## Artifact validation failures", "");
  for (const item of validation.failures) {
    summary.push(`- \`${item.file}\` — ${item.code}: ${item.detail}`);
  }
  summary.push("");
}

const summaryText = `${summary.join("\n")}\n`;
if (summaryPath) await fs.appendFile(summaryPath, summaryText);
console.log(summaryText);

if (overall !== "PASS") {
  console.error("::error::[validate-artifacts] Beta evidence is NOT complete. See the summary table above.");
  process.exit(1);
}
