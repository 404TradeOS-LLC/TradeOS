import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..", "..");

// Faithful fake of next/cache's unstable_cache + updateTag, replicating the
// installed Next 16.4.6 key computation
// (node_modules/next/dist/server/web/spec-extension/unstable-cache.js):
//   fixedKey = cb.toString() + "-" + keyParts.join(",")
//   invocationKey = fixedKey + "-" + JSON.stringify(args)
// The fake stores entries in a Map keyed by that invocation key, expires
// them after the recorded revalidate TTL, and evicts by tag on updateTag —
// the same observable behavior the real incremental cache gives the
// getters, without needing a Next runtime.
type CacheEntry = { value: unknown; expiresAt: number; tags: string[] };
type UnstableCacheCall = { keyParts: string[]; revalidate: number | false | undefined; tags: string[] };

function createNextCacheFake() {
  const calls: UnstableCacheCall[] = [];
  const store = new Map<string, CacheEntry>();
  let now = 0;
  return {
    __calls: calls,
    __advanceTime(ms: number) {
      now += ms;
    },
    unstable_cache(
      cb: (...args: unknown[]) => unknown,
      keyParts?: string[],
      options?: { revalidate?: number | false; tags?: string[] },
    ) {
      const fixedKey = `${cb.toString()}-${(keyParts ?? []).join(",")}`;
      return async (...args: unknown[]) => {
        const invocationKey = `${fixedKey}-${JSON.stringify(args)}`;
        const entry = store.get(invocationKey);
        if (entry && entry.expiresAt > now) return entry.value;
        const value = await cb(...args);
        const revalidate = options?.revalidate;
        store.set(invocationKey, {
          value,
          expiresAt: typeof revalidate === "number" ? now + revalidate * 1000 : Number.POSITIVE_INFINITY,
          tags: options?.tags ?? [],
        });
        calls.push({ keyParts: keyParts ?? [], revalidate, tags: options?.tags ?? [] });
        return value;
      };
    },
    updateTag(tag: string) {
      for (const [key, entry] of store) {
        if (entry.tags.includes(tag)) store.delete(key);
      }
    },
  };
}

