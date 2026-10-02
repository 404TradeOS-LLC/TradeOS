import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";

const TEAM_ID = "team_nY1VrcaEYEr4rcW7Gxweq7LP";
const FRONTEND_PROJECT_ID = "prj_jDyORkIa7ug3ZtgtNujwEa65hQ36";
const BACKEND_PROJECT_ID = "prj_BVJxF6rnO90wMdNjZ1Yn4QO1aGwD";
const SOURCE_BRANCH = "staging";
const TARGET_BRANCH = "ops/staging-sync-s053-desktop-20261002";
const EXPECTED_SHA = "596427ce0c1e6206892cf8eabc0797561ecd45cc";
const STAGING_REF = "qfbgdkbamfaasmtjfyru";
const PRODUCTION_REF = "kssaceuetdjwfqnbzhly";
const STAGING_SUPABASE_URL = "https://qfbgdkbamfaasmtjfyru.supabase.co";
const BACKEND_SOURCE_DEPLOYMENT = "https://tradeos-costbook-kx0zbpg2q-billykshowalters.vercel.app";
const FRONTEND_SOURCE_DEPLOYMENT = "https://tradeos-costbook-89hfag41t-billykshowalters.vercel.app";
const SOURCE_ENV_PATH = "/tmp/s053-source-backend.env";
const STATE_PATH = "/tmp/s053-preview-pair-state.json";
const REPORT_PATH = "../artifacts/s053-browser-evidence/preview-pair.json";
const token = process.env.VERCEL_TOKEN?.trim();

assert.ok(token, "VERCEL_TOKEN is required");
const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };

function runVercel(args, projectId) {
  const result = spawnSync("vercel", args, {
    env: { ...process.env, VERCEL_ORG_ID: TEAM_ID, VERCEL_PROJECT_ID: projectId },
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error("vercel " + args[0] + " failed");
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (!response.ok) {
    throw new Error((init.method || "GET") + " " + url + " failed: " + response.status);
  }
  return body;
}

async function branchEnv(projectId) {
  const url = new URL("https://api.vercel.com/v10/projects/" + projectId + "/env");
  url.searchParams.set("teamId", TEAM_ID);
  url.searchParams.set("gitBranch", TARGET_BRANCH);
  const payload = await fetchJson(url);
  return payload.envs ?? payload;
}

async function assertManagedEnvAbsent(projectId, keys, label) {
  const envs = await branchEnv(projectId);
  const existing = envs.filter((env) => keys.includes(env.key));
  assert.equal(
    existing.length,
    0,
    label + " already has managed S053 branch overrides; refusing to overwrite: " +
      existing.map((env) => env.key).join(", ")
  );
}

async function upsertEnv(projectId, key, value, type) {
  assert.equal(typeof value, "string", key + " value must be a string");
  assert.ok(value.length > 0, key + " value must not be empty");
  const url = new URL("https://api.vercel.com/v10/projects/" + projectId + "/env");
  url.searchParams.set("teamId", TEAM_ID);
  url.searchParams.set("upsert", "true");
  const payload = await fetchJson(url, {
    method: "POST",
    body: JSON.stringify({
      key,
      value,
      type,
      target: ["preview"],
      gitBranch: TARGET_BRANCH,
      comment: "Temporary S053 authenticated browser evidence; remove after run",
    }),
  });
  const created = payload.created ?? payload;
  const row = Array.isArray(created) ? created.find((entry) => entry?.key === key) : created;
  assert.ok(row?.id, "Vercel did not return an environment id for " + key);
  return row.id;
}

async function saveState(state) {
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), { mode: 0o600 });
}

