import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutUrl = new URL("./layout.tsx", import.meta.url);
const apiUrl = new URL("../../lib/api.ts", import.meta.url);

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
