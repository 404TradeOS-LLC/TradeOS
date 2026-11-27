import assert from "node:assert/strict";
import test from "node:test";
import { getProxyCacheControl, getProxyCacheMaxAge } from "./proxy-cache.ts";

test("allowlisted settings and capabilities GETs return their TTLs", () => {
  assert.equal(getProxyCacheMaxAge("GET", ["settings"]), 60);
  assert.equal(getProxyCacheMaxAge("GET", ["athena", "capabilities"]), 300);
});

test("allowlisted costbook GETs return their TTLs, including parameterized paths", () => {
  assert.equal(getProxyCacheMaxAge("GET", ["costbook", "assemblies", "starter-catalog"]), 300);
  assert.equal(getProxyCacheMaxAge("GET", ["costbook", "cost-items", "search"]), 60);
  assert.equal(getProxyCacheMaxAge("GET", ["costbook", "assemblies", "search"]), 60);
  assert.equal(getProxyCacheMaxAge("GET", ["costbook", "cost-items", "abc-123", "unit-cost"]), 60);
  assert.equal(getProxyCacheMaxAge("GET", ["costbook", "assemblies", "abc-123", "unit-cost"]), 60);
  assert.equal(getProxyCacheMaxAge("GET", ["costbook", "assemblies", "abc-123", "items"]), 60);
  assert.equal(getProxyCacheMaxAge("GET", ["costbook", "codes", "estimates", "est-1", "hints"]), 60);
});

test("allowlisted brand-studio, knowledge, dispatch-summary and estimate GETs return their TTLs", () => {
  for (const path of ["profile", "assets", "document-settings", "preview"]) {
    assert.equal(getProxyCacheMaxAge("GET", ["brand-studio", path]), 300);
  }
  assert.equal(getProxyCacheMaxAge("GET", ["knowledge", "stats"]), 300);
  assert.equal(getProxyCacheMaxAge("GET", ["knowledge", "trades"]), 300);
  assert.equal(getProxyCacheMaxAge("GET", ["jobs", "dispatch-summary"]), 30);
  assert.equal(getProxyCacheMaxAge("GET", ["estimates", "est-1"]), 30);
});

test("non-allowlisted GETs are never cached", () => {
  // Auth / token issuance.
  assert.equal(getProxyCacheMaxAge("GET", ["auth", "memberships"]), null);
  assert.equal(getProxyCacheMaxAge("GET", ["auth", "refresh"]), null);
  assert.equal(getProxyCacheMaxAge("GET", ["auth", "logout"]), null);
  // Money, status, and counts users act on.
  assert.equal(getProxyCacheMaxAge("GET", ["intelligence", "financial-summary"]), null);
  assert.equal(getProxyCacheMaxAge("GET", ["estimates"]), null);
  assert.equal(getProxyCacheMaxAge("GET", ["proposals"]), null);
  assert.equal(getProxyCacheMaxAge("GET", ["invoices"]), null);
  assert.equal(getProxyCacheMaxAge("GET", ["projects", "tasks"]), null);
  assert.equal(getProxyCacheMaxAge("GET", ["intelligence", "activity"]), null);
  assert.equal(getProxyCacheMaxAge("GET", ["jobs"]), null);
  assert.equal(getProxyCacheMaxAge("GET", ["athena", "approvals"]), null);
  assert.equal(getProxyCacheMaxAge("GET", ["schedule", "conflicts"]), null);
  assert.equal(getProxyCacheMaxAge("GET", ["onboarding", "state"]), null);
  // Live supplier data, customer portal, PDFs.
  assert.equal(getProxyCacheMaxAge("GET", ["costbook", "abc-catalog", "search"]), null);
  assert.equal(getProxyCacheMaxAge("GET", ["customer-portal", "invoices"]), null);
  // Server-side page loads: proxy Cache-Control cannot help them (plan 2.5).
  assert.equal(getProxyCacheMaxAge("GET", ["costbook", "divisions"]), null);
  assert.equal(getProxyCacheMaxAge("GET", ["costbook", "categories"]), null);
  assert.equal(getProxyCacheMaxAge("GET", ["costbook", "materials"]), null);
  assert.equal(getProxyCacheMaxAge("GET", ["costbook", "labor-rates"]), null);
});

test("parameterized patterns do not match the wrong shape", () => {
  // A bare id segment is not an allowlisted estimate read.
  assert.equal(getProxyCacheMaxAge("GET", ["estimates", "est-1", "lines"]), null);
  // "starter-catalog" in the id slot matches the parameterized items
  // pattern (assembly ids are UUIDs, so no real assembly is named that —
  // a request there 404s, and a cached 404 stays a 404). The literal
  // starter-catalog read itself is a different shape (3 segments).
  assert.equal(getProxyCacheMaxAge("GET", ["costbook", "assemblies", "starter-catalog", "items"]), 60);
  // Mapping suggestions and installs are never cached.
  assert.equal(
    getProxyCacheMaxAge("GET", ["costbook", "assemblies", "starter-catalog", "tpl-1", "mapping-suggestions"]),
    null,
  );
  assert.equal(getProxyCacheMaxAge("GET", ["costbook", "assemblies", "a-1", "items", "extra"]), null);
  // An empty id segment matches nothing.
  assert.equal(getProxyCacheMaxAge("GET", ["estimates", ""]), null);
  assert.equal(getProxyCacheMaxAge("GET", ["costbook", "cost-items", "", "unit-cost"]), null);
});

test("all non-GET methods are never cached, even on allowlisted paths", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "HEAD"]) {
    assert.equal(getProxyCacheMaxAge(method, ["settings"]), null);
    assert.equal(getProxyCacheMaxAge(method, ["costbook", "assemblies", "starter-catalog"]), null);
    assert.equal(getProxyCacheMaxAge(method, ["estimates", "est-1"]), null);
  }
  // The workspace switch itself must never be cached.
  assert.equal(getProxyCacheMaxAge("POST", ["auth", "select-organization"]), null);
});

test("cache-control is private with the TTL and never a shared cache", () => {
  assert.equal(getProxyCacheControl(60), "private, max-age=60");
  assert.equal(getProxyCacheControl(300), "private, max-age=300");
  assert.equal(getProxyCacheControl(30), "private, max-age=30");
  assert.doesNotMatch(getProxyCacheControl(60), /s-maxage|stale-while-revalidate/);
});
