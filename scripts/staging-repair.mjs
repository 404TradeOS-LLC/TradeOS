import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

const TEAM_ID = "team_nY1VrcaEYEr4rcW7Gxweq7LP";
const PROJECT_ID = "prj_BVJxF6rnO90wMdNjZ1Yn4QO1aGwD";
const PROJECT_NAME = "tradeos-costbook";
// Public, deliberately invalid ES256 JWT: reaches Supabase issuer initialization
// without authenticating a user or carrying any credential.
export const INVALID_SUPABASE_PROBE_TOKEN = [
  { alg: "ES256", typ: "JWT" },
  { iss: "https://qfbgdkbamfaasmtjfyru.supabase.co/auth/v1", sub: "staging-repair-probe", aud: "authenticated", iat: 0, exp: 1 },
].map(value => Buffer.from(JSON.stringify(value)).toString("base64url")).join(".") + "." + Buffer.alloc(64).toString("base64url");

const REPORT_PATH = "artifacts/staging-repair/deployment.json";

/** Fail closed unless the deployment belongs to the captured staging commit and Preview boundary. */
export function assertStagingDeployment(d, expectedSha) {
  assert.match(expectedSha, /^[a-f0-9]{40}$/, "A full staging SHA is required");
  assert.equal(d.projectId ?? d.project?.id, PROJECT_ID, "Unexpected backend project");
  assert.equal(d.ownerId ?? d.team?.id, TEAM_ID, "Unexpected Vercel team");
  assert.equal(d.name, PROJECT_NAME, "Unexpected backend project name");
  assert.ok(d.target === null || d.target === "preview", "Deployment must be Preview");
  assert.equal(d.meta?.githubOrg, "404TradeOS-LLC", "Unexpected repository owner");
  assert.equal(d.meta?.githubRepo, "TradeOS", "Unexpected repository");
  assert.equal(d.meta?.githubCommitRef, "staging", "Deployment must use the staging branch");
  assert.equal(d.meta?.githubCommitSha, expectedSha, "Deployment does not match the captured staging SHA");
  assert.match(d.id, /^dpl_[A-Za-z0-9]+$/, "Deployment ID is required");
  assert.match(d.url, /^tradeos-costbook-[a-z0-9]+-billykshowalters\.vercel\.app$/, "An immutable backend Preview hostname is required");
  return d;
}

/** Select the newest READY Preview for the captured commit, independent of list ordering. */
export function selectStagingDeployment(deployments, expectedSha) {
  const matches = deployments.filter(d =>
    (d.state ?? d.readyState) === "READY" &&
    (d.target === null || d.target === "preview") &&
    d.meta?.githubCommitRef === "staging" && d.meta?.githubCommitSha === expectedSha &&
    d.meta?.githubOrg === "404TradeOS-LLC" && d.meta?.githubRepo === "TradeOS"
  );
  matches.sort((a, b) => Number(b.created ?? b.createdAt) - Number(a.created ?? a.createdAt));
  return matches[0] ?? null;
}

