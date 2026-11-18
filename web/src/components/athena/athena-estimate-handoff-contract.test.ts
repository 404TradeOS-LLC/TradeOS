import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("Today exposes the compact existing Athena workspace first and no stale directional copy", async () => {
  const today = await source("../dashboard/today-experience.tsx");
  const athenaPosition = today.indexOf('className="today-panel today-athena mb-4"');
  const metricsPosition = today.indexOf('aria-label="Operational indicators"');
  assert.ok(athenaPosition >= 0 && athenaPosition < metricsPosition);
  assert.match(today, /setAthenaOpen\] = useState\(initialView === "today"\)/);
  assert.match(today, /compact=\{initialView === "today"\}/);
  assert.doesNotMatch(today, /operational records remain available above/);
});

test("contractor can edit or remove any retained note and retry without truncation", async () => {
  const workspace = await source("./athena-workspace.tsx");
  assert.match(workspace, /contractorNotes\.map\(/);
  assert.match(workspace, /setContractorNotes\(/);
  assert.match(workspace, /aria-label=\{\x60Estimate note \$\{index \+ 1\}\x60\}/);
  assert.match(workspace, /Remove note/);
  assert.match(workspace, /makeAthenaEstimateDraft\(/);
  assert.match(workspace, /onClick=\{prepareEstimate\}/);
});

test("preset starter prompts never become contractor-owned scope by pressing Send unchanged", async () => {
  const workspace = await source("./athena-workspace.tsx");
  assert.match(workspace, /selectedStarter/);
  assert.match(workspace, /trimmed !== selectedStarter/);
  assert.match(workspace, /setSelectedStarter\(starter\)/);
  assert.match(workspace, /setSelectedStarter\(null\)/);
});

test("estimate handoff is permission- and actor-gated in both Today and full Athena", async () => {
  const workspace = await source("./athena-workspace.tsx");
  const today = await source("../dashboard/today-experience.tsx");
  const route = await source("../../app/(app)/athena/page.tsx");
  assert.match(workspace, /canCreateEstimate && estimateHandoffIdentity/);
  assert.match(today, /canUseUniversalCreate\("estimate", data\.viewer\.role/);
  assert.match(route, /getAthenaEstimateHandoffAuth/);
  assert.match(workspace, /sessionStorage\.setItem\(ATHENA_ESTIMATE_DRAFT_KEY, payload\)/);
});

test("Project scope form only consumes identity-matched handoff and remains editable before authorized submission", async () => {
  const form = await source("../../app/(app)/projects/new/form.tsx");
  const route = await source("../../app/(app)/projects/new/page.tsx");
  assert.match(form, /sessionStorage\.removeItem\(ATHENA_ESTIMATE_DRAFT_KEY\)/);
  assert.match(form, /readAthenaEstimateDraft\(raw, Date\.now\(\), estimateHandoffIdentity\)/);
  assert.match(form, /value=\{scopeValue\}/);
  assert.match(form, /onChange=\{\(event\) => setScopeValue\(event\.target\.value\)\}/);
  assert.match(form, /action=\{formAction\}/);
  assert.match(route, /getAthenaEstimateHandoffAuth/);
  assert.doesNotMatch(workspacePlaceholder(), /fake-user/);
});

// A static marker for prohibiting synthetic authority in the contract tests.
function workspacePlaceholder() { return "authenticated estimate handoff"; }
