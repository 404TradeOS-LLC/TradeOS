import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("StickyTaskAction sticks above the Control Dock with safe-area clearance", async () => {
  const source = await readSource("./sticky-task-action.tsx");

  assert.match(source, /sticky bottom-\[calc\(4\.5rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(source, /z-10/);
  assert.match(source, /backdrop-blur/);
  assert.match(source, /border-t border-border\/70 bg-card\/95/);
});

test("StickyTaskAction goes static on desktop where there is no Control Dock", async () => {
  const source = await readSource("./sticky-task-action.tsx");

  assert.match(source, /md:static/);
  assert.match(source, /md:bg-transparent/);
  assert.match(source, /md:border-0/);
  assert.match(source, /md:w-auto/);
});

test("StickyTaskAction renders one dominant full-width primary action with a 44px target", async () => {
  const source = await readSource("./sticky-task-action.tsx");

  assert.match(source, /export function StickyTaskAction/);
  assert.match(source, /<Button/);
  assert.match(source, /min-h-11 w-full/);
  assert.match(source, /\{label\}/);
  assert.match(source, /disabled=\{disabled\}/);
});

test("StickyTaskAction shows the supporting hint only when provided", async () => {
  const source = await readSource("./sticky-task-action.tsx");

  assert.match(source, /\{hint \? <p className="mt-2 text-xs text-muted-foreground">\{hint\}<\/p> : null\}/);
});

test("Site Visit form uses the shared StickyTaskAction instead of its own sticky shell", async () => {
  const form = await readSource("../projects/site-visit-form.tsx");

  assert.match(form, /<StickyTaskAction/);
  assert.match(form, /label=\{isPending \? "Saving visit…" : "Finish Visit"\}/);
  assert.match(form, /type="submit"/);
  assert.match(form, /disabled=\{isPending\}/);
  assert.match(form, /Finish Visit creates the Site Visit record/);
  assert.doesNotMatch(form, /sticky bottom-/);
});

test("Athena workspace keeps its own inline composer until the #1029 follow-up", async () => {
  const workspace = await readSource("../athena/athena-workspace.tsx");

  // Deliberate deferral: PR #1029 owns athena-workspace.tsx and its contract
  // test pins the inline sticky composer class. Migrating it here would
  // collide with that lane; the follow-up lands after #1029 merges.
  assert.match(workspace, /sticky bottom-\[calc\(4\.5rem\+env\(safe-area-inset-bottom\)\)\] backdrop-blur 2xl:bottom-0/);
  assert.doesNotMatch(workspace, /StickyTaskAction/);
});
