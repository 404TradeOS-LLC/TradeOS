import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDataCacheKeyParts,
  buildDataCacheTag,
  DATA_CACHE_NAMESPACES,
  DATA_CACHE_TTLS,
  isDataCacheNamespace,
  resolveDataCacheOrgId,
} from "./data-cache-keys.ts";

// A backend-issued local session token: header.payload.signature with a
// base64url JSON payload carrying the org claim.
function encodeToken(payload: Record<string, unknown>): string {
  const segment = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${segment}.signature`;
}

describe("data-cache keys (Fluid PR-6, change 2.5)", () => {
  it("covers exactly the eleven plan getters — no auth, memberships, money, queue, or onboarding namespace", () => {
    assert.deepEqual([...DATA_CACHE_NAMESPACES].sort(), [
      "brand-studio-assets",
      "brand-studio-document-settings",
      "brand-studio-preview",
      "brand-studio-profile",
      "costbook-categories",
      "costbook-divisions",
      "costbook-labor-rates",
      "costbook-materials",
      "costbook-subcategories",
      "knowledge-stats",
      "knowledge-trades",
    ]);
    assert.equal(DATA_CACHE_NAMESPACES.length, 11);
    for (const forbidden of [
      "auth",
      "memberships",
      "workspace-memberships",
      "payments",
      "invoices",
      "queue",
      "onboarding",
      "abc-catalog",
    ]) {
      assert.equal(isDataCacheNamespace(forbidden), false, `${forbidden} must never be a Data Cache namespace`);
    }
  });

  it("uses the plan TTLs: 120 s for costbook lists, 300 s for knowledge and brand-studio", () => {
    for (const ns of [
      "costbook-divisions",
      "costbook-categories",
      "costbook-subcategories",
      "costbook-materials",
      "costbook-labor-rates",
    ] as const) {
      assert.equal(DATA_CACHE_TTLS[ns], 120, ns);
    }
    for (const ns of [
      "knowledge-stats",
      "knowledge-trades",
      "brand-studio-profile",
      "brand-studio-assets",
      "brand-studio-document-settings",
      "brand-studio-preview",
    ] as const) {
      assert.equal(DATA_CACHE_TTLS[ns], 300, ns);
    }
  });

  it("resolves the orgId from the session token's org claim", () => {
    const token = encodeToken({
      sub: "user-1",
      orgId: "org-a",
      role: "owner",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    assert.equal(resolveDataCacheOrgId(token), "org-a");
  });

  it("returns null when the token carries no org claim (bare Supabase JWT) or is malformed", () => {
    assert.equal(resolveDataCacheOrgId(encodeToken({ sub: "user-1", exp: 9999999999 })), null);
    assert.equal(resolveDataCacheOrgId("not-a-token"), null);
    assert.equal(resolveDataCacheOrgId(""), null);
  });

  it("keys separate tenants, namespaces, and list queries", () => {
    const a = buildDataCacheKeyParts("costbook-divisions", "org-a", "?page=1");
    const b = buildDataCacheKeyParts("costbook-divisions", "org-b", "?page=1");
    const c = buildDataCacheKeyParts("costbook-divisions", "org-a", "?page=2");
    const d = buildDataCacheKeyParts("costbook-categories", "org-a", "?page=1");
    const aAgain = buildDataCacheKeyParts("costbook-divisions", "org-a", "?page=1");
    assert.deepEqual(a, aAgain);
    assert.notDeepEqual(a, b, "a different org must not share an entry");
    assert.notDeepEqual(a, c, "a different list query must not share an entry");
    assert.notDeepEqual(a, d, "a different resource must not share an entry");
    assert.ok(a.includes("org-a"), "key parts must carry the orgId");
    assert.ok(a.includes("costbook-divisions"), "key parts must carry the namespace");
  });

  it("tags are org-scoped: one org's invalidation never names another org", () => {
    assert.equal(buildDataCacheTag("costbook-divisions", "org-a"), "costbook-divisions:org-a");
    assert.notEqual(
      buildDataCacheTag("costbook-divisions", "org-a"),
      buildDataCacheTag("costbook-divisions", "org-b"),
    );
    assert.notEqual(
      buildDataCacheTag("costbook-divisions", "org-a"),
      buildDataCacheTag("costbook-materials", "org-a"),
    );
  });
});
