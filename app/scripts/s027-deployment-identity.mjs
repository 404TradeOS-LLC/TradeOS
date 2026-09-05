import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { assertApprovedRcUrl, assertNonProductionDataPlane } from "./beta-evidence/lib/rc-target.mjs";

const url = assertApprovedRcUrl(process.env.S027_BASE_URL);
assertNonProductionDataPlane(process.env.BETA_RC_SUPABASE_PROJECT_REF);
assert.equal(process.env.S027_SANITIZED_TENANT, "true", "Sanitized smoke tenant confirmation required");
assert.match(process.env.BETA_SMOKE_ORG_ID ?? "", /^[0-9a-f-]{36}$/, "Canonical smoke organization ID required");
assert.match(process.env.S027_EXPECTED_SHA ?? "", /^[a-f0-9]{40}$/, "Full deployed SHA required");
assert.ok(process.env.VERCEL_TOKEN, "Vercel read access required for deployment identity");
const response = await fetch(`https://api.vercel.com/v13/deployments/${url.hostname}?teamId=team_nY1VrcaEYEr4rcW7Gxweq7LP`, {
  headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
  signal: AbortSignal.timeout(30_000),
});
assert.equal(response.status, 200, "Vercel deployment lookup failed");
const deployment = await response.json();
assert.equal(deployment.projectId, "prj_jDyORkIa7ug3ZtgtNujwEa65hQ36", "Wrong Vercel project");
assert.equal(deployment.readyState, "READY");
assert.ok(deployment.target === null || deployment.target === "preview", "Production deployment refused");
assert.equal(deployment.meta?.githubCommitSha, process.env.S027_EXPECTED_SHA, "Preview deployed SHA mismatch");
const identity = { id: deployment.id, url: deployment.url, commitSha: deployment.meta.githubCommitSha, branch: deployment.meta.githubCommitRef, observedAt: new Date().toISOString() };
const outDir = process.env.S027_EVIDENCE_DIR || "../artifacts/s027-browser-evidence";
await fs.mkdir(outDir, { recursive: true });
const target = path.join(outDir, "deployment-identity.json");
if (process.argv.includes("--verify")) {
  const before = JSON.parse(await fs.readFile(target, "utf8"));
  assert.equal(identity.id, before.id, "Preview alias moved during evidence capture");
  await fs.writeFile(path.join(outDir, "deployment-identity-after.json"), JSON.stringify(identity, null, 2));
} else {
  await fs.writeFile(target, JSON.stringify(identity, null, 2));
}
console.log(`Verified Preview deployment ${identity.id} at ${identity.commitSha}`);
