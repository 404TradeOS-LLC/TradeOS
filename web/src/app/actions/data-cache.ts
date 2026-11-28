"use server";

import { updateTag } from "next/cache";
import { getSessionToken } from "@/lib/session";
import {
  buildDataCacheTag,
  isDataCacheNamespace,
  resolveDataCacheOrgId,
  type DataCacheNamespace,
} from "@/lib/data-cache-keys";

/**
 * Fluid plan Lever 2, change 2.5 — invalidate the org-scoped server Data
 * Cache entries for the given reference namespaces after a mutation.
 *
 * The tag is org-scoped (`<namespace>:<orgId>`), so one org's edit never
 * evicts another org's warm cache. `updateTag` is the Next 16 server-action
 * invalidation API — `revalidateTag` without a second argument is
 * deprecated in this Next version. Sessions whose token carries no org
 * claim (a bare Supabase JWT in local dev) never populate the cache — the
 * getters fail closed to uncached fetches — so there is nothing to
 * invalidate and this returns without touching any tag.
 *
 * Knowledge stats/trades have no invalidation call: the backend snapshot
 * they read is built once per backend process and no production writer
 * resets it (`resetKnowledgeRepositoryCache` is test-only), so the 300 s
 * TTL is the only freshness mechanism and no web mutation can stale it.
 */
export async function revalidateOrgDataCache(namespaces: DataCacheNamespace[]): Promise<void> {
  const token = await getSessionToken();
  const orgId = token ? resolveDataCacheOrgId(token) : null;
  if (!orgId) return;
  for (const namespace of namespaces) {
    if (!isDataCacheNamespace(namespace)) continue;
    updateTag(buildDataCacheTag(namespace, orgId));
  }
}
