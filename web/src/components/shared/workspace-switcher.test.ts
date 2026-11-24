import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const switcherUrl = new URL("./workspace-switcher.tsx", import.meta.url);

test("WorkspaceSwitcher hides itself for single-workspace users", async () => {
  const source = await readFile(switcherUrl, "utf8");
  assert.ok(
    source.includes("if (memberships.length < 2) return null;"),
    "with nothing to switch between the nav must not show a switcher"
  );
});

test("WorkspaceSwitcher lists every membership by name and role in a labelled select", async () => {
  const source = await readFile(switcherUrl, "utf8");
  assert.ok(source.includes('htmlFor="workspace-switcher"'));
  assert.ok(source.includes("Switch workspace"));
  assert.ok(source.includes("{membership.organizationName} — {membership.role}"));
  assert.ok(source.includes("value={current.orgId}"));
});

test("WorkspaceSwitcher switches through the server action and refreshes on success", async () => {
  const source = await readFile(switcherUrl, "utf8");
  assert.ok(source.includes("await switchWorkspaceAction(nextOrgId)"));
  assert.ok(source.includes("router.refresh()"));
  // A failed switch surfaces the error and leaves the current workspace selected.
  assert.ok(source.includes("setError(result.error)"));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("disabled={pending}"));
});

test("WorkspaceSwitcher re-enables the select after a successful switch", async () => {
  const source = await readFile(switcherUrl, "utf8");
  const fnIndex = source.indexOf("async function handleChange");
  assert.notEqual(fnIndex, -1);
  const fnSource = source.slice(fnIndex);
  // router.refresh() preserves this client component's state, so the
  // success path must clear pending explicitly — otherwise the select
  // stays disabled until a full page reload.
  const refreshIndex = fnSource.indexOf("router.refresh()");
  assert.notEqual(refreshIndex, -1);
  assert.ok(fnSource.slice(refreshIndex).includes("setPending(false)"));
});
