import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { attestStagingPreview, attestEnvDetail, attestStagingRuntime, attestWithRuntime, STAGING_REF, PROD_REF, STAGING_URL, STAGING_API_ORIGIN, STAGING_WEB_ORIGIN } from "../staging-preview-attest.mjs";

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
    { ...api(), DATABASE_URL: `${api().DATABASE_URL}&host=/var/run/postgresql/` },
    { ...api(), DATABASE_URL: `${api().DATABASE_URL}&host=unsafe` },
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

function stubFetch({ health = { status: "ok" }, ready = { status: "ready", checks: { database: { status: "ok" } } }, homeOk = true, loginOk = true } = {}) {
  return async (url) => {
    if (url === `${STAGING_API_ORIGIN}/health`) {
      return { ok: true, status: 200, json: async () => health };
    }
    if (url === `${STAGING_API_ORIGIN}/ready`) {
      return { ok: true, status: 200, json: async () => ready };
    }
    if (url === `${STAGING_WEB_ORIGIN}/`) {
      return homeOk ? { ok: true, status: 200 } : { ok: false, status: 404 };
    }
    if (url === `${STAGING_WEB_ORIGIN}/login`) {
      return loginOk ? { ok: true, status: 200 } : { ok: false, status: 404 };
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
}

test("env detail distinguishes missing from mismatch", () => {
  const missing = Object.fromEntries(attestEnvDetail("api", {}).map((d) => [d.field, d.reason]));
  assert.equal(missing.SUPABASE_URL, "missing");
  assert.equal(missing.AUTH_JWT_SECRET, "missing");
  assert.equal(missing.DATABASE_URL, "missing");
  assert.deepEqual(
    attestEnvDetail("api", { ...api(), SUPABASE_URL: `https://${PROD_REF}.supabase.co` }),
    [{ field: "SUPABASE_URL", reason: "mismatch" }],
  );
});

test("runtime checks pass when healthy and fail on unserved web or unready api", async () => {
  assert.deepEqual(await attestStagingRuntime("api", stubFetch()), []);
  assert.deepEqual(await attestStagingRuntime("web", stubFetch()), []);
  assert.deepEqual(
    await attestStagingRuntime("api", stubFetch({ ready: { status: "not_ready", checks: { database: { status: "error" } } } })),
    ["API_READINESS"],
  );
  assert.deepEqual(await attestStagingRuntime("web", stubFetch({ homeOk: false })), ["WEB_SERVING"]);
  assert.deepEqual(await attestStagingRuntime("web", stubFetch({ loginOk: false })), ["WEB_SERVING"]);
});

test("withheld api secrets are runtime-inferred only when runtime is healthy", async () => {
  const healthy = await attestWithRuntime("api", {}, stubFetch());
  assert.deepEqual(healthy.errors, []);
  assert.deepEqual(healthy.runtimeInferred, ["SUPABASE_URL", "AUTH_JWT_SECRET", "DATABASE_URL"]);
  const unhealthy = await attestWithRuntime("api", {}, stubFetch({ ready: { status: "not_ready", checks: { database: { status: "error" } } } }));
  assert.ok(unhealthy.errors.includes("SUPABASE_URL"));
  assert.ok(unhealthy.errors.includes("API_READINESS"));
  assert.deepEqual(unhealthy.runtimeInferred, []);
});

test("a malformed database url is a mismatch, never runtime-inferred", async () => {
  const result = await attestWithRuntime("api", { ...api(), DATABASE_URL: "not-a-postgresql-url" }, stubFetch());
  assert.deepEqual(result.errors, ["DATABASE_URL"]);
  assert.deepEqual(result.runtimeInferred, []);
});
test("a wrong env value is never excused by healthy runtime", async () => {
  const result = await attestWithRuntime("api", { ...api(), SUPABASE_URL: `https://${PROD_REF}.supabase.co` }, stubFetch());
  assert.deepEqual(result.errors, ["SUPABASE_URL"]);
});

test("web service key is runtime-inferred but public url and backend url absence are not", async () => {
  const noKey = await attestWithRuntime("web", { NEXT_PUBLIC_SUPABASE_URL: STAGING_URL, BACKEND_API_URL: STAGING_API_ORIGIN }, stubFetch());
  assert.deepEqual(noKey.errors, []);
  assert.ok(noKey.runtimeInferred.includes("SUPABASE_SERVICE_ROLE_KEY"));
  const noBackend = await attestWithRuntime("web", { NEXT_PUBLIC_SUPABASE_URL: STAGING_URL, SUPABASE_SERVICE_ROLE_KEY: "test-only-staging-service-role" }, stubFetch());
  assert.deepEqual(noBackend.errors, ["BACKEND_API_URL"]);
  const noPublic = await attestWithRuntime("web", { SUPABASE_SERVICE_ROLE_KEY: "test-only-staging-service-role", BACKEND_API_URL: STAGING_API_ORIGIN }, stubFetch());
  assert.deepEqual(noPublic.errors, ["NEXT_PUBLIC_SUPABASE_URL"]);
});
