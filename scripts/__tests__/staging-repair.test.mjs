import assert from "node:assert/strict";
import test from "node:test";
import { INVALID_SUPABASE_PROBE_TOKEN, assertStagingDeployment, repairStagingBackend, selectStagingDeployment } from "../staging-repair.mjs";

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

function runner({ healthSha = sha, ready = "ok", bootstrap = 401, redirect = false, replacement = {}, sourceAvailable = true } = {}) {
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
    return Response.json({}, { status: bootstrap });
  };
  return { calls, run: () => repairStagingBackend({ expectedSha: sha, api, request, pause: async () => {} }) };
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
  assert.equal(requests.length, 3);
  assert.ok(requests.every(c => new URL(c.url).hostname === deployment().url && c.init.redirect === "error"));
  assert.ok(requests.slice(0, 2).every(c => !c.init.headers?.Authorization));
  assert.equal(requests[2].init.headers.Authorization, "Bearer " + INVALID_SUPABASE_PROBE_TOKEN);
  assert.equal(JSON.parse(Buffer.from(INVALID_SUPABASE_PROBE_TOKEN.split(".")[0], "base64url")).alg, "ES256");
  assert.equal(result.invalidSupabaseTokenBootstrap, 401);
});

test("never certifies stale health, failed database, missing auth issuer, or redirects", async () => {
  for (const options of [{ healthSha: "b".repeat(40) }, { ready: "error" }, { bootstrap: 500 }, { redirect: true }]) {
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
    projectSettings: { commandForIgnoringBuildStep: "exit 1" },
  });
  await assert.rejects(runner({ sourceAvailable: false, replacement: { meta: { ...deployment().meta, githubCommitSha: "b".repeat(40) } } }).run());
});
