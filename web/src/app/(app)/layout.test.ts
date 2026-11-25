import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutUrl = new URL("./layout.tsx", import.meta.url);
const apiUrl = new URL("../../lib/api.ts", import.meta.url);

test("workspace memberships fetch is never cached", async () => {
  const source = await readFile(apiUrl, "utf8");
  const fnIndex = source.indexOf("export function getWorkspaceMemberships");
  assert.notEqual(fnIndex, -1);
  const fnSource = source.slice(fnIndex, fnIndex + 400);
  // Per-user auth-scoped data: a cached response could serve one user's
  // memberships to another session, so the fetch must opt out explicitly.
  assert.ok(
    fnSource.includes('cache: "no-store"'),
    "getWorkspaceMemberships must pass cache: \"no-store\""
  );
});

test("workspace memberships lookup gets a realistic timeout budget", async () => {
  const source = await readFile(layoutUrl, "utf8");
  // GET /api/v1/auth/memberships takes 311–2202ms against the staging API
  // (Vercel runtime logs, 2026-11-24). The shared 1500ms advisory budget
  // aborted real lookups, and resolveWorkspaceMemberships fails closed to
  // [] on abort — which hides the workspace switcher for multi-workspace
  // users even though their memberships exist and the endpoint answered
  // 200. The memberships lookup must use its own larger budget.
  const match = source.match(/WORKSPACE_MEMBERSHIPS_TIMEOUT_MS = (\d+)/);
  assert.ok(match, "layout must define a dedicated memberships timeout");
  assert.ok(
    Number(match[1]) >= 5000,
    `memberships timeout must be >= 5000ms, got ${match[1]}`
  );
  assert.ok(
    source.includes("setTimeout(() => controller.abort(), WORKSPACE_MEMBERSHIPS_TIMEOUT_MS)"),
    "resolveWorkspaceMemberships must use the dedicated memberships timeout"
  );
});

test("settings identity lookup gets a realistic timeout budget", async () => {
  const source = await readFile(layoutUrl, "utf8");
  // GET /api/v1/settings backs the Create sheet's role gate. The shared
  // 1500ms advisory budget aborted real lookups on a slow production API
  // (2026-11-25: the layout's settings + capabilities lookups both failed
  // while the untimed page-data load of the same endpoint succeeded), and
  // resolveSettingsIdentity fails closed to role null — which renders the
  // Create sheet with zero options for an authenticated owner. The
  // settings lookup must use its own larger budget, matching the
  // memberships precedent (311–2202ms observed, 5000ms budget).
  const match = source.match(/SETTINGS_IDENTITY_TIMEOUT_MS = (\d+)/);
  assert.ok(match, "layout must define a dedicated settings-identity timeout");
  assert.ok(
    Number(match[1]) >= 5000,
    `settings-identity timeout must be >= 5000ms, got ${match[1]}`
  );
  assert.ok(
    source.includes("setTimeout(() => controller.abort(), SETTINGS_IDENTITY_TIMEOUT_MS)"),
    "resolveSettingsIdentity must use the dedicated settings-identity timeout"
  );
});

test("settings identity falls back to the session token role when the lookup fails", async () => {
  const source = await readFile(layoutUrl, "utf8");
  // The session token already carries the active role claim (and the
  // layout already trusts its orgId claim for the workspace remount key).
  // An advisory settings lookup failing must not brick presentation
  // gating for an authenticated owner: fall back to the token claims.
  // Server routes remain authoritative — this is presentation only.
  const fnIndex = source.indexOf("async function resolveSettingsIdentity");
  assert.notEqual(fnIndex, -1);
  const fnSource = source.slice(fnIndex, source.indexOf("\n}\n", fnIndex));
  // The catch must fall back to the claims already in the session token
  // (the no-token early return legitimately stays nulls — that is not a
  // failed lookup). The catch itself must never return bare nulls.
  const catchIndex = fnSource.indexOf("} catch {");
  assert.notEqual(catchIndex, -1, "resolveSettingsIdentity must have a catch block");
  const catchSource = fnSource.slice(catchIndex);
  assert.match(catchSource, /const claims = decodeLocalAccessToken\(token\);/);
  assert.match(catchSource, /claims\?\.role/);
  assert.match(catchSource, /claims\?\.orgId/);
  assert.doesNotMatch(catchSource, /return \{ role: null, orgId: null \}/);
});

test("AppLayout derives the remount key from the session token first", async () => {
  const source = await readFile(layoutUrl, "utf8");
  // The settings identity lookup fails closed to null after 1.5s, which
  // left the key stuck on "unknown" across a switch. The session token
  // carries the active orgId in its claims and is replaced atomically on a
  // switch, so it is the reliable identity source; the settings org is
  // only the fallback for tokens without the claim.
  assert.match(source, /decodeLocalAccessToken\(token\)\?\.orgId/);
  assert.match(source, /resolveWorkspaceKey\(\{\s*tokenOrgId: token \? decodeLocalAccessToken\(token\)\?\.orgId \?\? null : null,\s*settingsOrgId: identity\.orgId,\s*\}\)/);
  assert.match(source, /<div key=\{workspaceKey\}/);
  assert.doesNotMatch(source, /<div key=\{identity\.orgId \?\? "unknown"\}/);
});

test("AppLayout mounts the tenant query provider inside the keyed shell", async () => {
  const source = await readFile(layoutUrl, "utf8");
  const keyIndex = source.indexOf("<div key={workspaceKey}");
  assert.notEqual(keyIndex, -1);
  const providerIndex = source.indexOf("<TenantQueryProvider>", keyIndex);
  assert.notEqual(providerIndex, -1, "children must read through the tenant-scoped QueryClient");
  const childrenIndex = source.indexOf("{children}", providerIndex);
  assert.notEqual(childrenIndex, -1);
  assert.ok(childrenIndex < source.indexOf("</TenantQueryProvider>", providerIndex));
  // The root Providers' QueryClient survives switches by design, so the
  // tenant provider — not the root one — must serve (app) pages.
  assert.match(source, /import \{ TenantQueryProvider \} from "@\/components\/shared\/tenant-query-provider";/);
});
