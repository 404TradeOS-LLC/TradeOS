import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { assertNonProductionDataPlane } from "./beta-evidence/lib/rc-target.mjs";
import { deploymentSupabaseProjectRef } from "./s027-evidence-contract.mjs";

const TEAM_ID = "team_nY1VrcaEYEr4rcW7Gxweq7LP";
const FRONTEND_PROJECT_ID = "prj_jDyORkIa7ug3ZtgtNujwEa65hQ36";
const BACKEND_PROJECT_ID = "prj_BVJxF6rnO90wMdNjZ1Yn4QO1aGwD";
const STAGING_SUPABASE_URL = "https://qfbgdkbamfaasmtjfyru.supabase.co";
const STATE_PATH = "/tmp/s053-preview-pair-state.json";
const REPORT_PATH = "../artifacts/beta-evidence/s053-preview-pair.json";
const MANAGED_COMMENT = "Temporary S053 current-main evidence; remove after run";
const STAGING_FIXTURE_MARKER = "tradeos-staging-fixture-v1";
const STAGING_FOREIGN_ESTIMATE_ID = "70000000-0000-4000-8000-000000000004";

const token = process.env.VERCEL_TOKEN?.trim();
const targetBranch = process.env.S053_TARGET_BRANCH?.trim();
const expectedSha = process.env.S053_EXPECTED_SHA?.trim();
const stagingSha = process.env.S053_STAGING_SHA?.trim();
const expectedSupabaseRef = assertNonProductionDataPlane(process.env.BETA_RC_SUPABASE_PROJECT_REF);

assert.ok(token, "VERCEL_TOKEN is required");
assert.ok(targetBranch, "S053_TARGET_BRANCH is required");
assert.match(expectedSha ?? "", /^[a-f0-9]{40}$/, "S053_EXPECTED_SHA must be a full commit SHA");
assert.match(stagingSha ?? "", /^[a-f0-9]{40}$/, "S053_STAGING_SHA must be a full commit SHA");

const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };

async function fetchJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (!response.ok) {
    throw new Error((init.method || "GET") + " " + url + " failed: " + response.status + " " + String(text).slice(0, 300));
  }
  return body;
}

async function branchEnv() {
  const url = new URL("https://api.vercel.com/v10/projects/" + FRONTEND_PROJECT_ID + "/env");
  url.searchParams.set("teamId", TEAM_ID);
  url.searchParams.set("decrypt", "true");
  const payload = await fetchJson(url);
  return payload.envs ?? payload;
}

async function deleteEnv(id) {
  const url = new URL("https://api.vercel.com/v9/projects/" + FRONTEND_PROJECT_ID + "/env/" + id);
  url.searchParams.set("teamId", TEAM_ID);
  await fetchJson(url, { method: "DELETE" });
}

async function clearManagedLeftovers() {
  const envs = await branchEnv();
  const scoped = envs.filter((env) =>
    env.gitBranch === targetBranch &&
    ["BACKEND_API_URL", "NEXT_PUBLIC_SUPABASE_URL"].includes(env.key)
  );
  for (const env of scoped) {
    assert.equal(env.comment, MANAGED_COMMENT, "Refusing to replace operator-owned " + env.key + " override on " + targetBranch);
    await deleteEnv(env.id);
  }
}

async function createEnv(key, value) {
  const url = new URL("https://api.vercel.com/v10/projects/" + FRONTEND_PROJECT_ID + "/env");
  url.searchParams.set("teamId", TEAM_ID);
  const payload = await fetchJson(url, {
    method: "POST",
    body: JSON.stringify({
      key,
      value,
      type: "plain",
      target: ["preview"],
      gitBranch: targetBranch,
      comment: MANAGED_COMMENT,
    }),
  });
  const created = payload.created ?? payload;
  const row = Array.isArray(created) ? created.find((entry) => entry?.key === key) : created;
  assert.ok(row?.id, "Vercel did not return an environment id for " + key);
  return row.id;
}

