import { decodeLocalAccessToken } from "./local-auth.ts";

// Fluid plan Lever 2, change 2.5 — server Data Cache key/tag design
// (~/workspace/vercel-fluid-cpu-fix-plan.md §3).
//
// The Data Cache is shared across requests and users, so the cache key MUST
// carry the tenant. Every 2.5 getter is org-scoped — the backend resolves
// the org from the session and the read handlers take only auth.orgId
// (costbook lists, brand-studio reads) — or global reference data (the
// knowledge stats/trades snapshot, identical for every org). None of the
// eleven varies by the caller's role: the backend read paths take no role
// input, so orgId alone separates tenants and no userId is needed in the
// key. Per-user, queue, money, and auth paths are NEVER cached here —
// getWorkspaceMemberships stays cache: "no-store" (asserted in
// web/src/app/(app)/layout.test.ts).
//
// The orgId comes from the session token's org claim (the backend signs the
// active orgId into every token it issues; a workspace switch replaces the
// token). Sessions whose token carries no org claim (a bare Supabase JWT in
// local dev) never populate the cache — the getters fail closed to an
// uncached fetch — so there is no key under which a cross-tenant entry
// could be written.

// TTLs from the plan's allowlist table: reference lists 120 s, knowledge
// aggregates and brand-studio getters 300 s.
export const DATA_CACHE_TTLS = {
  "costbook-divisions": 120,
  "costbook-categories": 120,
  "costbook-subcategories": 120,
  "costbook-materials": 120,
  "costbook-labor-rates": 120,
  "knowledge-stats": 300,
  "knowledge-trades": 300,
  "brand-studio-profile": 300,
  "brand-studio-assets": 300,
  "brand-studio-document-settings": 300,
  "brand-studio-preview": 300,
} as const;

export type DataCacheNamespace = keyof typeof DATA_CACHE_TTLS;

export const DATA_CACHE_NAMESPACES = Object.keys(DATA_CACHE_TTLS) as DataCacheNamespace[];

export function isDataCacheNamespace(value: string): value is DataCacheNamespace {
  return (Object.keys(DATA_CACHE_TTLS) as string[]).includes(value);
}

export function resolveDataCacheOrgId(token: string): string | null {
  return decodeLocalAccessToken(token)?.orgId ?? null;
}

// Key parts for unstable_cache: [namespace, orgId, paramsKey]. The
// namespace keeps structurally identical fetchers apart (two getters whose
// closures minify to the same source still land in different entries), the
// orgId keeps tenants apart, and the paramsKey (the deterministic
// buildCostbookQuery string, "" for unparameterized getters) keeps
// different list queries apart.
export function buildDataCacheKeyParts(namespace: DataCacheNamespace, orgId: string, paramsKey = ""): string[] {
  return [namespace, orgId, paramsKey];
}

// One tag per (namespace, org): a mutation revalidates only its own org's
// entries for that resource, never another org's warm cache.
export function buildDataCacheTag(namespace: DataCacheNamespace, orgId: string): string {
  return `${namespace}:${orgId}`;
}
