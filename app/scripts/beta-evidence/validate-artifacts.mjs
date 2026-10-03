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
  screenshotFileName,
  selectViewports,
  validateEvidenceSet,
} from "./lib/evidence-artifacts.mjs";

const outDir = process.env.BETA_EVIDENCE_DIR || "../artifacts/beta-evidence";
const summaryPath = process.env.GITHUB_STEP_SUMMARY;
const scenario = process.env.BETA_SCENARIO || "canonical";

// A targeted single-viewport run validates only what it captured. It is a
// debugging aid, never a release gate, so its verdict is PARTIAL rather than
// PASS no matter how clean it is.
const requestedViewports = (process.env.BETA_VALIDATE_VIEWPORTS || "")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);
const viewports = selectViewports(requestedViewports);
const isFullMatrix = viewports.length === VIEWPORTS.length;
const expectedRunId = process.env.BETA_RUN_ID || null;

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function collectScreenshots() {
  const captured = [];
  for (const viewport of viewports) {
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
const s052RoleEvidence = await readJsonIfPresent(path.join(outDir, "s052-role-report.json"));

const viewportReports = {};
for (const viewport of viewports) {
  viewportReports[viewport.name] = await readJsonIfPresent(
    path.join(outDir, viewport.name, "capture-report.json"),
  );
}

const captured = await collectScreenshots();
const validation = validateEvidenceSet(captured, { viewports });

// A report left over from an earlier run must not be counted as this run's
// evidence. A report carrying no run id at all is equally untrustworthy once a
// run id is expected, so absence is treated as stale rather than waved through.
const staleViewports = [];
for (const viewport of viewports) {
  const report = viewportReports[viewport.name];
  if (!report) continue;
  if (expectedRunId && report.runId !== expectedRunId) {
    staleViewports.push(viewport.name);
  }
}

const viewportResult = (name) => {
  const report = viewportReports[name];
  if (!report) return "FAIL";
  if (staleViewports.includes(name)) return "STALE";
  return report.result === "PASS" ? "PASS" : "FAIL";
};

const authResult = auth?.result === "PASS" ? "PASS" : "FAIL";
const isolationResult = isolation?.result === "PASS" ? "PASS" : "FAIL";
const artifactResult = validation.ok ? "PASS" : "FAIL";

const scenarioFailures = [];
if (scenario === "s053") {
  if (target?.shaCorrelated !== true) {
    scenarioFailures.push("deployment identity: S053 certification requires exact SHA correlation");
  }
  for (const probeName of ["foreign S053 Athena draft", "foreign S053 Athena apply"]) {
    const probe = (isolation?.probes ?? []).find((entry) => entry.name === probeName);
    if (!probe?.passed) {
      scenarioFailures.push(`tenant isolation: ${probeName} denial was not proven`);
    }
  }

  const capturedByName = new Map(captured.map((entry) => [entry.file, entry]));
  const scenarioScreenshots = [
    ["03a", "s053-setup-required"],
    ["03b", "s053-athena-review"],
    ["03c", "s053-athena-applied"],
  ];

  for (const viewport of viewports) {
    const report = viewportReports[viewport.name];
    for (const [sequence, checkpointName] of scenarioScreenshots) {
      const file = screenshotFileName(viewport.name, sequence, checkpointName);
      const actual = capturedByName.get(file);
      if (!actual) {
        scenarioFailures.push(`${viewport.name}: missing scenario screenshot ${file}`);
      } else if (!Number.isFinite(actual.bytes) || actual.bytes <= 0) {
        scenarioFailures.push(`${viewport.name}: empty scenario screenshot ${file}`);
      } else if (actual.width !== viewport.width) {
        scenarioFailures.push(`${viewport.name}: scenario screenshot ${file} has width ${actual.width}, expected ${viewport.width}`);
      }
    }
    const checkpointNames = new Set((report?.checkpoints ?? []).map((checkpoint) => checkpoint.name));
    for (const requiredName of ["s053-setup-required", "s053-athena-review", "s053-athena-applied"]) {
      if (!checkpointNames.has(requiredName)) {
        scenarioFailures.push(`${viewport.name}: missing ${requiredName}`);
      }
    }
    const assertionNames = new Set((report?.assertions ?? []).filter((entry) => entry.passed).map((entry) => entry.name));
    for (const requiredAssertion of [
      "unmapped Athena scope fails safe as setup required",
      "setup-required Athena draft does not write estimate lines",
      "setup-required Athena draft cannot be applied",
      "Athena generation and local acceptance do not silently write estimate lines",
      "explicit Athena apply persists at least one reviewed estimate line",
      "pricing refreshes after the reviewed Athena apply",
      "reviewed Athena lines survive builder reload",
    ]) {
      if (!assertionNames.has(requiredAssertion)) {
        scenarioFailures.push(`${viewport.name}: missing passing assertion "${requiredAssertion}"`);
      }
    }
  }
}
if (scenario === "s052") {
  if (target?.shaCorrelated !== true) {
    scenarioFailures.push("deployment identity: S052 certification requires exact SHA correlation");
  }

  for (const probeName of ["foreign customer", "foreign project"]) {
    const probe = (isolation?.probes ?? []).find((entry) => entry.name === probeName);
    if (!probe?.passed) {
      scenarioFailures.push(`tenant isolation: ${probeName} denial was not proven`);
    }
  }

  if (s052RoleEvidence?.result !== "PASS") {
    scenarioFailures.push("role evidence: S052 admin/inactive-membership report did not pass");
  }
  if (expectedRunId && s052RoleEvidence?.runId !== expectedRunId) {
    scenarioFailures.push("role evidence: S052 role report is stale or belongs to another run");
  }
  if (s052RoleEvidence?.inactiveMembership?.passed !== true) {
    scenarioFailures.push("role evidence: inactive-membership denial was not proven");
  }
  for (const requiredAdminViewport of ["1440", "768", "390"]) {
    if (!(s052RoleEvidence?.admin ?? []).some((entry) => entry.viewport === requiredAdminViewport && entry.passed === true && entry.role === "admin")) {
      scenarioFailures.push(`role evidence: admin happy path missing for ${requiredAdminViewport}px`);
    }
  }

  const capturedByName = new Map(captured.map((entry) => [entry.file, entry]));
  const ownerRequiredViewports = viewports.filter((viewport) => ["1440", "768", "390"].includes(viewport.name));
  const ownerScreenshots = [
    ["02a", "s052-customer-created"],
    ["02b", "s052-customer-service-address"],
    ["02c", "s052-project-reloaded"],
  ];
  const ownerAssertions = [
    "customer creation opens the server-created customer workspace",
    "customer update persists through reload",
    "service address persists through customer reload",
    "duplicate advice points to the existing customer without silently merging",
    "required customer validation blocks blank name before mutation",
    "project persists the selected customer",
    "project persists the jobsite address",
    "project persists plain-language scope",
    "customer project fields survive workspace reload",
  ];

  for (const viewport of ownerRequiredViewports) {
    const report = viewportReports[viewport.name];
    for (const [sequence, checkpointName] of ownerScreenshots) {
      const file = screenshotFileName(viewport.name, sequence, checkpointName);
      const actual = capturedByName.get(file);
      if (!actual) {
        scenarioFailures.push(`${viewport.name}: missing S052 scenario screenshot ${file}`);
      } else if (!Number.isFinite(actual.bytes) || actual.bytes <= 0) {
        scenarioFailures.push(`${viewport.name}: empty S052 scenario screenshot ${file}`);
      } else if (actual.width !== viewport.width) {
        scenarioFailures.push(`${viewport.name}: S052 scenario screenshot ${file} has width ${actual.width}, expected ${viewport.width}`);
      }
    }

    const checkpointNames = new Set((report?.checkpoints ?? []).map((checkpoint) => checkpoint.name));
    for (const requiredName of ownerScreenshots.map(([, name]) => name)) {
      if (!checkpointNames.has(requiredName)) {
        scenarioFailures.push(`${viewport.name}: missing ${requiredName}`);
      }
    }

    const assertionNames = new Set((report?.assertions ?? []).filter((entry) => entry.passed).map((entry) => entry.name));
    for (const requiredAssertion of ownerAssertions) {
      if (!assertionNames.has(requiredAssertion)) {
        scenarioFailures.push(`${viewport.name}: missing passing assertion "${requiredAssertion}"`);
      }
    }
  }

  if (isFullMatrix) {
    for (const requiredAdminViewport of ["1440", "768", "390"]) {
      const viewport = VIEWPORTS.find((entry) => entry.name === requiredAdminViewport);
      const file = screenshotFileName(requiredAdminViewport, "02d", "s052-admin");
      const actual = capturedByName.get(file);
      if (!actual) {
        scenarioFailures.push(`${requiredAdminViewport}: missing S052 admin screenshot ${file}`);
      } else if (!Number.isFinite(actual.bytes) || actual.bytes <= 0) {
        scenarioFailures.push(`${requiredAdminViewport}: empty S052 admin screenshot ${file}`);
      } else if (actual.width !== viewport?.width) {
        scenarioFailures.push(`${requiredAdminViewport}: S052 admin screenshot ${file} has width ${actual.width}, expected ${viewport?.width}`);
      }
    }
  }
}

const scenarioResult = scenarioFailures.length === 0 ? "PASS" : "FAIL";

const downstreamReported = viewports.some((viewport) =>
  (viewportReports[viewport.name]?.checkpoints ?? []).some((checkpoint) => checkpoint.name === "downstream-state"),
);

const allViewportsPass = viewports.every((viewport) => viewportResult(viewport.name) === "PASS");
const everythingClean =
  authResult === "PASS" && isolationResult === "PASS" && artifactResult === "PASS" && scenarioResult === "PASS" && allViewportsPass;
const overall = everythingClean ? (isFullMatrix ? "PASS" : "PARTIAL") : "FAIL";

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
  scenario,
  viewports: viewports.map((viewport) => viewport.width),
  fullViewportMatrix: isFullMatrix,
  staleViewports,
  startedAt: process.env.BETA_STARTED_AT ?? null,
  completedAt: new Date().toISOString(),
  results: {
    authentication: authResult,
    tenantIsolation: isolationResult,
    artifacts: artifactResult,
    scenario: scenarioResult,
    s052RoleEvidence: scenario === "s052" ? (s052RoleEvidence?.result ?? "FAIL") : null,
    viewports: Object.fromEntries(viewports.map((viewport) => [viewport.width, viewportResult(viewport.name)])),
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
  ["Scenario", scenario],
  ["Scenario evidence", scenarioResult],
  ["Authentication", authResult],
  ["Tenant isolation", isolationResult],
  ...VIEWPORTS.map((viewport) => [
    viewport.name,
    viewports.some((selected) => selected.name === viewport.name) ? viewportResult(viewport.name) : "NOT RUN",
  ]),
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

if (scenarioFailures.length > 0) {
  summary.push("## Scenario validation failures", "");
  for (const item of scenarioFailures) summary.push(`- ${item}`);
  summary.push("");
}

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

if (overall === "FAIL") {
  console.error("::error::[validate-artifacts] Beta evidence is NOT complete. See the summary table above.");
  process.exit(1);
}
if (overall === "PARTIAL") {
  console.log(
    "::notice::Partial run: only " +
      viewports.map((viewport) => `${viewport.width}px`).join(", ") +
      " were validated. This is not beta evidence.",
  );
}
