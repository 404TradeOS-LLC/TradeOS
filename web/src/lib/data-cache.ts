import "server-only";
import { unstable_cache } from "next/cache";
import {
  buildDataCacheKeyParts,
  buildDataCacheTag,
  DATA_CACHE_TTLS,
  type DataCacheNamespace,
} from "./data-cache-keys.ts";

/**
 * Fluid plan Lever 2, change 2.5 — org-scoped server Data Cache fetch.
 *
 * Why the fetch is wrapped per call instead of once at module scope, and
 * why the token is never an argument: the installed Next 16.4.6
 * implementation
 * (node_modules/next/dist/server/web/spec-extension/unstable-cache.js)
 * builds the invocation key as
 * `fixedKey + "-" + JSON.stringify(args)` where
 * `fixedKey = cb.toString() + "-" + keyParts.join(",")` — the function
 * arguments are ALWAYS serialized into the key. Passing the session token
 * as an argument would put a secret in the key and shard the cache per
 * user (and per token rotation). Instead the fetcher is a zero-argument
 * closure over the caller's token, and the key parts carry
 * [namespace, orgId, paramsKey] (see data-cache-keys.ts). The closure is
 * only invoked on a cache miss or a background revalidation; the token is
 * used solely as the Authorization header for that fetch, and the stored
 * entry is the org-scoped response body. A background revalidation re-runs
 * the closure captured at the triggering request, so it carries a token
 * that was valid minutes earlier — if it has since expired, that
 * revalidation fails and the stale entry survives until the next request
 * triggers a revalidation with a fresh token.
 *
 * The wrapper is created fresh on every call on purpose: the fixed key is
 * computed from the closure source plus the key parts, both deterministic
 * per call site, so every call for the same (namespace, orgId, paramsKey)
 * addresses the same cache entry. There is no per-wrapper state.
 */
export async function cachedDataFetch<T>(
  namespace: DataCacheNamespace,
  orgId: string,
  paramsKey: string,
  fetchFn: () => Promise<T>,
): Promise<T> {
  const cached = unstable_cache(fetchFn, buildDataCacheKeyParts(namespace, orgId, paramsKey), {
    revalidate: DATA_CACHE_TTLS[namespace],
    tags: [buildDataCacheTag(namespace, orgId)],
  });
  return cached();
}