async function waitForDeployment(projectId, sinceMs) {
  const deadline = Date.now() + 12 * 60_000;
  let last = null;
  while (Date.now() < deadline) {
    const url = new URL("https://api.vercel.com/v6/deployments");
    url.searchParams.set("teamId", TEAM_ID);
    url.searchParams.set("projectId", projectId);
    url.searchParams.set("limit", "30");
    url.searchParams.set("since", String(sinceMs));
    const payload = await fetchJson(url);
    const deployments = payload.deployments ?? [];
    const matches = deployments.filter((deployment) =>
      deployment.meta?.githubCommitRef === TARGET_BRANCH &&
      deployment.meta?.githubCommitSha === EXPECTED_SHA &&
      Number(deployment.created ?? deployment.createdAt ?? 0) >= sinceMs
    );
    if (matches.length > 0) {
      last = [...matches].sort(
        (a, b) => Number(b.created ?? b.createdAt ?? 0) - Number(a.created ?? a.createdAt ?? 0)
      )[0];
      const state = last.state ?? last.readyState;
      if (state === "READY") return last;
      if (state === "ERROR" || state === "CANCELED") {
        throw new Error("S053 redeploy entered terminal state " + state + " for project " + projectId);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error("Timed out waiting for exact S053 deployment on " + projectId);
}

async function verifyBackend(baseUrl) {
  const health = await fetch(new URL("/health", baseUrl), { signal: AbortSignal.timeout(30000) });
  assert.equal(health.status, 200, "S053 backend /health must return 200");
  const healthBody = await health.json();
  assert.equal(healthBody.commitSha, EXPECTED_SHA, "S053 backend /health commit SHA mismatch");

  const ready = await fetch(new URL("/ready", baseUrl), { signal: AbortSignal.timeout(30000) });
  assert.equal(ready.status, 200, "S053 backend /ready must return 200");
  const readyBody = await ready.json();
  assert.equal(readyBody.status, "ready", "S053 backend must report ready");
  assert.equal(readyBody.checks?.database?.status, "ok", "S053 backend database readiness must be ok");
  assert.equal(readyBody.checks?.schema?.status, "ok", "S053 backend schema readiness must be ok");

  const bootstrap = await fetch(new URL("/api/v1/auth/bootstrap", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(bootstrap.status, 401, "Unauthenticated S053 backend bootstrap must fail with 401");
}

async function setup() {
  const state = { backendEnvIds: [], frontendEnvIds: [], createdAt: new Date().toISOString() };
  await saveState(state);
  await fs.mkdir("../artifacts/s053-browser-evidence", { recursive: true });

  await assertManagedEnvAbsent(
    BACKEND_PROJECT_ID,
    ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_JWT_AUDIENCE", "TRUST_PROXY", "AI_ESTIMATOR_REVIEW_TOKEN_SECRET"],
    "S053 backend branch"
  );
  await assertManagedEnvAbsent(FRONTEND_PROJECT_ID, ["BACKEND_API_URL"], "S053 frontend branch");

  runVercel(
    ["env", "pull", SOURCE_ENV_PATH, "--environment=preview", "--git-branch=" + SOURCE_BRANCH, "--yes", "--token=" + token],
    BACKEND_PROJECT_ID
  );
  const sourceEnv = dotenv.parse(await fs.readFile(SOURCE_ENV_PATH, "utf8"));
  await fs.rm(SOURCE_ENV_PATH, { force: true });

  assert.equal(sourceEnv.SUPABASE_URL, STAGING_SUPABASE_URL, "Source backend is not pinned to TradeOS Staging Supabase");
  assert.ok(sourceEnv.DATABASE_URL, "Healthy staging source is missing DATABASE_URL");
  assert.ok(sourceEnv.DATABASE_URL.includes(STAGING_REF), "Source DATABASE_URL does not identify TradeOS Staging");
  assert.ok(!sourceEnv.DATABASE_URL.includes(PRODUCTION_REF), "Source DATABASE_URL references Production");
  assert.ok(
    !Object.values(sourceEnv).some((value) => typeof value === "string" && value.includes(PRODUCTION_REF)),
    "Source backend environment references Production Supabase"
  );

  const backendVariables = [
    ["DATABASE_URL", sourceEnv.DATABASE_URL, "sensitive"],
    ["SUPABASE_URL", STAGING_SUPABASE_URL, "plain"],
    ["TRUST_PROXY", "1", "plain"],
    ["AI_ESTIMATOR_REVIEW_TOKEN_SECRET", crypto.randomBytes(48).toString("hex"), "sensitive"],
  ];
  if (sourceEnv.SUPABASE_JWT_AUDIENCE) {
    backendVariables.push(["SUPABASE_JWT_AUDIENCE", sourceEnv.SUPABASE_JWT_AUDIENCE, "plain"]);
  }

  for (const [key, value, type] of backendVariables) {
    const id = await upsertEnv(BACKEND_PROJECT_ID, key, value, type);
    state.backendEnvIds.push(id);
    await saveState(state);
  }

  const backendSince = Date.now() - 2000;
  runVercel(["redeploy", BACKEND_SOURCE_DEPLOYMENT, "--token=" + token], BACKEND_PROJECT_ID);
  const backendDeployment = await waitForDeployment(BACKEND_PROJECT_ID, backendSince);
  const backendUrl = "https://" + backendDeployment.url;
  await verifyBackend(backendUrl);

  const frontendEnvId = await upsertEnv(FRONTEND_PROJECT_ID, "BACKEND_API_URL", backendUrl, "sensitive");
  state.frontendEnvIds.push(frontendEnvId);
  await saveState(state);

  const frontendSince = Date.now() - 2000;
  runVercel(["redeploy", FRONTEND_SOURCE_DEPLOYMENT, "--token=" + token], FRONTEND_PROJECT_ID);
  const frontendDeployment = await waitForDeployment(FRONTEND_PROJECT_ID, frontendSince);
  const frontendUrl = "https://" + frontendDeployment.url;

  state.backendDeploymentId = backendDeployment.id;
  state.backendUrl = backendUrl;
  state.frontendDeploymentId = frontendDeployment.id;
  state.frontendUrl = frontendUrl;
  await saveState(state);

  await fs.writeFile(
    REPORT_PATH,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      expectedSha: EXPECTED_SHA,
      targetBranch: TARGET_BRANCH,
      dataPlane: "TradeOS Staging",
      backend: { deploymentId: backendDeployment.id, url: backendUrl },
      frontend: { deploymentId: frontendDeployment.id, url: frontendUrl },
    }, null, 2)
  );

  assert.ok(process.env.GITHUB_ENV, "GITHUB_ENV is required");
  await fs.appendFile(
    process.env.GITHUB_ENV,
    "S053_BASE_URL=" + frontendUrl + "\n" +
    "S027_BASE_URL=" + frontendUrl + "\n" +
    "BETA_RC_BASE_URL_RESOLVED=" + frontendUrl + "\n"
  );

  console.log(
    "Prepared exact S053 Preview pair: frontend=" + frontendDeployment.id +
    ", backend=" + backendDeployment.id
  );
}

async function cleanup() {
  let state;
  try {
    state = JSON.parse(await fs.readFile(STATE_PATH, "utf8"));
  } catch {
    console.log("No S053 Preview-pair state file; nothing to clean.");
    return;
  }

  const removals = [
    ...(state.backendEnvIds ?? []).map((id) => [BACKEND_PROJECT_ID, id]),
    ...(state.frontendEnvIds ?? []).map((id) => [FRONTEND_PROJECT_ID, id]),
  ];
  const failures = [];

  for (const [projectId, id] of removals) {
    const url = new URL("https://api.vercel.com/v9/projects/" + projectId + "/env/" + id);
    url.searchParams.set("teamId", TEAM_ID);
    try {
      await fetchJson(url, { method: "DELETE" });
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  await fs.rm(SOURCE_ENV_PATH, { force: true });
  if (failures.length > 0) {
    throw new Error("S053 temporary Preview env cleanup failed: " + failures.join(" | "));
  }
  console.log("Removed " + removals.length + " temporary S053 branch-scoped Preview environment overrides.");
}

if (process.argv.includes("--cleanup")) await cleanup();
else await setup();
