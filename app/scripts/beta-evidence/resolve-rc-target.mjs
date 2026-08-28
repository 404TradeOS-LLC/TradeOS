// Phase 2/3/44 — resolve and prove the beta-evidence target before anything
// touches it.
//
// Writes a machine-readable rc-target.json that every later step reads, so the
// URL is decided exactly once and never re-guessed mid-run.

import fs from "node:fs/promises";
import path from "node:path";
import {
  assertApprovedRcUrl,
  assertDeploymentSha,
  assertEnvironmentIdentity,
  assertNonProductionDataPlane,
  resolveRcBaseUrl,
  RcTargetError,
} from "./lib/rc-target.mjs";

const outDir = process.env.BETA_EVIDENCE_DIR || "../artifacts/beta-evidence";

function fatal(phase, error) {
  const code = error instanceof RcTargetError ? error.code : "UNEXPECTED";
  console.error(`::error::[${phase}] ${error.message}`);
  console.error(`::error::failure-code=${code}`);
  process.exitCode = 1;
  return code;
}

async function main() {
  const expectedEnvironment = process.env.BETA_EXPECTED_ENVIRONMENT;
  const actualEnvironment = process.env.BETA_ACTUAL_ENVIRONMENT;
  const allowMutations = process.env.BETA_ALLOW_MUTATIONS === "true";

  await fs.mkdir(outDir, { recursive: true });

  // 1. Environment identity — expected vs actual must agree before anything else.
  const environment = assertEnvironmentIdentity(expectedEnvironment, actualEnvironment);

  // 2. Deterministic URL resolution across the supported sources.
  const { url, source } = resolveRcBaseUrl([
    { source: "workflow_input", value: process.env.BETA_RC_BASE_URL },
    { source: "repository_variable", value: process.env.BETA_RC_BASE_URL_VARIABLE },
    { source: "deployment_metadata", value: process.env.BETA_RC_DEPLOYMENT_URL },
  ]);

  // 3. The resolved URL must be an approved non-production host.
  const parsed = assertApprovedRcUrl(url);

  // 4. Mutating evidence additionally requires a proven non-production data plane.
  let supabaseRef = null;
  if (allowMutations) {
    supabaseRef = assertNonProductionDataPlane(process.env.BETA_RC_SUPABASE_PROJECT_REF);
  }

  // 5. Correlate the deployment with the commit it should have been built from.
  let deploymentSha = null;
  const expectedSha = process.env.BETA_EXPECTED_SHA;
  const reportedSha = process.env.BETA_RC_DEPLOYMENT_SHA;
  if (process.env.BETA_REQUIRE_SHA_CORRELATION === "true") {
    deploymentSha = assertDeploymentSha(expectedSha, reportedSha);
  } else if (expectedSha && reportedSha) {
    deploymentSha = assertDeploymentSha(expectedSha, reportedSha);
  }

  const target = {
    resolvedAt: new Date().toISOString(),
    baseUrl: parsed.origin,
    resolutionSource: source,
    environment,
    mutationsAllowed: allowMutations,
    // Ref is a project identifier, not a credential; recording it is what makes
    // the isolation claim auditable after the fact.
    dataPlaneRef: supabaseRef,
    expectedCommitSha: expectedSha ?? null,
    deploymentCommitSha: deploymentSha,
    shaCorrelated: deploymentSha !== null,
  };

  const targetPath = path.join(outDir, "rc-target.json");
  await fs.writeFile(targetPath, `${JSON.stringify(target, null, 2)}\n`);

  console.log(`Resolved RC target: ${target.baseUrl} (source: ${source}, environment: ${environment})`);
  console.log(`SHA correlation: ${target.shaCorrelated ? `${deploymentSha} matches expected` : "not asserted"}`);
  console.log(`Mutations allowed: ${allowMutations}`);
  return target;
}

try {
  await main();
} catch (error) {
  fatal("resolve-rc-target", error);
}
