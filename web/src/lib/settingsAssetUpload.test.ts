import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildSettingsAssetStoragePath,
  buildSettingsAssetStoragePrefix,
  generateSettingsAssetObjectName,
  isGeneratedSettingsAssetStoragePath,
  isAllowedSettingsAssetKey,
  isSafeOrgId,
  validateSettingsAssetUpload,
  selectSettingsAssetCleanupCandidates,
} from "./settingsAssetUpload.ts";

const validFile = { size: 1024, type: "image/png" };
const ORG_ID = "11111111-1111-1111-1111-111111111111";

test("rejects an unknown assetKey", () => {
  assert.equal(isAllowedSettingsAssetKey("brandLogoUrl"), false);
  assert.equal(isAllowedSettingsAssetKey("../etc/passwd"), false);
  assert.equal(isAllowedSettingsAssetKey(""), false);

  const error = validateSettingsAssetUpload({ assetKey: "somethingElse", file: validFile });
  assert.equal(error, "Unsupported asset field.");
});

test("accepts each of the four real settings asset keys", () => {
  for (const key of ["logoUrl", "darkLogoUrl", "iconUrl", "watermarkUrl"]) {
    assert.equal(isAllowedSettingsAssetKey(key), true);
    assert.equal(validateSettingsAssetUpload({ assetKey: key, file: validFile }), null);
  }
});

test("rejects non-image files and oversized files", () => {
  assert.equal(
    validateSettingsAssetUpload({ assetKey: "logoUrl", file: { size: 1024, type: "application/pdf" } }),
    "Brand assets must be PNG, JPEG, WebP, GIF, or ICO files."
  );

  assert.equal(
    validateSettingsAssetUpload({ assetKey: "logoUrl", file: { size: 1024, type: "image/svg+xml" } }),
    "Brand assets must be PNG, JPEG, WebP, GIF, or ICO files."
  );

  assert.equal(
    validateSettingsAssetUpload({ assetKey: "logoUrl", file: { size: 7 * 1024 * 1024, type: "image/png" } }),
    "Each brand asset must be 6MB or smaller."
  );
});

test("isSafeOrgId accepts only UUID-shaped strings", () => {
  assert.equal(isSafeOrgId(ORG_ID), true);
  assert.equal(isSafeOrgId("../../etc/passwd"), false);
  assert.equal(isSafeOrgId("not-a-uuid"), false);
  assert.equal(isSafeOrgId(""), false);
  assert.equal(isSafeOrgId(`${ORG_ID}/../other-org`), false);
});

test("generateSettingsAssetObjectName produces a fresh name every call, never reusing one", () => {
  const names = new Set(Array.from({ length: 20 }, () => generateSettingsAssetObjectName("logoUrl")));
  assert.equal(names.size, 20, "expected 20 distinct generated object names, got a collision");
  for (const name of names) {
    assert.match(name, /^logoUrl-[0-9a-f-]{36}$/i);
  }
});

test("buildSettingsAssetStoragePath is organization-scoped and varies by assetKey/org/object name", () => {
  const objectName = "logoUrl-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const path1 = buildSettingsAssetStoragePath(ORG_ID, "logoUrl", objectName);
  assert.equal(path1, `organizations/${ORG_ID}/brand-assets/${objectName}`);

  const otherOrgId = "22222222-2222-2222-2222-222222222222";
  assert.notEqual(buildSettingsAssetStoragePath(otherOrgId, "logoUrl", objectName), path1);

  const otherObjectName = generateSettingsAssetObjectName("logoUrl");
  assert.notEqual(buildSettingsAssetStoragePath(ORG_ID, "logoUrl", otherObjectName), path1);
});

test("buildSettingsAssetStoragePath rejects a non-UUID-shaped orgId (path-traversal hardening)", () => {
  assert.throws(() => buildSettingsAssetStoragePath("../../etc/passwd", "logoUrl", "logoUrl-x"));
  assert.throws(() => buildSettingsAssetStoragePath("", "logoUrl", "logoUrl-x"));
});

