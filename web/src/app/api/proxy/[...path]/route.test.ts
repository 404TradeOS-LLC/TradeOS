import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { getProxyCacheControl, getProxyCacheMaxAge } from "../../../../lib/proxy-cache.ts";
import { shouldRejectProxyMutation } from "../../../../lib/proxy-origin.ts";

// Behavioral coverage for Fluid PR-2 (PR #1149) CodeRabbit finding: an
// upstream error on an allowlisted GET must never take the allowlist TTL.
// A 503 from /athena/capabilities during a backend outage would otherwise
// stay in the browser cache for 300 s and keep serving the error after
// recovery. The route therefore sets cacheMaxAge to null unless
// upstream.ok. Loads the route the same way the receipt-route tests do
// (transpile + vm with the session/proxy deps stubbed), so the header
// asserted here is the one the handler actually builds.

async function loadRoute(upstreamStatus: number) {
  const source = await readFile(new URL("./route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: Record<string, unknown> = {};
  const calls: string[] = [];
  const upstreamBody = upstreamStatus === 200 ? JSON.stringify({ ok: true }) : JSON.stringify({ error: "unavailable" });
  vm.runInNewContext(compiled, {
    exports,
    Response,
    Request,
    Headers,
    URL,
    process,
    fetch: async (url: string) => {
      calls.push(url);
      return new Response(upstreamBody, {
        status: upstreamStatus,
        headers: { "content-type": "application/json" },
      });
    },
    require(specifier: string) {
      if (specifier === "@/lib/session") return { getSessionToken: async () => "test-token" };
      if (specifier === "@/lib/proxy-cache") return { getProxyCacheMaxAge, getProxyCacheControl };
      if (specifier === "@/lib/proxy-origin") return { shouldRejectProxyMutation };
      if (specifier === "next/server") return {};
      throw new Error("Unexpected proxy route dependency: " + specifier);
    },
  });
  const GET = exports.GET as (
    request: unknown,
    context: { params: Promise<{ path: string[] }> },
  ) => Promise<Response>;
  const request = {
    method: "GET",
    url: "https://tradeos.example/api/proxy/athena/capabilities",
    headers: new Headers(),
    signal: undefined,
    nextUrl: new URL("https://tradeos.example/api/proxy/athena/capabilities"),
  };
  return {
    calls,
    get: () => GET(request, { params: Promise.resolve({ path: ["athena", "capabilities"] }) }),
  };
}

test("a 503 on an allowlisted GET returns no-store, not the allowlist TTL", async () => {
  const route = await loadRoute(503);
  const result = await route.get();
  assert.equal(result.status, 503);
  assert.equal(result.headers.get("Cache-Control"), "no-store");
  assert.equal(result.headers.get("Vary"), null);
  assert.ok(route.calls[0]?.includes("/api/v1/athena/capabilities"));
});

test("a 200 on the same allowlisted GET keeps the private allowlist TTL", async () => {
  const route = await loadRoute(200);
  const result = await route.get();
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("Cache-Control"), "private, max-age=300");
  assert.equal(result.headers.get("Vary"), "Cookie");
});
