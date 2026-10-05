import assert from "node:assert/strict";
import test from "node:test";
import { INVALID_SUPABASE_PROBE_TOKEN, assertStagingDeployment, ensureStagingFixtureSecret, repairStagingBackend, selectStagingDeployment } from "../staging-repair.mjs";

const sha = "a".repeat(40);
const projectId = "prj_BVJxF6rnO90wMdNjZ1Yn4QO1aGwD";
const teamId = "team_nY1VrcaEYEr4rcW7Gxweq7LP";
const deployment = (overrides = {}) => ({
  id: "dpl_staging", projectId, ownerId: teamId, name: "tradeos-costbook",
  target: null, readyState: "READY", createdAt: 10,
  url: "tradeos-costbook-example-billykshowalters.vercel.app",
  meta: { githubCommitRef: "staging", githubCommitSha: sha, githubOrg: "404TradeOS-LLC", githubRepo: "TradeOS" },
  ...overrides,
});

test("selects the exact staging commit rather than the first READY Preview", () => {
  const wrong = deployment({ id: "dpl_wrong", createdAt: 100, meta: { ...deployment().meta, githubCommitRef: "other" } });
  const stale = deployment({ id: "dpl_stale", meta: { ...deployment().meta, githubCommitSha: "b".repeat(40) } });
  assert.equal(selectStagingDeployment([wrong, stale, deployment()], sha).id, "dpl_staging");
  assert.equal(selectStagingDeployment([wrong, stale], sha), null);
});

test("rejects production, foreign project/team/repository, unexpected SHA, and unsafe URL", () => {
  for (const overrides of [
    { target: "production" }, { projectId: "prj_other" }, { ownerId: "team_other" },
    { meta: { ...deployment().meta, githubOrg: "other" } },
    { meta: { ...deployment().meta, githubCommitSha: "b".repeat(40) } },
    { url: "app.404tradeos.com" }, { url: "evil.example/?token=secret" },
  ]) assert.throws(() => assertStagingDeployment(deployment(overrides), sha));
});

function runner({ healthSha = sha, ready = "ok", bootstrap = 401, fixtureStatus = 200, redirect = false, replacement = {}, sourceAvailable = true, forceGitSource = false } = {}) {
  const calls = [];
  const api = async (route, init = {}) => {
    calls.push({ route, init });
    if (route.startsWith("/v7/deployments")) return { deployments: sourceAvailable ? [deployment()] : [] };
    if (init.method === "POST") return { id: "dpl_replacement" };
    return deployment({ id: route.includes("dpl_replacement") ? "dpl_replacement" : "dpl_staging", ...replacement });
  };
  const request = async (url, init) => {
    calls.push({ url: String(url), init });
    if (redirect) return new Response(null, { status: 302, headers: { location: "https://other.example" } });
    if (String(url).endsWith("/health")) return Response.json({ status: "ok", commitSha: healthSha });
    if (String(url).endsWith("/ready")) return Response.json({ status: "ready", checks: { database: { status: ready }, schema: { status: "ok" } } });
    if (String(url).includes("/api/v1/estimates/")) return Response.json({}, { status: fixtureStatus });
    return Response.json({}, { status: bootstrap });
  };
  return {
    calls,
    run: () => repairStagingBackend({
      expectedSha: sha,
      api,
      request,
      fixtureSecret: "f".repeat(48),
      forceGitSource,
      pause: async () => {},
    }),
  };
}

