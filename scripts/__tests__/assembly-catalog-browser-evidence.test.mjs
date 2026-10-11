import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import yaml from "js-yaml";

const workflowPath = ".github/workflows/assembly-catalog-browser-evidence.yml";
const specPath = "tests/playwright/assembly-catalog.spec.ts";
const workflow = fs.readFileSync(workflowPath, "utf8");
const spec = fs.readFileSync(specPath, "utf8");
const parsed = yaml.load(workflow);

test("Assembly evidence is manual and cannot run against production without exact SHA/data-plane proof", () => {
  assert.ok(parsed.on?.workflow_dispatch, "workflow_dispatch required");
  assert.equal(parsed.permissions.contents, "read");
  assert.doesNotMatch(workflow, /pull_request_target:|schedule:/);
  for (const required of [
    "base_url:", "expected_sha:", "smoke_org_id:", "sanitized_tenant:",
    "node app/scripts/s027-deployment-identity.mjs",
    "node app/scripts/s027-deployment-identity.mjs --verify",
    "npm run test:e2e:guards", "TRADEOS_AGENT_ENVIRONMENT: preview",
  ]) assert.ok(workflow.includes(required), `Missing evidence guard: ${required}`);
  assert.match(workflow, /BETA_RC_SUPABASE_PROJECT_REF: \$\{\{ secrets\.BETA_RC_SUPABASE_PROJECT_REF \}\}/);
  assert.match(workflow, /S027_EXPECTED_SHA: \$\{\{ inputs\.expected_sha \}\}/);
  assert.match(workflow, /TRADEOS_AGENT_SANITIZED_TENANT: \$\{\{ inputs\.sanitized_tenant \}\}/);
});

test("two distinct tenant-verified role sessions are mandatory, created at runner temp, then removed", () => {
  assert.match(workflow, /OWNER_EMAIL.*\n[\s\S]*?READER_EMAIL/);
  assert.match(workflow, /OWNER_EMAIL.*==.*READER_EMAIL/);
  assert.match(workflow, /BETA_SMOKE_ORG_ID: \$\{\{ inputs\.smoke_org_id \}\}/);
  assert.match(workflow, /BETA_STORAGE_STATE_PATH: \$\{\{ runner\.temp \}\}\/tradeos-assembly-owner\.json/);
  assert.match(workflow, /BETA_STORAGE_STATE_PATH: \$\{\{ runner\.temp \}\}\/tradeos-assembly-reader\.json/);
  assert.equal((workflow.match(/node app\/scripts\/beta-evidence\/auth-setup\.mjs/g) ?? []).length, 2);
  const removePos = workflow.indexOf("Remove both runtime sessions");
  const scanPos = workflow.indexOf("Scan all retained artifacts");
  const uploadPos = workflow.indexOf("Upload sanitized evidence only");
  assert.ok(removePos < scanPos && scanPos < uploadPos, "Remove sessions and scan before upload");
  assert.match(workflow, /steps\.credential_scan\.outcome == 'success'/);
  assert.match(workflow, /rm -f.*TRADEOS_ASSEMBLY_OWNER_STATE.*TRADEOS_ASSEMBLY_READER_STATE/);
  assert.doesNotMatch(workflow, /actions\/upload-artifact[^\n]*[\s\S]*?\.json\s+\$\{\{ runner\.temp \}\}/);
});

test("browser matrix asserts owner/read-only state and both viewport widths without writes", () => {
  assert.match(spec, /TRADEOS_ASSEMBLY_EVIDENCE === 'true'/);
  assert.match(spec, /role\.state/);
  assert.match(spec, /trace: 'off', video: 'off'/);
  assert.match(spec, /width: 1440/);
  assert.match(spec, /width: 390/);
  assert.match(spec, /getByRole\('heading', \{ name: 'Residential Assembly Catalog'/);
  for (const facet of ["NAHB group", "CSI division", "trade", "assembly unit", "installation status"]) {
    assert.ok(spec.includes(`Filter by ${facet}`), `missing ${facet}`);
  }
  assert.match(spec, /toBeDisabled\(\)/);
  assert.match(spec, /toBeEnabled\(\)/);
  assert.match(spec, /forbiddenWrites/);
  assert.doesNotMatch(spec, /await install\.click|fetch\(.+method:\s*['"]POST|page\.request\.(post|put|patch|delete)/i);
  assert.match(spec, /toBeLessThanOrEqual\(width \+ 2\)/);
  assert.match(spec, /page\.screenshot\(\{ path: file, fullPage: true/);
  assert.match(workflow, /playwright test tests\/playwright\/assembly-catalog\.spec\.ts --project=chromium/);
});

test("no successful evidence can be silently inferred from test discovery or missing credentials", () => {
  assert.match(spec, /if \(enabled && !role\.state\)/);
  assert.match(spec, /throw new Error\(/);
  assert.match(workflow, /Require both role credentials/);
  assert.match(workflow, /if \[\[ -z .*OWNER_EMAIL.*READER_PASSWORD.*\]\]/);
  assert.match(workflow, /if-no-files-found: error/);
});
