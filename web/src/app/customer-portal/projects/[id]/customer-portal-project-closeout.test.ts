import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("./page.tsx", import.meta.url);

async function readSource() {
  return readFile(sourceUrl, "utf8");
}

test("portal closeout handoff renders from the public project DTO and nothing else", async () => {
  const source = await readSource();

  assert.match(source, /project\.closeout/);
  assert.match(source, /Closeout handoff/);
  assert.match(source, /Read-only — the same closeout truth your contractor sees/);
  assert.doesNotMatch(source, /clientFetch|apiFetch|fetch\(/);
});

test("portal closeout handoff is read-only with no customer actions", async () => {
  const source = await readSource();

  assert.doesNotMatch(source, /createCloseoutAction|markCloseoutReadyAction|recordCloseoutHandoffAction/);
  assert.doesNotMatch(source, /createPunchItemAction|resolvePunchItemAction|verifyPunchItemAction|reopenPunchItemAction/);
  assert.doesNotMatch(source, /createWarrantyAction|deleteWarrantyAction/);
  assert.doesNotMatch(source, /<form[^>]*action=/);
});

test("portal closeout shows status, checklist, and resolved punch summary", async () => {
  const source = await readSource();

  assert.match(source, /Closeout status/);
  assert.match(source, /Artifact checklist/);
  assert.match(source, /Present/);
  assert.match(source, /Missing/);
  assert.match(source, /Not applicable/);
  // The four checklist rows come from the backend's named checks via the
  // same shared builder the staff tab uses — never a generic artifacts
  // array the backend does not return.
  assert.match(source, /buildCloseoutChecklistArtifacts\(project\.closeout\.checklist\)/);
  assert.match(source, /Punch items: \{project\.closeout\.resolvedPunchCount\} resolved · \{project\.closeout\.openPunchCount\} open/);
});

test("portal warranty section shows records as stored and says so when none exist", async () => {
  const source = await readSource();

  assert.match(source, /project\.closeout\.warranties\.map/);
  assert.match(source, /warranty\.coverageText/);
  assert.match(source, /No warranty recorded for this project/);
  assert.doesNotMatch(source, /1 year|12 months?|2 years?|5 years?|default warranty/i);
});

test("portal warranty section shows the recorded expiry and never invents one", async () => {
  const source = await readSource();

  // The recorded endsAt, exactly as stored; no endsAt renders
  // "Not recorded", never a substituted date.
  assert.match(source, /warranty\.endsAt/);
  assert.match(source, /Coverage ends \{warranty\.endsAt \? formatDate\(warranty\.endsAt\) : "Not recorded"\}/);
});

test("portal closeout document link appears only when the handoff provides one", async () => {
  const source = await readSource();

  assert.match(source, /project\.closeout\.documentHref \? \(/);
  assert.match(source, /View closeout document/);
});

test("portal says plainly when no closeout handoff has been shared", async () => {
  const source = await readSource();

  assert.match(source, /Your contractor hasn&apos;t shared a closeout handoff for this project yet/);
});
