import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("all Today entry points share the authenticated loader and interactive experience", async () => {
  for (const route of ["dashboard/page.tsx", "dashboard/needs-you/page.tsx", "dashboard/work/page.tsx"]) {
    const page = await read(`../../app/(app)/${route}`);
    assert.match(page, /await loadTodayData\(\)/);
    assert.match(page, /if \(!data\) return <TodayAccessState/);
    assert.match(page, /TodayExperience data=\{data\}/);
  }
});
test("Today keeps financial analytics off the operating surface and actions in source workspaces", async () => {
  const ui = await read("./today-experience.tsx");
  assert.doesNotMatch(ui, /receivables|loadedOutstanding|Revenue This Week|<MoneySummary/);
  assert.match(ui, /href=\{selected.href\}/);
  assert.match(ui, /an item stays open until its source is resolved/);
  assert.doesNotMatch(ui, /setAttention|\.splice\(|markResolved|fetch\(/);
});
test("context workspace uses native modal focus semantics, restoration and scroll lock", async () => {
  const ui = await read("./today-experience.tsx");
  assert.match(ui, /<dialog/);
  assert.match(ui, /\.showModal\(\)/);
  assert.match(ui, /useBodyScrollLock\(Boolean\(selected\)\)/);
  assert.match(ui, /onClose=\{onClose\}/);
});
test("real Athena component carries page scope and remains capability gated", async () => {
  const ui = await read("./today-experience.tsx");
  assert.match(ui, /data.athenaEnabled \?/);
  assert.match(ui, /<AthenaWorkspace selectedScope=\{\{ page:/);
  assert.doesNotMatch(ui, /approve.*onClick|Action completed successfully|Math.random/);
});
test("responsive theme and reduced-motion contracts cover the command center", async () => {
  const css = await read("./today-experience.css");
  assert.match(css, /max-width:767px/);
  assert.match(css, /max-width:1023px/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /var\(--card\)/);
  assert.match(css, /var\(--primary\)/);
  assert.match(css, /100dvh/);
});
