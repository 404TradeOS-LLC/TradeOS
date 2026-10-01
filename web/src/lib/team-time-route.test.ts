import test from "node:test";
import assert from "node:assert/strict";
import { createTeamTimePostHandler } from "./team-time-route.ts";

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://qfbgdkbamfaasmtjfyru.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test-key",
};
const action = JSON.stringify({ action: "clock_in", jobId: "job-1" });
const request = (body = action, origin: string | null = "https://app.test") => new Request("https://app.test/api/team-time", {
  method: "POST",
  headers: { ...(origin === null ? {} : { origin }), "Content-Type": "application/json" },
  body,
});
const handler = (overrides: Partial<Parameters<typeof createTeamTimePostHandler>[0]> = {}) => createTeamTimePostHandler({
  isEnabled: () => true,
  getAccessToken: async () => "user-jwt",
  env,
  fetchImpl: async () => Response.json({ ok: true }),
  ...overrides,
});

test("disabled feature denies before touching the session or upstream", async () => {
  let sessionReads = 0;
  const post = handler({ isEnabled: () => false, getAccessToken: async () => { sessionReads += 1; return "user-jwt"; } });
  assert.equal((await post(request())).status, 404);
  assert.equal(sessionReads, 0);
});

test("missing, malformed, and cross-origin requests are rejected before auth", async () => {
  let sessionReads = 0;
  const post = handler({ getAccessToken: async () => { sessionReads += 1; return "user-jwt"; } });
  assert.equal((await post(request(action, null))).status, 403);
  assert.equal((await post(request(action, "not a url"))).status, 403);
  assert.equal((await post(request(action, "https://other.test"))).status, 403);
  assert.equal(sessionReads, 0);
});

test("malformed, oversized, and unsupported actions are rejected", async () => {
  const post = handler();
  assert.equal((await post(request("{"))).status, 400);
  assert.equal((await post(request(JSON.stringify({ action: "delete_everything" })))).status, 400);
  assert.equal((await post(request(JSON.stringify({ action: "clock_in", note: "💪".repeat(6000) })))).status, 413);
});

test("unauthenticated requests are denied and upstream is not called", async () => {
  let upstreamCalls = 0;
  const post = handler({ getAccessToken: async () => null, fetchImpl: async () => { upstreamCalls += 1; return Response.json({}); } });
  assert.equal((await post(request())).status, 401);
  assert.equal(upstreamCalls, 0);
});

test("missing Supabase configuration fails safely", async () => {
  let sessionReads = 0;
  const post = handler({ env: {}, getAccessToken: async () => { sessionReads += 1; return "user-jwt"; } });
  assert.equal((await post(request())).status, 503);
  assert.equal(sessionReads, 0);
});

test("upstream request carries only the authenticated session and relays status/body", async () => {
  let observed: { url: URL; init: RequestInit } | null = null;
  const post = handler({ fetchImpl: async (input, init) => {
    observed = { url: new URL(String(input)), init: init ?? {} };
    return new Response('{"error":"upstream rejected"}', { status: 409, headers: { "Content-Type": "application/problem+json" } });
  } });
  const response = await post(request());
  assert.equal(response.status, 409);
  assert.equal(response.headers.get("content-type"), "application/problem+json");
  assert.equal(await response.text(), '{"error":"upstream rejected"}');
  assert.equal(observed?.url.toString(), "https://qfbgdkbamfaasmtjfyru.supabase.co/functions/v1/team-time");
  assert.deepEqual(JSON.parse(String(observed?.init.body)), { action: "clock_in", jobId: "job-1" });
  assert.equal(new Headers(observed?.init.headers).get("authorization"), "Bearer user-jwt");
  assert.equal(new Headers(observed?.init.headers).get("apikey"), "public-test-key");
  assert.equal(observed?.init.cache, "no-store");
  assert.ok(observed?.init.signal);
});

test("upstream failures return a safe error and timeouts tell the worker to verify state before retry", async () => {
  const unavailable = handler({ fetchImpl: async () => { throw new Error("internal network detail"); } });
  assert.equal((await unavailable(request())).status, 503);
  const timeout = handler({ timeoutMs: 1, fetchImpl: (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
  }) });
  const response = await timeout(request());
  assert.equal(response.status, 504);
  assert.match((await response.json()).error, /Refresh to confirm your latest action/);
});
