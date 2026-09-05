import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string): Promise<string> {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("field workspace is a server-authenticated technician surface over named job contracts", async () => {
  const page = await readSource("../../app/(app)/field/page.tsx");
  const actions = await readSource("../../app/actions/field.ts");
  const proxy = await readSource("../../proxy.ts");

  assert.match(page, /getSessionToken/);
  assert.match(page, /settings\.currentRole !== "technician"/);
  assert.match(page, /listFieldJobs\(token, summary\.todayRangeUtc\)/);
  assert.match(page, /getFieldJob\(token, selectedId\)/);
  assert.match(actions, /start-travel/);
  assert.match(actions, /`\/api\/v1\/jobs\/\$\{jobId\}\/\$\{TRANSITIONS\[transition\]\}`/);
  assert.match(actions, /\/api\/v1\/jobs\/\$\{jobId\}\/notes/);
  assert.match(proxy, /"\/field\/:path\*"/);
});

test("field action controls remain bounded to the existing lifecycle transitions", async () => {
  const actions = await readSource("./field-job-actions.tsx");

  assert.match(actions, /startTravel/);
  assert.match(actions, /arrive/);
  assert.match(actions, /pause/);
  assert.match(actions, /resume/);
  assert.match(actions, /complete/);
  assert.doesNotMatch(actions, /schedule|assign|delete/i);
});
