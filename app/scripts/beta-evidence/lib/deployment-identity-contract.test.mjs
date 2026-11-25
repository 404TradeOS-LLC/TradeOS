import test from "node:test";
import assert from "node:assert/strict";
import {
  DeploymentIdentityError,
  collectRuntimeIdentity,
  verifyDeploymentIdentity,
  verifyIdentityUnchanged,
} from "./deployment-identity-contract.mjs";

const SHA = "a".repeat(40);
const OTHER_SHA = "b".repeat(40);
const STAGING_API_HOST = "tradeos-costbook-git-staging-billykshowalters.vercel.app";
const STAGING_WEB = "https://tradeos-costbook-web-git-staging-billykshowalters.vercel.app";
const STAGING_API = `https://${STAGING_API_HOST}`;
const STAGING_REF = "qfbgdkbamfaasmtjfyru";
const PRODUCTION_REF = "kssaceuetdjwfqnbzhly";

const expected = () => ({
  commitSha: SHA,
  environment: "staging",
  backendHost: STAGING_API_HOST,
  supabaseProjectRef: STAGING_REF,
});

const observed = () => ({
  commitSha: SHA,
  environment: "preview",
  backendHost: STAGING_API_HOST,
  supabaseProjectRef: STAGING_REF,
  webIdentityPublished: true,
  webCommitSha: SHA,
  webEnvironment: "preview",
  webBranch: "staging",
  webBackendHost: STAGING_API_HOST,
  webProjectRef: STAGING_REF,
});

function throwsWithCode(fn, code) {
  assert.throws(fn, (error) => error instanceof DeploymentIdentityError && error.code === code);
}

test("verifies a matching staging identity from the deployment", () => {
  const verified = verifyDeploymentIdentity({ expected: expected(), observed: observed() });
  assert.equal(verified.commitSha, SHA);
  assert.equal(verified.environment, "staging");
  assert.equal(verified.backendHost, STAGING_API_HOST);
  assert.equal(verified.supabaseProjectRef, STAGING_REF);
  assert.ok(verified.verifiedAt);
});

test("verifies a matching preview identity when the web identity is not published", () => {
  const verified = verifyDeploymentIdentity({
    expected: { ...expected(), environment: "preview", backendHost: "tradeos-costbook-abc123-billykshowalters.vercel.app" },
    observed: {
      commitSha: SHA,
      environment: "preview",
      backendHost: "tradeos-costbook-abc123-billykshowalters.vercel.app",
      supabaseProjectRef: STAGING_REF,
      webIdentityPublished: false,
    },
  });
  assert.equal(verified.environment, "preview");
});

test("fails closed on an unpublished web identity when the caller requires it", () => {
  const bad = observed();
  bad.webIdentityPublished = false;
  delete bad.webCommitSha;
  delete bad.webEnvironment;
  delete bad.webBranch;
  delete bad.webBackendHost;
  delete bad.webProjectRef;
  throwsWithCode(
    () => verifyDeploymentIdentity({ expected: expected(), observed: bad, options: { requireWebIdentity: true } }),
    "IDENTITY_WEB_IDENTITY_UNPUBLISHED",
  );
});