async function findCurrentStagingBackend() {
  const url = new URL("https://api.vercel.com/v6/deployments");
  url.searchParams.set("teamId", TEAM_ID);
  url.searchParams.set("projectId", BACKEND_PROJECT_ID);
  url.searchParams.set("limit", "100");
  const payload = await fetchJson(url);
  const matches = (payload.deployments ?? []).filter((deployment) =>
    deployment.meta?.githubCommitRef === "staging" &&
    deployment.meta?.githubCommitSha === stagingSha &&
    (deployment.state ?? deployment.readyState) === "READY"
  );
  assert.ok(matches.length > 0, "No READY backend Preview exists for the current staging SHA");
  const deployment = [...matches].sort(
    (a, b) => Number(b.created ?? b.createdAt ?? 0) - Number(a.created ?? a.createdAt ?? 0)
  )[0];
  assert.equal(deployment.projectId, BACKEND_PROJECT_ID, "Wrong backend Vercel project");
  assert.ok(deployment.target === null || deployment.target === "preview", "Production backend deployment refused");
  return "https://" + deployment.url;
}

async function verifyBackend() {
  const backendUrl = await findCurrentStagingBackend();
  const health = await fetch(new URL("/health", backendUrl), { signal: AbortSignal.timeout(30_000) });
  assert.equal(health.status, 200, "Current staging backend /health must return 200");
  const healthBody = await health.json();
  assert.equal(healthBody.commitSha, stagingSha, "Selected backend does not match current staging branch");

  const ready = await fetch(new URL("/ready", backendUrl), { signal: AbortSignal.timeout(30_000) });
  assert.equal(ready.status, 200, "Current staging backend /ready must return 200");
  const readyBody = await ready.json();
  assert.equal(readyBody.status, "ready", "Current staging backend must report ready");
  assert.equal(readyBody.checks?.database?.status, "ok", "Staging database readiness must be ok");
  assert.equal(readyBody.checks?.schema?.status, "ok", "Staging schema readiness must be ok");

  const bootstrap = await fetch(new URL("/api/v1/auth/bootstrap", backendUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(bootstrap.status, 401, "Unauthenticated staging bootstrap must fail with 401");

  const foreignFixture = await fetch(new URL("/api/v1/estimates/" + STAGING_FOREIGN_ESTIMATE_ID, backendUrl), {
    headers: { Authorization: "Bearer " + STAGING_FIXTURE_MARKER, Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(
    foreignFixture.status,
    200,
    "Staging foreign-estimate fixture must exist and be readable only through the dedicated staging fixture identity",
  );

  return backendUrl;
}

async function deployments() {
  const url = new URL("https://api.vercel.com/v6/deployments");
  url.searchParams.set("teamId", TEAM_ID);
  url.searchParams.set("projectId", FRONTEND_PROJECT_ID);
  url.searchParams.set("limit", "100");
  const payload = await fetchJson(url);
  return payload.deployments ?? [];
}

async function waitForDeployment({ since = 0 } = {}) {
  const deadline = Date.now() + 15 * 60_000;
  let last = null;
  while (Date.now() < deadline) {
    const rows = await deployments();
    const matches = rows.filter((deployment) =>
      deployment.meta?.githubCommitRef === targetBranch &&
      deployment.meta?.githubCommitSha === expectedSha &&
      Number(deployment.created ?? deployment.createdAt ?? 0) >= since
    );
    if (matches.length > 0) {
      last = [...matches].sort(
        (a, b) => Number(b.created ?? b.createdAt ?? 0) - Number(a.created ?? a.createdAt ?? 0)
      )[0];
      const state = last.state ?? last.readyState;
      if (state === "READY") return last;
      if (state === "ERROR" || state === "CANCELED") {
        throw new Error("S053 frontend deployment entered terminal state " + state);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error("Timed out waiting for exact S053 frontend deployment; last=" + JSON.stringify(last?.id ?? null));
}

function redeploy(deploymentUrl) {
  const result = spawnSync("vercel", ["redeploy", deploymentUrl, "--token=" + token], {
    env: {
      ...process.env,
      VERCEL_ORG_ID: TEAM_ID,
      VERCEL_PROJECT_ID: FRONTEND_PROJECT_ID,
    },
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error("vercel redeploy failed");
}

async function attestDeployment(deployment) {
  assert.equal(deployment.projectId, FRONTEND_PROJECT_ID, "Wrong frontend Vercel project");
  assert.ok(deployment.target === null || deployment.target === "preview", "Production deployment refused");
  assert.equal(deployment.meta?.githubCommitRef, targetBranch, "Preview branch mismatch");
  assert.equal(deployment.meta?.githubCommitSha, expectedSha, "Preview commit mismatch");
  const envs = await branchEnv();
  const deployedRef = deploymentSupabaseProjectRef(envs, targetBranch, deployment.createdAt ?? deployment.created);
  assertNonProductionDataPlane(deployedRef);
  assert.equal(deployedRef, expectedSupabaseRef, "Preview is not attested to the expected staging Supabase project");
  return deployedRef;
}

async function setup() {
  await fs.mkdir("../artifacts/beta-evidence", { recursive: true });
  await clearManagedLeftovers();
  const backendUrl = await verifyBackend();

  const initial = await waitForDeployment();
  const state = { frontendEnvIds: [], initialDeploymentId: initial.id, createdAt: new Date().toISOString() };
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), { mode: 0o600 });

  state.frontendEnvIds.push(await createEnv("BACKEND_API_URL", backendUrl));
  state.frontendEnvIds.push(await createEnv("NEXT_PUBLIC_SUPABASE_URL", STAGING_SUPABASE_URL));
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), { mode: 0o600 });

  const since = Date.now() - 2000;
  const sourceUrl = "https://" + initial.url;
  redeploy(sourceUrl);
  const deployment = await waitForDeployment({ since });
  const dataPlaneRef = await attestDeployment(deployment);
  const frontendUrl = "https://" + deployment.url;

  state.frontendDeploymentId = deployment.id;
  state.frontendUrl = frontendUrl;
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), { mode: 0o600 });

  await fs.writeFile(REPORT_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    expectedFrontendSha: expectedSha,
    frontendBranch: targetBranch,
    frontend: { deploymentId: deployment.id, url: frontendUrl },
    backend: { url: backendUrl, commitSha: stagingSha, readiness: "verified" },
    dataPlaneRef,
    foreignEstimateFixture: { id: STAGING_FOREIGN_ESTIMATE_ID, existenceVerifiedWithStagingFixtureIdentity: true },
  }, null, 2));

  assert.ok(process.env.GITHUB_ENV, "GITHUB_ENV is required");
  await fs.appendFile(
    process.env.GITHUB_ENV,
    "BETA_RC_BASE_URL=" + frontendUrl + "\n" +
    "BETA_RC_DEPLOYMENT_URL=" + frontendUrl + "\n" +
    "BETA_RC_DEPLOYMENT_SHA=" + expectedSha + "\n" +
    "BETA_EXPECTED_SHA=" + expectedSha + "\n" +
    "BETA_FOREIGN_ESTIMATE_ID=" + STAGING_FOREIGN_ESTIMATE_ID + "\n"
  );

  console.log("Prepared exact S053 Preview " + deployment.id + " for " + expectedSha);
}

async function cleanup() {
  let state;
  try {
    state = JSON.parse(await fs.readFile(STATE_PATH, "utf8"));
  } catch {
    console.log("No S053 Preview state file; checking for managed leftovers.");
    state = { frontendEnvIds: [] };
  }

  const failures = [];
  for (const id of state.frontendEnvIds ?? []) {
    try { await deleteEnv(id); } catch (error) { failures.push(error instanceof Error ? error.message : String(error)); }
  }
  if (failures.length > 0) throw new Error("S053 temporary Preview cleanup failed: " + failures.join(" | "));
  console.log("Removed " + (state.frontendEnvIds ?? []).length + " temporary S053 Preview overrides.");
}

if (process.argv.includes("--cleanup")) await cleanup();
else await setup();
