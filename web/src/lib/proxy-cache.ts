// Browser-cache allowlist for the generic authenticated proxy
// (web/src/app/api/proxy/[...path]/route.ts) — Vercel Fluid CPU fix plan
// (2026-11-26), Lever 2 change 2.1.
//
// The proxy previously returned `Cache-Control: no-store` for every
// response, so every dashboard/builder navigation re-executed the proxy
// route handler (one Fluid invocation per read). For the GET paths listed
// here the browser may serve the response from its own cache for the TTL
// instead, so a repeat navigation never reaches the handler at all.
//
// Rules, all load-bearing for tenant isolation:
// - GET only. Every other method returns null (the route keeps `no-store`).
// - `private` only — never `s-maxage` / shared-CDN caching. The route
//   pairs the header with `Vary: Cookie`: a workspace switch issues a
//   fresh session token via POST /auth/select-organization (see
//   app/modules/auth/service.ts `selectOrganization` → `issueSession`, and
//   web/src/app/actions/auth.ts `switchWorkspaceAction`, which replaces
//   the local session cookies), so the cookie value separates org A from
//   org B in the same browser. Without `Vary: Cookie`, a plain
//   `private, max-age` on /settings would serve org A's cached settings
//   to org B after a switch.
// - No `stale-while-revalidate` in v1: SWR triggers a background
//   revalidation, i.e. still an invocation — it buys latency, not count.
// - Any upstream `Set-Cookie` on an allowlisted response must be stripped
//   by the route (a cached response must never carry a cookie).
//
// Do-not-cache (explicit, never add): GET /auth/memberships,
// /auth/refresh, /auth/logout, POST /auth/select-organization (per-user
// auth/token issuance); all non-GET methods; GET
// /intelligence/financial-summary, estimate/proposal/invoice queues,
// /projects/tasks, /intelligence/activity, /jobs dispatch lists,
// /athena/approvals, /schedule/conflicts (money, status, and counts users
// act on); GET /onboarding/state; GET /customer-portal/* and
// /api/documents/* (PDFs); GET /costbook/abc-catalog/* (live supplier
// data); anything returning `Set-Cookie`.
//
// NOTE: the costbook division/category/subcategory/material/labor-rate
// lists are server-side page loads, so proxy Cache-Control does not help
// them — they belong to the gated server Data Cache follow-up (plan
// change 2.5, PR-6), not this allowlist.

type CachePattern = {
  /** Path segments after /api/proxy; "{id}" matches one non-empty segment. */
  segments: string[];
  maxAgeSeconds: number;
};

const PROXY_CACHE_ALLOWLIST: readonly CachePattern[] = [
  { segments: ["settings"], maxAgeSeconds: 60 },
  { segments: ["athena", "capabilities"], maxAgeSeconds: 300 },
  { segments: ["costbook", "assemblies", "starter-catalog"], maxAgeSeconds: 300 },
  { segments: ["costbook", "cost-items", "search"], maxAgeSeconds: 60 },
  { segments: ["costbook", "assemblies", "search"], maxAgeSeconds: 60 },
  { segments: ["costbook", "cost-items", "{id}", "unit-cost"], maxAgeSeconds: 60 },
  { segments: ["costbook", "assemblies", "{id}", "unit-cost"], maxAgeSeconds: 60 },
  { segments: ["costbook", "assemblies", "{id}", "items"], maxAgeSeconds: 60 },
  { segments: ["costbook", "codes", "estimates", "{id}", "hints"], maxAgeSeconds: 60 },
  { segments: ["brand-studio", "profile"], maxAgeSeconds: 300 },
  { segments: ["brand-studio", "assets"], maxAgeSeconds: 300 },
  { segments: ["brand-studio", "document-settings"], maxAgeSeconds: 300 },
  { segments: ["brand-studio", "preview"], maxAgeSeconds: 300 },
  { segments: ["knowledge", "stats"], maxAgeSeconds: 300 },
  { segments: ["knowledge", "trades"], maxAgeSeconds: 300 },
  { segments: ["jobs", "dispatch-summary"], maxAgeSeconds: 30 },
  { segments: ["estimates", "{id}"], maxAgeSeconds: 30 },
];

function patternMatches(pattern: CachePattern, segments: readonly string[]): boolean {
  if (pattern.segments.length !== segments.length) return false;
  return pattern.segments.every((expected, index) => {
    const actual = segments[index];
    if (expected === "{id}") return actual.length > 0;
    return expected === actual;
  });
}

/**
 * Browser-cache TTL (seconds) for a proxy request, or null when the
 * response must stay `no-store`. `segments` are the catch-all path
 * segments after /api/proxy (i.e. the proxy-form path, without the
 * /api/v1 backend prefix). Query strings are not part of the match: the
 * browser cache keys on the full URL including the query, so per-query
 * results (e.g. cost-item search) stay separated.
 */
export function getProxyCacheMaxAge(method: string, segments: readonly string[]): number | null {
  if (method !== "GET") return null;
  for (const pattern of PROXY_CACHE_ALLOWLIST) {
    if (patternMatches(pattern, segments)) return pattern.maxAgeSeconds;
  }
  return null;
}

/** The `Cache-Control` value for an allowlisted response. */
export function getProxyCacheControl(maxAgeSeconds: number): string {
  return `private, max-age=${maxAgeSeconds}`;
}