for (const [name, mutate, code] of [
  ["commit mismatch", (o) => { o.commitSha = OTHER_SHA; }, "IDENTITY_SHA_MISMATCH"],
  ["commit missing", (o) => { delete o.commitSha; }, "IDENTITY_SHA_MISSING"],
  ["commit malformed", (o) => { o.commitSha = "not-a-sha"; }, "IDENTITY_SHA_MALFORMED"],
  ["runtime environment missing", (o) => { delete o.environment; }, "IDENTITY_ENVIRONMENT_MISSING"],
  ["runtime environment unrecognized", (o) => { o.environment = "staging"; }, "IDENTITY_ENVIRONMENT_MISSING"],
  ["runtime environment production", (o) => { o.environment = "production"; }, "IDENTITY_PRODUCTION_REFUSED"],
  ["runtime environment development", (o) => { o.environment = "development"; }, "IDENTITY_ENVIRONMENT_UNACCEPTABLE"],
  ["branch mismatch", (o) => { o.webBranch = "main"; }, "IDENTITY_BRANCH_MISMATCH"],
  ["backend host mismatch", (o) => { o.backendHost = "other.vercel.app"; }, "IDENTITY_BACKEND_HOST_MISMATCH"],
  ["backend host missing", (o) => { delete o.backendHost; }, "IDENTITY_BACKEND_HOST_MISSING"],
  ["backend host is production", (o) => { o.backendHost = "api.404tradeos.com"; }, "IDENTITY_PRODUCTION_REFUSED"],
  ["data plane mismatch", (o) => { o.supabaseProjectRef = "aaaaaaaaaaaaaaaaaaaa"; }, "IDENTITY_DATA_PLANE_MISMATCH"],
  ["data plane missing", (o) => { delete o.supabaseProjectRef; }, "IDENTITY_DATA_PLANE_MISSING"],
  ["data plane is production", (o) => { o.supabaseProjectRef = PRODUCTION_REF; }, "IDENTITY_PRODUCTION_REFUSED"],
  ["web commit mismatch", (o) => { o.webCommitSha = OTHER_SHA; }, "IDENTITY_WEB_SHA_MISMATCH"],
  ["web environment mismatch", (o) => { o.webEnvironment = "development"; }, "IDENTITY_WEB_ENVIRONMENT_MISMATCH"],
  ["web data plane mismatch", (o) => { o.webProjectRef = "aaaaaaaaaaaaaaaaaaaa"; }, "IDENTITY_WEB_DATA_PLANE_MISMATCH"],
  ["web backend host is production", (o) => { o.webBackendHost = "api.404tradeos.com"; }, "IDENTITY_PRODUCTION_REFUSED"],
]) {
  test(`fails closed on ${name}`, () => {
    const bad = observed();
    mutate(bad);
    throwsWithCode(() => verifyDeploymentIdentity({ expected: expected(), observed: bad }), code);
  });
}

for (const [name, mutate, code] of [
  ["expected SHA missing", (e) => { delete e.commitSha; }, "IDENTITY_EXPECTED_SHA_MISSING"],
  ["expected SHA malformed", (e) => { e.commitSha = "abc"; }, "IDENTITY_EXPECTED_SHA_MALFORMED"],
  ["expected environment unsupported", (e) => { e.environment = "production"; }, "IDENTITY_ENVIRONMENT_UNSUPPORTED"],
  ["expected backend host missing", (e) => { delete e.backendHost; }, "IDENTITY_BACKEND_HOST_MISSING"],
  ["expected data plane is production", (e) => { e.supabaseProjectRef = PRODUCTION_REF; }, "IDENTITY_DATA_PLANE_INVALID"],
  ["expected data plane malformed", (e) => { e.supabaseProjectRef = "short"; }, "IDENTITY_DATA_PLANE_INVALID"],
]) {
  test(`fails closed on ${name}`, () => {
    const bad = expected();
    mutate(bad);
    throwsWithCode(() => verifyDeploymentIdentity({ expected: bad, observed: observed() }), code);
  });
}

test("without SHA correlation the commit must still be present and well-formed, but equality is not asserted", () => {
  const verified = verifyDeploymentIdentity({
    expected: expected(),
    observed: { ...observed(), commitSha: OTHER_SHA, webCommitSha: OTHER_SHA },
    options: { requireShaCorrelation: false },
  });
  assert.equal(verified.commitSha, OTHER_SHA);
  assert.equal(verified.shaCorrelated, false);
  throwsWithCode(
    () =>
      verifyDeploymentIdentity({
        expected: expected(),
        observed: { ...observed(), commitSha: OTHER_SHA },
        options: { requireShaCorrelation: true },
      }),
    "IDENTITY_SHA_MISMATCH",
  );
});

test("never reports a production deployment as verified, even with a matching SHA", () => {
  throwsWithCode(
    () =>
      verifyDeploymentIdentity({
        expected: { ...expected(), environment: "preview" },
        observed: { ...observed(), environment: "production" },
      }),
    "IDENTITY_PRODUCTION_REFUSED",
  );
});

// --- collectRuntimeIdentity ---

const webBody = () => ({
  status: "configured",
  commitSha: SHA,
  branch: "staging",
  environment: "preview",
  supabaseProjectRef: STAGING_REF,
  backendOrigin: STAGING_API,
  scope: "public_configuration_only",
});
const healthBody = () => ({ status: "ok", commitSha: SHA, environment: "preview" });
const readyBody = () => ({ status: "ready", checks: { database: { status: "ok", projectRef: STAGING_REF } } });