// Load web/src/lib/data-cache.ts in a vm with next/cache + server-only
// stubbed, following the pattern in
// web/src/app/api/proxy/[...path]/route.test.ts. data-cache.ts imports
// ./data-cache-keys, which imports ./local-auth; both are plain modules
// loaded recursively through the same stubbed require.
function loadDataCache(nextCache: ReturnType<typeof createNextCacheFake>) {
  const modules = new Map<string, Record<string, unknown>>();
  const load = (specifier: string, importerPath: string): Record<string, unknown> => {
    if (specifier === "next/cache") return nextCache as unknown as Record<string, unknown>;
    if (specifier === "server-only") return {};
    const resolved = specifier.startsWith("./") ? resolve(dirname(importerPath), specifier) : specifier;
    const path = resolved.endsWith(".ts") ? resolved : `${resolved}.ts`;
    if (modules.has(path)) return modules.get(path)!;
    const source = readFileSync(path, "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    });
    const moduleExports: Record<string, unknown> = {};
    modules.set(path, moduleExports);
    const localRequire = (dep: string) => load(dep, path);
    const context = vm.createContext({
      require: localRequire,
      module: { exports: moduleExports },
      exports: moduleExports,
      console,
      process,
      Buffer,
      setTimeout,
      clearTimeout,
      atob: (s: string) => Buffer.from(s, "base64").toString("binary"),
    });
    vm.runInContext(outputText, context, { filename: path });
    return moduleExports;
  };
  return load("./data-cache", join(webRoot, "src", "lib", "data-cache.ts")) as {
    cachedDataFetch: <T>(
      namespace: string,
      orgId: string,
      paramsKey: string,
      fetchFn: () => Promise<T>,
    ) => Promise<T>;
  };
}

describe("cachedDataFetch two-tenant behavior (Fluid PR-6, change 2.5)", () => {
  it("keeps tenants apart: a warm entry for org A is never returned for org B", async () => {
    const nextCache = createNextCacheFake();
    const { cachedDataFetch } = loadDataCache(nextCache);
    const fetches: string[] = [];
    const fetchOrg = async (org: string) => {
      fetches.push(org);
      return { org, rows: [`${org}-division`] };
    };
    const a1 = await cachedDataFetch("costbook-divisions", "org-a", "", () => fetchOrg("org-a"));
    const a2 = await cachedDataFetch("costbook-divisions", "org-a", "", () => fetchOrg("org-a"));
    const b1 = await cachedDataFetch("costbook-divisions", "org-b", "", () => fetchOrg("org-b"));
    const b2 = await cachedDataFetch("costbook-divisions", "org-b", "", () => fetchOrg("org-b"));
    assert.deepEqual(a1, { org: "org-a", rows: ["org-a-division"] });
    assert.deepEqual(a2, a1, "repeat request for org A is a cache hit");
    assert.deepEqual(b1, { org: "org-b", rows: ["org-b-division"] });
    assert.deepEqual(b2, b1, "repeat request for org B is a cache hit");
    assert.deepEqual(fetches, ["org-a", "org-b"], "each org fetches exactly once");
  });

  it("separates list queries by paramsKey and records the plan TTL and org-scoped tag", async () => {
    const nextCache = createNextCacheFake();
    const { cachedDataFetch } = loadDataCache(nextCache);
    let fetches = 0;
    const fetchPage = async (q: string) => {
      fetches++;
      return { q };
    };
    await cachedDataFetch("costbook-materials", "org-a", "?page=1", () => fetchPage("?page=1"));
    await cachedDataFetch("costbook-materials", "org-a", "?page=1", () => fetchPage("?page=1"));
    await cachedDataFetch("costbook-materials", "org-a", "?page=2", () => fetchPage("?page=2"));
    assert.equal(fetches, 2, "page 1 is a hit on repeat, page 2 is a separate miss");
    assert.equal(nextCache.__calls.length, 2);
    assert.equal(nextCache.__calls[0].revalidate, 120);
    // Spread the vm-realm arrays into this realm before deep-equal: the
    // fake's arrays carry the vm context's Array prototype.
    assert.deepEqual([...nextCache.__calls[0].tags], ["costbook-materials:org-a"]);
    assert.deepEqual([...nextCache.__calls[0].keyParts], ["costbook-materials", "org-a", "?page=1"]);
  });

  it("never puts the token in the cache key: the fetcher takes no arguments", async () => {
    const nextCache = createNextCacheFake();
    const { cachedDataFetch } = loadDataCache(nextCache);
    const token = "secret-session-token-org-a";
    let seenToken: string | undefined;
    await cachedDataFetch("knowledge-stats", "org-a", "", async () => {
      // The token lives only in this closure, never in the key.
      seenToken = token;
      return { ok: true };
    });
    const parts = [...nextCache.__calls[0].keyParts];
    assert.ok(parts.includes("org-a"), "key parts carry the orgId");
    assert.ok(!parts.join(",").includes(token), "key parts must never carry the token");
    assert.equal(seenToken, token);
  });

  it("expires entries after the TTL and revalidates per-org via updateTag", async () => {
    const nextCache = createNextCacheFake();
    const { cachedDataFetch } = loadDataCache(nextCache);
    let fetches = 0;
    const fetchDivisions = async (org: string) => {
      fetches++;
      return { org, n: fetches };
    };
    const first = await cachedDataFetch("costbook-divisions", "org-a", "", () => fetchDivisions("org-a"));
    const second = await cachedDataFetch("costbook-divisions", "org-a", "", () => fetchDivisions("org-a"));
    assert.deepEqual(first, second, "within the TTL the entry is a hit");
    nextCache.__advanceTime(121_000);
    const third = await cachedDataFetch("costbook-divisions", "org-a", "", () => fetchDivisions("org-a"));
    assert.notDeepEqual(third, first, "after the 120 s TTL the entry refetches");
    // Warm org-b, then invalidate only org-a: org-b must stay warm.
    let bFetches = 0;
    const fetchB = async () => {
      bFetches++;
      return { org: "org-b" };
    };
    await cachedDataFetch("costbook-divisions", "org-b", "", fetchB);
    const fetchesBefore = fetches;
    const bFetchesBefore = bFetches;
    nextCache.updateTag("costbook-divisions:org-a");
    await cachedDataFetch("costbook-divisions", "org-a", "", () => fetchDivisions("org-a"));
    await cachedDataFetch("costbook-divisions", "org-b", "", fetchB);
    assert.equal(fetches, fetchesBefore + 1, "org-a refetched after its tag was invalidated");
    assert.equal(bFetches, bFetchesBefore, "org-b stayed cached after org-a's tag was invalidated");
  });
});
