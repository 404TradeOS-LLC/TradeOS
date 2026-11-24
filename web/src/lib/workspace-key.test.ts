import assert from "node:assert/strict";
import test from "node:test";

import { resolveWorkspaceKey } from "./workspace-key.ts";

test("resolveWorkspaceKey prefers the session token org over the settings lookup", () => {
  assert.equal(
    resolveWorkspaceKey({ tokenOrgId: "org-token", settingsOrgId: "org-settings" }),
    "org-token",
  );
});

test("resolveWorkspaceKey falls back to the settings org when the token carries none", () => {
  assert.equal(
    resolveWorkspaceKey({ tokenOrgId: null, settingsOrgId: "org-settings" }),
    "org-settings",
  );
  assert.equal(
    resolveWorkspaceKey({ settingsOrgId: "org-settings" }),
    "org-settings",
  );
});

test("resolveWorkspaceKey treats an empty org as missing", () => {
  assert.equal(
    resolveWorkspaceKey({ tokenOrgId: "", settingsOrgId: "org-settings" }),
    "org-settings",
  );
  assert.equal(resolveWorkspaceKey({ tokenOrgId: "", settingsOrgId: "" }), "unknown");
});

test("resolveWorkspaceKey is unknown only when neither source names a workspace", () => {
  assert.equal(resolveWorkspaceKey({}), "unknown");
  assert.equal(resolveWorkspaceKey({ tokenOrgId: null, settingsOrgId: null }), "unknown");
});
