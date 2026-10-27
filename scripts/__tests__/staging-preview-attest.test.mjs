import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { attestStagingPreview, STAGING_REF, STAGING_URL, STAGING_API_ORIGIN } from "../staging-preview-attest.mjs";

const api = () => ({
  SUPABASE_URL: STAGING_URL,
  AUTH_JWT_SECRET: "test-only-secret",
  DATABASE_URL: `postgresql://app:example@db.${STAGING_REF}.supabase.co:5432/postgres?schema=public`,
});
const web = () => ({
  NEXT_PUBLIC_SUPABASE_URL: STAGING_URL,
  SUPABASE_SERVICE_ROLE_KEY: "test-only-staging-service-role",
  BACKEND_API_URL: STAGING_API_ORIGIN,
  TEAM_TIME_SUPABASE_PROJECT_REF: STAGING_REF,
});

test("accepts direct and pooled staging API database URLs", () => {
  assert.deepEqual(attestStagingPreview("api", api()), []);
  assert.deepEqual(attestStagingPreview("api", {
    ...api(), DATABASE_URL: `postgresql://postgres.${STAGING_REF}:test@aws-0-us-east-2.pooler.supabase.com:6543/postgres`,
  }), []);
});

test("fails closed for production or unprovable API database bindings", () => {
  for (const values of [
    { ...api(), SUPABASE_URL: "https://kssaceuetdjwfqnbzhly.supabase.co" },
    { ...api(), DATABASE_URL: "postgresql://app:pw@db.kssaceuetdjwfqnbzhly.supabase.co/postgres" },
    { ...api(), DATABASE_URL: "postgresql://postgres.kssaceuetdjwfqnbzhly:pw@aws-0-us-east-2.pooler.supabase.com/postgres" },
    { ...api(), DATABASE_URL: "not-a-postgresql-url" },
    { ...api(), AUTH_JWT_SECRET: "" },
    { ...api(), VERCEL_ENV: "production" },
  ]) assert.notDeepEqual(attestStagingPreview("api", values), []);
});

test("requires web to target the exact staging API and Supabase ref", () => {
  assert.deepEqual(attestStagingPreview("web", web()), []);
  for (const values of [
    { ...web(), BACKEND_API_URL: "https://api.404tradeos.com" },
    { ...web(), BACKEND_API_URL: "https://tradeos-costbook-git-main-billykshowalters.vercel.app" },
    { ...web(), BACKEND_API_URL: STAGING_API_ORIGIN + "/api/v1" },
    { ...web(), NEXT_PUBLIC_SUPABASE_URL: "https://kssaceuetdjwfqnbzhly.supabase.co" },
    { ...web(), SUPABASE_SERVICE_ROLE_KEY: "" },
    { ...web(), TEAM_TIME_SUPABASE_PROJECT_REF: "kssaceuetdjwfqnbzhly" },
  ]) assert.notDeepEqual(attestStagingPreview("web", values), []);
  assert.deepEqual(attestStagingPreview("other", web()), ["target"]);
});

test("failure output exposes field names, never their values", () => {
  const token = "TEST-ONLY-SENSITIVE-TOKEN";
  const child = spawnSync(process.execPath, ["scripts/staging-preview-attest.mjs", "web"], {
    encoding: "utf8", env: {
      ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://kssaceuetdjwfqnbzhly.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: token, BACKEND_API_URL: "https://api.404tradeos.com",
    },
  });
  assert.equal(child.status, 1);
  assert.match(child.stderr, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.doesNotMatch(child.stderr + child.stdout, /TEST-ONLY-SENSITIVE-TOKEN|kssaceuetdjwfqnbzhly|api\.404tradeos\.com/);
});

test("protected workflow selects the exact projects and branch without mutating them", () => {
  const workflow = readFileSync(".github/workflows/attest-staging-preview.yml", "utf8");
  assert.match(workflow, /environment: staging/);
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /STAGING_BRANCH: staging/);
  assert.match(workflow, /prj_BVJxF6rnO90wMdNjZ1Yn4QO1aGwD/);
  assert.match(workflow, /prj_jDyORkIa7ug3ZtgtNujwEa65hQ36/);
  assert.equal((workflow.match(/VERCEL_TOKEN: \$\{\{ secrets\.VERCEL_TOKEN \}\}/g) || []).length, 2);
  assert.equal((workflow.match(/vercel env run -e preview --git-branch/g) || []).length, 2);
  assert.doesNotMatch(workflow, /--token|vercel (?:deploy|redeploy|env (?:add|update|rm))/);
  assert.doesNotMatch(workflow, /kssaceuetdjwfqnbzhly|environment: production/);
});