function transport({ web = webBody(), health = healthBody(), ready = readyBody() } = {}, calls = []) {
  return async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/api/staging-runtime-identity")) {
      if (web === null) return { status: 404, ok: false };
      return { status: 200, ok: true, json: async () => web };
    }
    if (url.endsWith("/health")) return { status: 200, ok: true, json: async () => health };
    return { status: 200, ok: true, json: async () => ready };
  };
}

test("collects the observed identity from the three public runtime surfaces", async () => {
  const calls = [];
  const found = await collectRuntimeIdentity({ webOrigin: STAGING_WEB, apiOrigin: STAGING_API, fetchImpl: transport({}, calls) });
  assert.equal(found.commitSha, SHA);
  assert.equal(found.environment, "preview");
  assert.equal(found.backendHost, STAGING_API_HOST);
  assert.equal(found.supabaseProjectRef, STAGING_REF);
  assert.equal(found.webIdentityPublished, true);
  assert.equal(found.webBranch, "staging");
  assert.equal(found.webBackendHost, STAGING_API_HOST);
  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.options.redirect === "error" && call.options.cache === "no-store"));
  assert.ok(calls.every((call) => !call.options.headers), "no headers are sent: the surfaces are public and no credential is presented");
  assert.ok(!calls.some((call) => /vercel\.com\/v\d+\/projects\/.*\/env/.test(call.url)), "no env inventory is fetched");
});

test("collects an unpublished web identity (non-staging preview) without failing", async () => {
  const found = await collectRuntimeIdentity({ webOrigin: STAGING_WEB, apiOrigin: STAGING_API, fetchImpl: transport({ web: null }) });
  assert.equal(found.webIdentityPublished, false);
  assert.equal(found.webBranch, undefined);
  assert.equal(found.commitSha, SHA);
});

test("fails closed when a runtime surface is unavailable, non-200, or unparseable", async () => {
  const failing = [
    transport({ health: { status: "failed", commitSha: SHA } }),
    transport({ ready: { status: "not_ready", checks: { database: { status: "error" } } } }),
    transport({ ready: { status: "ready", checks: { database: { status: "ok" } } } }),
    transport({ web: { ...webBody(), scope: "other" } }),
    async () => { throw new Error("secret-token-in-error"); },
    async () => ({ status: 500, ok: false }),
    async (url) => ({ status: 200, ok: true, json: async () => { throw new Error("bad json"); } }),
  ];
  for (const fetchImpl of failing) {
    await assert.rejects(
      collectRuntimeIdentity({ webOrigin: STAGING_WEB, apiOrigin: STAGING_API, fetchImpl }),
      (error) => error instanceof DeploymentIdentityError && !error.message.includes("secret-token"),
    );
  }
});

test("refuses production origins before making any request", async () => {
  for (const patch of [{ apiOrigin: "https://api.404tradeos.com" }, { webOrigin: "https://app.404tradeos.com" }]) {
    await assert.rejects(
      collectRuntimeIdentity({ webOrigin: STAGING_WEB, apiOrigin: STAGING_API, ...patch, fetchImpl: () => assert.fail("must not fetch") }),
      (error) => error instanceof DeploymentIdentityError && error.code === "IDENTITY_PRODUCTION_REFUSED",
    );
  }
});

test("collection plus verification is the pre-capture gate: a collected staging identity verifies", async () => {
  const found = await collectRuntimeIdentity({ webOrigin: STAGING_WEB, apiOrigin: STAGING_API, fetchImpl: transport() });
  assert.doesNotThrow(() => verifyDeploymentIdentity({ expected: expected(), observed: found }));
});

// --- verifyIdentityUnchanged (pre/post-capture) ---

test("pre/post-capture verification passes an unchanged identity and fails on any drift", () => {
  const before = verifyDeploymentIdentity({ expected: expected(), observed: observed() });
  const after = { ...before };
  assert.equal(verifyIdentityUnchanged(before, after), true);
  for (const field of ["commitSha", "environment", "backendHost", "supabaseProjectRef"]) {
    const drifted = { ...after, [field]: field === "commitSha" ? OTHER_SHA : "drifted" };
    throwsWithCode(() => verifyIdentityUnchanged(before, drifted), "IDENTITY_CHANGED");
  }
  throwsWithCode(
    () => verifyIdentityUnchanged({ ...before, id: "dpl_one" }, { ...after, id: "dpl_two" }),
    "IDENTITY_CHANGED",
  );
  assert.equal(verifyIdentityUnchanged({ ...before, id: "dpl_one" }, { ...after, id: "dpl_one" }), true);
});
