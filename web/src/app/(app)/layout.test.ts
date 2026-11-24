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
