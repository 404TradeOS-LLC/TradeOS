import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("Today exposes one compact Athena composer ahead of operational indicators", async () => {
  const today = await source("../dashboard/today-experience.tsx");
  const athenaPosition = today.indexOf('className="today-panel today-athena mb-4"');
  const metricsPosition = today.indexOf('aria-label="Operational indicators"');
  assert.ok(athenaPosition >= 0 && athenaPosition < metricsPosition);
  assert.match(today, /setAthenaOpen\] = useState\(initialView === "today"\)/);
  assert.match(today, /compact=\{initialView === "today"\}/);
});

test("Athena estimate handoff requires an explicit contractor action and only transfers typed notes", async () => {
  const workspace = await source("./athena-workspace.tsx");
  assert.match(workspace, /setContractorNotes\(\(current\) => \[\.\.\.current, trimmed\]\)/);
  assert.match(workspace, /makeAthenaEstimateDraft\(contractorNotes, Date\.now\(\)\)/);
  assert.match(workspace, /onClick=\{prepareEstimate\}/);
  assert.match(workspace, /sessionStorage\.setItem\(ATHENA_ESTIMATE_DRAFT_KEY, payload\)/);
  assert.doesNotMatch(workspace, /conversationId:.*crypto\.randomUUID/);
});

test("Project scope form consumes handoff once and remains editable before authorized submission", async () => {
  const form = await source("../../app/(app)/projects/new/form.tsx");
  assert.match(form, /sessionStorage\.removeItem\(ATHENA_ESTIMATE_DRAFT_KEY\)/);
  assert.match(form, /readAthenaEstimateDraft\(raw, Date\.now\(\)\)/);
  assert.match(form, /value=\{scopeValue\}/);
  assert.match(form, /onChange=\{\(event\) => setScopeValue\(event\.target\.value\)\}/);
  assert.match(form, /action=\{formAction\}/);
});