test("generated asset cleanup selects only stale non-current objects under the exact org prefix", () => {
  const current = buildSettingsAssetStoragePath(ORG_ID, "logoUrl", "logoUrl-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
  const prefix = buildSettingsAssetStoragePrefix(ORG_ID, "logoUrl").replace(/[^/]+$/, "");
  const selection = selectSettingsAssetCleanupCandidates({
    orgId: ORG_ID,
    assetKey: "logoUrl",
    currentStoragePath: current,
    now: Date.parse("2026-08-24T12:00:00.000Z"),
    graceMs: 60 * 60 * 1000,
    entries: [
      { name: "logoUrl-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", updated_at: "2026-08-24T09:00:00.000Z" },
      { name: "logoUrl-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", updated_at: "2026-08-24T09:00:00.000Z" },
      { name: "logoUrl-cccccccc-cccc-cccc-cccc-cccccccccccc", updated_at: "2026-08-24T11:30:00.000Z" },
      { name: "darkLogoUrl-dddddddd-dddd-dddd-dddd-dddddddddddd", updated_at: "2026-08-24T09:00:00.000Z" },
      { name: "logoUrl-not-a-uuid", updated_at: "2026-08-24T09:00:00.000Z" },
      { name: "logoUrl-eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee" },
    ],
  });
  assert.deepEqual(selection.candidates, [
    {
      assetKey: "logoUrl",
      storagePath: `${prefix}logoUrl-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`,
      updatedAt: "2026-08-24T09:00:00.000Z",
    },
  ]);
  assert.equal(selection.skipped, 5);
});

test("generated asset path ownership rejects traversal, other orgs, and unrelated object names", () => {
  assert.equal(
    isGeneratedSettingsAssetStoragePath(
      ORG_ID,
      "logoUrl",
      `organizations/${ORG_ID}/brand-assets/logoUrl-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`
    ),
    true
  );
  assert.equal(
    isGeneratedSettingsAssetStoragePath(
      ORG_ID,
      "logoUrl",
      `organizations/${ORG_ID}/brand-assets/logoUrl-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/../../other`
    ),
    false
  );
  assert.equal(
    isGeneratedSettingsAssetStoragePath(
      ORG_ID,
      "logoUrl",
      "organizations/22222222-2222-2222-2222-222222222222/brand-assets/logoUrl-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    ),
    false
  );
  assert.equal(
    isGeneratedSettingsAssetStoragePath(
      ORG_ID,
      "logoUrl",
      `organizations/${ORG_ID}/brand-assets/other-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`
    ),
    false
  );
});

test("no regression to existing project document storage behavior", () => {
  // actions/projects.ts is out of scope for this fix and must keep resolving
  // its object URL from the bucket's actual public/private state via the
  // anon-key client — proving this fix's server-only admin-client rework of
  // settings.ts was not also (accidentally) applied to project documents.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const projectsActionsPath = path.join(here, "..", "app", "actions", "projects.ts");
  const source = fs.readFileSync(projectsActionsPath, "utf8");

  const callSites = source.match(/buildStorageObjectUrl\([^)]*\)/g) ?? [];
  assert.equal(callSites.length, 2);
  for (const call of callSites) {
    assert.match(call, /isPublicStorageBucket\(\)/);
  }
});

// The tests below can't be exercised behaviorally (no jest/vitest/RTL/mock
// harness exists for `web/`'s Server Actions — see the framework-free
// node:test setup this whole file already uses), so instead they pin the
// *shape* of actions/settings.ts's source. Each one failing means a future
// edit silently removed a security-relevant guard without any other test
// catching it.
function readSettingsActionsSource(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, "..", "app", "actions", "settings.ts"), "utf8");
}

test("uploadSettingsAssetAction checks hasAnyPermission before the Supabase Storage upload call", () => {
  const source = readSettingsActionsSource();

  const permissionCheckIndex = source.indexOf("hasAnyPermission(currentRole");
  const uploadCallIndex = source.indexOf(".upload(storagePath");

  assert.notEqual(permissionCheckIndex, -1, "expected a hasAnyPermission(currentRole, ...) check in uploadSettingsAssetAction");
  assert.notEqual(uploadCallIndex, -1, "expected a Supabase Storage .upload(storagePath, ...) call in uploadSettingsAssetAction");
  assert.ok(
    permissionCheckIndex < uploadCallIndex,
    "hasAnyPermission must be checked before the Supabase Storage upload call, not after"
  );
});

test("uploadSettingsAssetAction never reads orgId from client-supplied formData", () => {
  // The only legitimate source of orgId is the authenticated
  // getOrganizationSettings(token) call. If a future edit started reading
  // orgId out of the submitted FormData instead, a crafted form submission
  // could target another organization's storage path — this pins that it
  // structurally can't happen.
  const source = readSettingsActionsSource();

  assert.doesNotMatch(source, /formData\.get\(\s*["']orgId["']\s*\)/);
  assert.match(source, /const\s*\{\s*orgId,\s*currentRole\s*\}\s*=\s*await\s*getOrganizationSettings\(token\)/);
});

test("uploadSettingsAssetAction and removeSettingsAssetAction use the server-only admin client, never the anon-key client", () => {
  // Storage mutations must go through createSupabaseAdminClient
  // (service_role, bypasses Storage RLS entirely) so authorization is
  // enforced by this file's own checks, not by Storage-level policies which
  // cannot distinguish one anon-key holder from another. Using the
  // anon/publishable client here (web/src/lib/supabase/server.ts, used
  // elsewhere for cookie-bound reads) would silently reopen the exact gap
  // this rework closes.
  const source = readSettingsActionsSource();

  assert.match(source, /createSupabaseAdminClient/);
  assert.doesNotMatch(source, /from ["']@\/lib\/supabase\/server["']/);
});

test("removeSettingsAssetAction requires the same admin permission check as upload", () => {
  const source = readSettingsActionsSource();
  const removeFnIndex = source.indexOf("export async function removeSettingsAssetAction");
  assert.notEqual(removeFnIndex, -1);

  const removeFnSource = source.slice(removeFnIndex);
  assert.match(removeFnSource, /hasAnyPermission\(currentRole/);
});

test("the admin Supabase client module is server-only and never imports a NEXT_PUBLIC_-prefixed service key", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const adminClientPath = path.join(here, "supabase", "admin.ts");
  const source = fs.readFileSync(adminClientPath, "utf8");

  assert.match(source, /^import\s+["']server-only["']/m, 'expected a top-level import "server-only" guard');
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_.*SERVICE_ROLE/i);
});

test("the brand-assets proxy route verifies the requested orgId matches the session's own org before serving bytes", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const routePath = path.join(here, "..", "app", "api", "brand-assets", "[orgId]", "[assetKey]", "route.ts");
  const source = fs.readFileSync(routePath, "utf8");

  assert.match(source, /sessionOrgId\s*!==\s*orgId/);
});
