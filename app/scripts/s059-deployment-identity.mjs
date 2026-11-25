import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { assertApprovedRcUrl, assertNonProductionDataPlane, deriveEnvironmentFromUrl } from "./beta-evidence/lib/rc-target.mjs";
import {
  collectRuntimeIdentity,
  verifyDeploymentIdentity,
  verifyIdentityUnchanged,
} from "./beta-evidence/lib/deployment-identity-contract.mjs";

// S059 deployment identity. Proves, BEFORE any capture, that the web origin
// under test is the expected READY Vercel deployment of the expected SHA, and
// that the backend actually serving it reports the same SHA on /health and
// the expected non-production data plane on /ready.
//
// The runtime checks go through the canonical S071 identity contract
// (app/scripts/beta-evidence/lib/deployment-identity-contract.mjs), shared
// with the staging orchestrator: commit, environment, backend host, and
// data-plane identifier are verified from the deployment itself and fail
// closed on any mismatch, missing value, or unparseable identity. No env
// inventory is fetched, decrypted, or asserted.
//
// Deliberately NOT a copy of s027-deployment-identity.mjs: that script also
// fetches the full Preview env inventory and asserts a branch-scoped
// NEXT_PUBLIC_SUPABASE_URL value, which fails on current Preview/staging env
// metadata (runs 36792720050 / 36794146373, "Vercel Preview
// NEXT_PUBLIC_SUPABASE_URL must be a valid URL"). The data-plane proof here
// comes from the live runtime instead — the API deployment's /ready response
// carries checks.database.projectRef — following the
// correlateStagingRuntime pattern in
// app/scripts/beta-evidence/lib/staging-runtime-correlation.mjs. No env
// inventory is fetched, decrypted, or asserted.
//
// The API deployment is found through the Vercel deployments list for the
// API project, matched on branch + READY + (when correlation is required)
// the same SHA — the same polling shape the staging orchestrator uses.
// The web's effective backend is then bound to that API deployment: the
// web reaches its backend through BACKEND_API_URL, and the runtime-identity
// endpoint proves the web's BACKEND_API_URL is the returned backendOrigin
// (200 only when the staging bindings are verified). The alias is resolved
// through the Vercel API and must be the selected API deployment — a stable
// alias can otherwise resolve to a different deployment than the one whose
// /health + /ready were checked. The same binding check runs in --verify,
// so a backend change during capture fails verification.
// Env: S059_BASE_URL, S059_EXPECTED_SHA, S059_REQUIRE_SHA_CORRELATION
// (default "true"), BETA_RC_SUPABASE_PROJECT_REF, VERCEL_TOKEN,
// S059_SANITIZED_TENANT, BETA_SMOKE_ORG_ID, S059_EVIDENCE_DIR.
// `--verify` re-runs the same checks and asserts the deployment IDs and
// data-plane attestation did not move during capture.

const TEAM_ID = "team_nY1VrcaEYEr4rcW7Gxweq7LP";
const WEB_PROJECT_ID = "prj_jDyORkIa7ug3ZtgtNujwEa65hQ36";
const API_PROJECT_ID = "prj_BVJxF6rnO90wMdNjZ1Yn4QO1aGwD";

