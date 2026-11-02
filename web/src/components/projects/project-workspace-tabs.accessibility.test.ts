import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tabsUrl = new URL("./project-workspace-tabs.tsx", import.meta.url);

test("Project section navigation labels its region, current tab and keyboard focus", async () => {
  const source = await readFile(tabsUrl, "utf8");
  assert.ok(source.includes('aria-label="Project sections"'));
  assert.ok(source.includes('aria-current={activeTab === tab ? "page" : undefined}'));
  assert.ok(source.includes("focus-visible:ring-3"));
  assert.ok(source.includes("focus-visible:ring-ring/50"));
});
