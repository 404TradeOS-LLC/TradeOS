import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutUrl = new URL("./layout.tsx", import.meta.url);

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