/** Replace the staging backend and retain identity evidence only after immutable runtime checks. */
export async function repairStagingBackend({ expectedSha, api, request = fetch,
  pause = ms => new Promise(resolve => setTimeout(resolve, ms)), record = async () => {} }) {
  assert.match(expectedSha, /^[a-f0-9]{40}$/, "A full staging SHA is required");
  const evidence = { expectedSha, branch: "staging", environment: "preview", status: "unverified" };
  await record(evidence);
  const query = new URLSearchParams({ projectId: PROJECT_ID, branch: "staging", sha: expectedSha, state: "READY", limit: "100" });
  const listing = await api("/v7/deployments?" + query);
  const source = selectStagingDeployment(listing.deployments ?? [], expectedSha);
  let payload = { name: PROJECT_NAME, project: PROJECT_ID };
  if (source) {
    const sourceId = source.id ?? source.uid;
    assert.match(sourceId, /^dpl_[A-Za-z0-9]+$/, "Source deployment ID is required");
    const details = assertStagingDeployment(await api("/v13/deployments/" + sourceId), expectedSha);
    assert.equal(details.readyState, "READY", "Source deployment is no longer READY");
    evidence.sourceDeploymentId = details.id;
    payload.deploymentId = details.id;
  } else {
    // Recover a deleted or skipped deployment without recycling an older commit.
    // Verify the captured SHA on the returned deployment before runtime probes.
    payload.gitSource = { type: "github", org: "404TradeOS-LLC", repo: "TradeOS", ref: "staging" };
    payload.projectSettings = { commandForIgnoringBuildStep: "exit 1" };
  }
  await record(evidence);
  const created = await api("/v13/deployments?forceNew=1", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  assert.match(created.id, /^dpl_[A-Za-z0-9]+$/, "Redeploy did not return a deployment ID");
  assert.notEqual(created.id, evidence.sourceDeploymentId, "Redeploy must return a new deployment");
  evidence.deploymentId = created.id;
  await record(evidence);
  let replacement;
  for (let attempt = 0; attempt < 120; attempt++) {
    replacement = assertStagingDeployment(await api("/v13/deployments/" + created.id), expectedSha);
    if (replacement.readyState === "READY") break;
    assert.ok(!["ERROR", "CANCELED"].includes(replacement.readyState), "Staging redeployment failed");
    await pause(5000);
  }
  assert.equal(replacement.readyState, "READY", "Timed out waiting for the replacement deployment");
  const baseUrl = "https://" + replacement.url;
  evidence.url = baseUrl;
  await record(evidence);
  const runtime = async (path, init = {}) => request(new URL(path, baseUrl), {
    ...init, redirect: "error", signal: AbortSignal.timeout(30000),
  });
  const health = await runtime("/health");
  assert.equal(health.status, 200, "Replacement /health did not return 200");
  const healthBody = await health.json();
  assert.equal(healthBody.status, "ok", "Replacement health is not ok");
  assert.equal(healthBody.commitSha, expectedSha, "Runtime /health SHA differs from the verified deployment");
  const ready = await runtime("/ready");
  assert.equal(ready.status, 200, "Replacement /ready did not return 200");
  const readyBody = await ready.json();
  assert.equal(readyBody.status, "ready", "Replacement is not database-ready");
  assert.equal(readyBody.checks?.database?.status, "ok", "Replacement database check failed");
  assert.equal(readyBody.checks?.schema?.status, "ok", "Replacement schema check failed");
  const auth = await runtime("/api/v1/auth/bootstrap", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + INVALID_SUPABASE_PROBE_TOKEN }, body: "{}",
  });
  assert.equal(auth.status, 401, "Invalid Supabase token bootstrap must return 401; check the staging auth issuer configuration");
  // Re-check the exact ID after runtime probes; a moving branch alias is never evidence.
  const final = assertStagingDeployment(await api("/v13/deployments/" + created.id), expectedSha);
  assert.equal(final.readyState, "READY", "Replacement state changed during verification");
  assert.equal(final.url, replacement.url, "Replacement hostname changed during verification");
  Object.assign(evidence, { status: "ready", database: "ok", schema: "ok", invalidSupabaseTokenBootstrap: 401 });
  await record(evidence);
  return evidence;
}

/** Run the guarded manual workflow without exposing API credentials in logs or artifacts. */
async function main() {
  assert.equal(process.env.REPAIR_CONFIRM, "REPAIR_STAGING_AUTH", "Explicit staging-only confirmation is required");
  const token = process.env.VERCEL_TOKEN;
  assert.ok(token, "VERCEL_TOKEN is required");
  const api = async (route, init = {}) => {
    const url = new URL(route, "https://api.vercel.com");
    url.searchParams.set("teamId", TEAM_ID);
    const response = await fetch(url, {
      ...init, redirect: "error", signal: AbortSignal.timeout(30000),
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    });
    // Do not expose API response bodies or environment values in errors/artifacts.
    assert.ok(response.ok, "Vercel staging repair request failed with HTTP " + response.status);
    return response.json();
  };
  const record = async evidence => {
    await fs.mkdir("artifacts/staging-repair", { recursive: true });
    await fs.writeFile(REPORT_PATH, JSON.stringify(evidence, null, 2) + "\n");
  };
  const result = await repairStagingBackend({ expectedSha: process.env.STAGING_EXPECTED_SHA, api, record });
  if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,
    `Staging backend READY: ${result.deploymentId} at ${result.url}, SHA ${result.expectedSha}. Database/schema checks passed; invalid Supabase token bootstrap returned 401 after issuer initialization. Authenticated browser certification is still required.\n`);
  console.log("Staging backend readiness verified: " + result.deploymentId);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error("Staging repair failed; no readiness certification: " + error.message.split("\n")[0]); process.exitCode = 1; });
}
