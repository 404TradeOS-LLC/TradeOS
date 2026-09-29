import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { assertApprovedRcUrl, assertNonProductionDataPlane } from "./beta-evidence/lib/rc-target.mjs";

const TEAM_ID = "team_nY1VrcaEYEr4rcW7Gxweq7LP";
const WEB_PROJECT_ID = "prj_jDyORkIa7ug3ZtgtNujwEa65hQ36";
const url = assertApprovedRcUrl(process.env.S027_BASE_URL);
const expectedSupabaseRef = assertNonProductionDataPlane(process.env.BETA_RC_SUPABASE_PROJECT_REF);
const expectedSha = process.env.S027_EXPECTED_SHA?.trim() ?? "";
assert.equal(process.env.S027_SANITIZED_TENANT, "true", "Sanitized smoke tenant confirmation required");
assert.match(process.env.BETA_SMOKE_ORG_ID ?? "", /^[0-9a-f-]{36}$/, "Canonical smoke organization ID required");
assert.match(expectedSha, /^[a-f0-9]{40}$/, "Full deployed SHA required");
assert.ok(process.env.VERCEL_TOKEN, "Vercel read access required for deployment identity");
const headers = { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` };
const response = await fetch(`https://api.vercel.com/v13/deployments/${url.hostname}?teamId=${TEAM_ID}`, {
  headers,
  signal: AbortSignal.timeout(30_000),
});
assert.equal(response.status, 200, "Vercel deployment lookup failed");
const deployment = await response.json();
assert.equal(deployment.projectId, WEB_PROJECT_ID, "Wrong Vercel project");
assert.equal(deployment.readyState, "READY");
assert.ok(deployment.target === null || deployment.target === "preview", "Production deployment refused");
assert.equal(deployment.meta?.githubCommitSha, process.env.S027_EXPECTED_SHA, "Preview deployed SHA mismatch");
assert.ok(deployment.meta?.githubCommitRef, "Preview deployment branch metadata required");
assert.ok(Number.isFinite(Number(deployment.createdAt)), "Preview deployment creation timestamp required");

const envUrl = new URL(`https://api.vercel.com/v10/projects/${WEB_PROJECT_ID}/env`);
envUrl.searchParams.set("teamId", TEAM_ID);
// Fetch all Preview env metadata. Vercel's gitBranch filter returns only branch
// overrides and omits shared Preview values, so precedence is resolved here.
const envResponse = await fetch(envUrl, { headers, signal: AbortSignal.timeout(30_000) });
assert.equal(envResponse.status, 200, "Vercel Preview environment lookup failed");
const envPayload = await envResponse.json();
const envs = envPayload.envs ?? envPayload;
const previewUrls = envs.filter((env) =>
  env?.key === "NEXT_PUBLIC_SUPABASE_URL" &&
  (Array.isArray(env.target) ? env.target.includes("preview") : env.target === "preview")
);
const branchScoped = previewUrls.filter((env) => env.gitBranch === deployment.meta.githubCommitRef);
const sharedPreview = previewUrls.filter((env) => !env.gitBranch);
const candidates = branchScoped.length > 0 ? branchScoped : sharedPreview;
const candidate = [...candidates]
  .sort((a, b) => Number(b.updatedAt ?? b.createdAt ?? 0) - Number(a.updatedAt ?? a.createdAt ?? 0))[0];
assert.ok(candidate?.id, "Vercel Preview NEXT_PUBLIC_SUPABASE_URL metadata is required for deployment data-plane attestation");
const configuredAt = Number(candidate.updatedAt ?? candidate.createdAt ?? 0);
assert.ok(Number.isFinite(configuredAt) && configuredAt > 0, "Vercel Supabase environment timestamp is required");
assert.ok(configuredAt <= Number(deployment.createdAt), "Vercel Supabase environment changed after this deployment; redeploy before mutating evidence");

const envValueUrl = new URL(`https://api.vercel.com/v1/projects/${WEB_PROJECT_ID}/env/${candidate.id}`);
envValueUrl.searchParams.set("teamId", TEAM_ID);
const envValueResponse = await fetch(envValueUrl, { headers, signal: AbortSignal.timeout(30_000) });
assert.equal(envValueResponse.status, 200, "Vercel Preview Supabase environment value lookup failed");
const envValuePayload = await envValueResponse.json();
assert.equal(typeof envValuePayload.value, "string", "Vercel Preview NEXT_PUBLIC_SUPABASE_URL decrypted value is required");
let supabaseUrl;
try {
  supabaseUrl = new URL(envValuePayload.value);
} catch {
  assert.fail("Vercel Preview NEXT_PUBLIC_SUPABASE_URL must be a valid URL");
}
assert.equal(supabaseUrl.protocol, "https:", "Vercel Preview NEXT_PUBLIC_SUPABASE_URL must use HTTPS");
const supabaseMatch = supabaseUrl.hostname.toLowerCase().match(/^([a-z0-9]{20})\.supabase\.co$/);
assert.ok(supabaseMatch, "Vercel Preview NEXT_PUBLIC_SUPABASE_URL must identify a Supabase project");
const deployedSupabaseRef = supabaseMatch[1];
assertNonProductionDataPlane(deployedSupabaseRef);
assert.equal(deployedSupabaseRef, expectedSupabaseRef, "Selected Preview deployment is not attested to the expected RC Supabase project");

const identity = {
  id: deployment.id,
  url: deployment.url,
  commitSha: deployment.meta.githubCommitSha,
  branch: deployment.meta.githubCommitRef,
  supabaseProjectRef: deployedSupabaseRef,
  observedAt: new Date().toISOString(),
};
const outDir = process.env.S027_EVIDENCE_DIR || "../artifacts/s027-browser-evidence";
await fs.mkdir(outDir, { recursive: true });
const target = path.join(outDir, "deployment-identity.json");
if (process.argv.includes("--verify")) {
  const before = JSON.parse(await fs.readFile(target, "utf8"));
  assert.equal(identity.id, before.id, "Preview alias moved during evidence capture");
  assert.equal(identity.supabaseProjectRef, before.supabaseProjectRef, "Preview data-plane attestation changed during evidence capture");
  await fs.writeFile(path.join(outDir, "deployment-identity-after.json"), JSON.stringify(identity, null, 2));
} else {
  await fs.writeFile(target, JSON.stringify(identity, null, 2));
}
console.log(`Verified Preview deployment ${identity.id} at ${identity.commitSha} with RC data-plane attestation`);