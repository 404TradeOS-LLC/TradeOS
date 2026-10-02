import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";

const TEAM_ID = "team_nY1VrcaEYEr4rcW7Gxweq7LP";
const FRONTEND_PROJECT_ID = "prj_jDyORkIa7ug3ZtgtNujwEa65hQ36";
const TARGET_BRANCH = "ops/staging-sync-s053-desktop-20261002";
const EXPECTED_SHA = "596427ce0c1e6206892cf8eabc0797561ecd45cc";
const BACKEND_EXPECTED_SHA = "a3fbafaaec3eac39e11f9f1908d40cd8e5b56c44";
const STAGING_SUPABASE_URL = "https://qfbgdkbamfaasmtjfyru.supabase.co";
const STABLE_BACKEND_URL = "https://tradeos-costbook-mong8jtyi-billykshowalters.vercel.app";
const FRONTEND_SOURCE_DEPLOYMENT = "https://tradeos-costbook-89hfag41t-billykshowalters.vercel.app";
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
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (!response.ok) throw new Error((init.method || "GET") + " " + url + " failed: " + response.status);
  return body;
}

async function branchEnv(projectId) {
  const url = new URL("https://api.vercel.com/v10/projects/" + projectId + "/env");
  url.searchParams.set("teamId", TEAM_ID);
  url.searchParams.set("gitBranch", TARGET_BRANCH);
  const payload = await fetchJson(url);
  return payload.envs ?? payload;
}

async function assertManagedEnvAbsent(projectId, keys) {
  const envs = await branchEnv(projectId);
  const existing = envs.filter((env) => keys.includes(env.key));
  assert.equal(
    existing.length,
    0,
    "S053 frontend branch already has managed overrides; refusing to overwrite: " +
      existing.map((env) => env.key).join(", ")
  );
}

async function upsertEnv(projectId, key, value, type = "plain") {
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
        throw new Error("S053 frontend redeploy entered terminal state " + state);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error("Timed out waiting for exact S053 frontend deployment");
}

async function verifyBackend() {
  assert.match(STABLE_BACKEND_URL, /^https:\/\/tradeos-costbook-[a-z0-9]+-billykshowalters\.vercel\.app$/);
  const health = await fetch(new URL("/health", STABLE_BACKEND_URL), { signal: AbortSignal.timeout(30_000) });
  assert.equal(health.status, 200, "Stable staging backend /health must return 200");
  const healthBody = await health.json();
  assert.equal(healthBody.commitSha, BACKEND_EXPECTED_SHA, "Stable staging backend commit SHA mismatch");

  const ready = await fetch(new URL("/ready", STABLE_BACKEND_URL), { signal: AbortSignal.timeout(30_000) });
  assert.equal(ready.status, 200, "Stable staging backend /ready must return 200");
  const readyBody = await ready.json();
  assert.equal(readyBody.status, "ready", "Stable staging backend must report ready");
  assert.equal(readyBody.checks?.database?.status, "ok", "Stable staging backend database readiness must be ok");
  assert.equal(readyBody.checks?.schema?.status, "ok", "Stable staging backend schema readiness must be ok");

  const bootstrap = await fetch(new URL("/api/v1/auth/bootstrap", STABLE_BACKEND_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(bootstrap.status, 401, "Unauthenticated stable staging bootstrap must fail with 401");
}

async function setup() {
  const state = { frontendEnvIds: [], createdAt: new Date().toISOString() };
  await fs.mkdir("../artifacts/s053-browser-evidence", { recursive: true });
  await saveState(state);

  await assertManagedEnvAbsent(FRONTEND_PROJECT_ID, ["BACKEND_API_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
  await verifyBackend();

  for (const [key, value] of [
    ["BACKEND_API_URL", STABLE_BACKEND_URL],
    ["NEXT_PUBLIC_SUPABASE_URL", STAGING_SUPABASE_URL],
  ]) {
    const id = await upsertEnv(FRONTEND_PROJECT_ID, key, value);
    state.frontendEnvIds.push(id);
    await saveState(state);
  }

  const frontendSince = Date.now() - 2000;
  runVercel(["redeploy", FRONTEND_SOURCE_DEPLOYMENT, "--token=" + token], FRONTEND_PROJECT_ID);
  const frontendDeployment = await waitForDeployment(FRONTEND_PROJECT_ID, frontendSince);
  const frontendUrl = "https://" + frontendDeployment.url;

  state.frontendDeploymentId = frontendDeployment.id;
  state.frontendUrl = frontendUrl;
  await saveState(state);

  await fs.writeFile(
    REPORT_PATH,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      expectedFrontendSha: EXPECTED_SHA,
      backendSha: BACKEND_EXPECTED_SHA,
      targetBranch: TARGET_BRANCH,
      dataPlane: "TradeOS Staging",
      backend: { url: STABLE_BACKEND_URL, readiness: "verified" },
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

  console.log("Prepared S053 Preview frontend " + frontendDeployment.id + " against verified stable staging backend.");
}

async function cleanup() {
  let state;
  try {
    state = JSON.parse(await fs.readFile(STATE_PATH, "utf8"));
  } catch {
    console.log("No S053 Preview state file; nothing to clean.");
    return;
  }
  const failures = [];
  for (const id of state.frontendEnvIds ?? []) {
    const url = new URL("https://api.vercel.com/v9/projects/" + FRONTEND_PROJECT_ID + "/env/" + id);
    url.searchParams.set("teamId", TEAM_ID);
    try {
      await fetchJson(url, { method: "DELETE" });
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (failures.length > 0) throw new Error("S053 temporary Preview env cleanup failed: " + failures.join(" | "));
  console.log("Removed " + (state.frontendEnvIds ?? []).length + " temporary S053 frontend Preview overrides.");
}

if (process.argv.includes("--cleanup")) await cleanup();
else await setup();