const url = assertApprovedRcUrl(process.env.S059_BASE_URL);
const expectedSupabaseRef = assertNonProductionDataPlane(process.env.BETA_RC_SUPABASE_PROJECT_REF);
const expectedSha = process.env.S059_EXPECTED_SHA?.trim() ?? "";
const requireCorrelation = (process.env.S059_REQUIRE_SHA_CORRELATION ?? "true") !== "false";
assert.equal(process.env.S059_SANITIZED_TENANT, "true", "Sanitized smoke tenant confirmation required");
assert.match(process.env.BETA_SMOKE_ORG_ID ?? "", /^[0-9a-f-]{36}$/, "Canonical smoke organization ID required");
assert.match(expectedSha, /^[a-f0-9]{40}$/, "Full deployed SHA required");
assert.ok(process.env.VERCEL_TOKEN, "Vercel read access required for deployment identity");
const headers = { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` };

async function fetchJson(requestUrl, label) {
  const response = await fetch(requestUrl, { headers, signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200, `${label} lookup failed`);
  return response.json();
}

const deployment = await fetchJson(`https://api.vercel.com/v13/deployments/${url.hostname}?teamId=${TEAM_ID}`, "Vercel deployment");
assert.equal(deployment.projectId, WEB_PROJECT_ID, "Wrong Vercel project");
assert.equal(deployment.readyState, "READY");
assert.ok(deployment.target === null || deployment.target === "preview", "Production deployment refused");
const branch = deployment.meta?.githubCommitRef;
assert.ok(branch, "Preview deployment branch metadata required");
assert.ok(Number.isFinite(Number(deployment.createdAt)), "Preview deployment creation timestamp required");
const reportedSha = deployment.meta?.githubCommitSha;
if (requireCorrelation) {
  assert.equal(reportedSha, expectedSha, "Preview deployed SHA mismatch");
} else {
  assert.ok(reportedSha, "Preview deployment SHA metadata required");
}

// Find the API deployment of the same branch (and SHA, when correlated).
const apiList = await fetchJson(
  `https://api.vercel.com/v6/deployments?projectId=${API_PROJECT_ID}&limit=50&teamId=${TEAM_ID}`,
  "Vercel API deployments",
);
const apiDeployment = (apiList.deployments ?? []).find(
  (candidate) =>
    candidate.state === "READY" &&
    candidate.meta?.githubCommitRef === branch &&
    (!requireCorrelation || candidate.meta?.githubCommitSha === expectedSha),
);
assert.ok(apiDeployment, `No READY API deployment of ${requireCorrelation ? expectedSha : branch} found; deploy the API for this branch first`);
const apiOrigin = `https://${apiDeployment.url}`;

// Canonical S071 identity contract: verify commit, environment, backend
// host, and data-plane identifier from the deployment itself. The contract
// fails closed on any mismatch, missing value, or unparseable identity and
// refuses production targets; the Vercel deployment-list proof above still
// binds the alias to a READY deployment of the expected SHA.
const observed = await collectRuntimeIdentity({ webOrigin: url.origin, apiOrigin });
const verified = verifyDeploymentIdentity({
  expected: {
    commitSha: expectedSha,
    environment: deriveEnvironmentFromUrl(url.href),
    backendHost: new URL(apiOrigin).hostname,
    supabaseProjectRef: expectedSupabaseRef,
  },
  observed,
  options: { requireShaCorrelation: requireCorrelation, requireWebIdentity: true },
});

// Bind the web's effective backend to the selected API deployment. The
// runtime-identity endpoint returns 200 only on staging previews whose
// BACKEND_API_URL is the verified staging API alias; it returns 404 on
// non-staging targets (no binding is published) and 503 when the bindings
// are not verified (fail — that is a real misconfiguration signal).
let backendOrigin = null;
let backendBinding = "not-published";
if (observed.webIdentityPublished) {
  backendOrigin = observed.webBackendHost ? `https://${observed.webBackendHost}` : null;
  assert.ok(typeof backendOrigin === "string" && backendOrigin.length > 0, "Runtime identity returned no backendOrigin");
  const backendDeployment = await fetchJson(
    `https://api.vercel.com/v13/deployments/${new URL(backendOrigin).hostname}?teamId=${TEAM_ID}`,
    "Backend alias deployment",
  );
  assert.equal(backendDeployment.projectId, API_PROJECT_ID, "Web backend alias resolves to the wrong Vercel project");
  assert.equal(
    backendDeployment.uid ?? backendDeployment.id,
    apiDeployment.uid,
    "Web backend alias does not resolve to the selected API deployment",
  );
  backendBinding = "verified";
}

const identity = {
  id: deployment.id,
  url: deployment.url,
  commitSha: reportedSha,
  branch,
  environment: verified.environment,
  apiDeploymentId: apiDeployment.uid,
  apiDeploymentUrl: apiOrigin,
  backendOrigin,
  backendBinding,
  supabaseProjectRef: expectedSupabaseRef,
  shaCorrelated: requireCorrelation,
  observedAt: new Date().toISOString(),
};
const outDir = process.env.S059_EVIDENCE_DIR || "../artifacts/s059-browser-evidence";
await fs.mkdir(outDir, { recursive: true });
const target = path.join(outDir, "deployment-identity.json");
if (process.argv.includes("--verify")) {
  const before = JSON.parse(await fs.readFile(target, "utf8"));
  assert.equal(identity.id, before.id, "Preview alias moved during evidence capture");
  assert.equal(identity.apiDeploymentId, before.apiDeploymentId, "API deployment moved during evidence capture");
  assert.equal(identity.backendOrigin, before.backendOrigin, "Web backend origin changed during evidence capture");
  assert.equal(identity.backendBinding, before.backendBinding, "Web backend binding changed during evidence capture");
  assert.equal(identity.supabaseProjectRef, before.supabaseProjectRef, "Preview data-plane attestation changed during evidence capture");
  assert.equal(identity.environment, before.environment, "Deployment environment changed during evidence capture");
  verifyIdentityUnchanged(
    {
      commitSha: before.commitSha,
      environment: before.environment,
      backendHost: before.apiDeploymentUrl ? new URL(before.apiDeploymentUrl).hostname : undefined,
      supabaseProjectRef: before.supabaseProjectRef,
      id: before.id,
      apiDeploymentId: before.apiDeploymentId,
      backendOrigin: before.backendOrigin,
      backendBinding: before.backendBinding,
    },
    {
      commitSha: identity.commitSha,
      environment: identity.environment,
      backendHost: new URL(identity.apiDeploymentUrl).hostname,
      supabaseProjectRef: identity.supabaseProjectRef,
      id: identity.id,
      apiDeploymentId: identity.apiDeploymentId,
      backendOrigin: identity.backendOrigin,
      backendBinding: identity.backendBinding,
    },
  );
  await fs.writeFile(path.join(outDir, "deployment-identity-after.json"), JSON.stringify(identity, null, 2));
} else {
  await fs.writeFile(target, JSON.stringify(identity, null, 2));
}
console.log(`Verified Preview deployment ${identity.id} at ${identity.commitSha} with API ${identity.apiDeploymentId} on data plane ${identity.supabaseProjectRef}`);