test("redeploys by verified ID and proves runtime on that replacement's immutable host", async () => {
  const r = runner();
  const result = await r.run();
  assert.equal(result.deploymentId, "dpl_replacement");
  const mutation = r.calls.find(c => c.init.method === "POST" && c.route);
  assert.deepEqual(JSON.parse(mutation.init.body), {
    deploymentId: "dpl_staging", name: "tradeos-costbook", project: projectId,
  });
  const requests = r.calls.filter(c => c.url);
  assert.equal(requests.length, 4);
  assert.ok(requests.every(c => new URL(c.url).hostname === deployment().url && c.init.redirect === "error"));
  assert.ok(requests.slice(0, 2).every(c => !c.init.headers?.Authorization));
  assert.equal(requests[2].init.headers.Authorization, "Bearer " + INVALID_SUPABASE_PROBE_TOKEN);
  assert.equal(requests[3].init.headers.Authorization, "Bearer " + "f".repeat(48));
  assert.equal(JSON.parse(Buffer.from(INVALID_SUPABASE_PROBE_TOKEN.split(".")[0], "base64url")).alg, "ES256");
  assert.equal(result.invalidSupabaseTokenBootstrap, 401);
  assert.equal(result.fixtureAuthentication, "verified");
});

test("never certifies stale health, failed database, missing auth issuer, or redirects", async () => {
  for (const options of [{ healthSha: "b".repeat(40) }, { ready: "error" }, { bootstrap: 500 }, { fixtureStatus: 401 }, { redirect: true }]) {
    await assert.rejects(runner(options).run());
  }
});

test("refuses a replacement that crosses the Preview boundary", async () => {
  await assert.rejects(runner({ replacement: { target: "production" } }).run());
});

test("recovers a missing deployment from staging only and rejects a branch SHA race", async () => {
  const r = runner({ sourceAvailable: false });
  await r.run();
  const mutation = r.calls.find(c => c.init.method === "POST" && c.route);
  assert.deepEqual(JSON.parse(mutation.init.body), {
    name: "tradeos-costbook", project: projectId,
    gitSource: { type: "github", org: "404TradeOS-LLC", repo: "TradeOS", ref: "staging" },
    env: { TRADEOS_STAGING_FIXTURE_SECRET: "f".repeat(48) },
    projectSettings: { commandForIgnoringBuildStep: "exit 1" },
  });
  await assert.rejects(runner({ sourceAvailable: false, replacement: { meta: { ...deployment().meta, githubCommitSha: "b".repeat(40) } } }).run());
});


test("provisions one encrypted staging-only fixture secret and reuses only the managed value", async () => {
  const calls = [];
  const api = async (route, init = {}) => {
    calls.push({ route, init });
    if (!init.method) return { envs: [] };
    return { created: [{ id: "env_fixture" }] };
  };
  const created = await ensureStagingFixtureSecret({ api, makeSecret: () => "z".repeat(48) });
  assert.deepEqual(created, { value: "z".repeat(48), created: true });
  const mutation = calls.find(call => call.init.method === "POST");
  const body = JSON.parse(mutation.init.body);
  assert.equal(body.key, "TRADEOS_STAGING_FIXTURE_SECRET");
  assert.equal(body.type, "encrypted");
  assert.deepEqual(body.target, ["preview"]);
  assert.equal(body.gitBranch, "staging");
  assert.equal(body.value, "z".repeat(48));

  const existing = await ensureStagingFixtureSecret({
    api: async () => ({
      envs: [{
        key: "TRADEOS_STAGING_FIXTURE_SECRET",
        value: "q".repeat(48),
        target: ["preview"],
        gitBranch: "staging",
        comment: "Managed staging-only synthetic fixture bearer; do not expose in logs or artifacts.",
      }],
    }),
  });
  assert.deepEqual(existing, { value: "q".repeat(48), created: false });
});

test("refuses operator-owned or weak staging fixture secrets", async () => {
  await assert.rejects(() => ensureStagingFixtureSecret({
    api: async () => ({ envs: [{
      key: "TRADEOS_STAGING_FIXTURE_SECRET",
      value: "q".repeat(48),
      target: ["preview"],
      gitBranch: "staging",
      comment: "operator-owned",
    }] }),
  }));
  await assert.rejects(() => ensureStagingFixtureSecret({
    api: async () => ({ envs: [{
      key: "TRADEOS_STAGING_FIXTURE_SECRET",
      value: "short",
      target: ["preview"],
      gitBranch: "staging",
      comment: "Managed staging-only synthetic fixture bearer; do not expose in logs or artifacts.",
    }] }),
  }));
});
