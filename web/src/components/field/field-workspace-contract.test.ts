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
  assert.match(page, /prioritizeFieldJobs\(await listFieldJobs\(token, summary\.todayRangeUtc\)\)/);
  assert.match(page, /on_site: 0,[\s\S]*traveling: 1,[\s\S]*paused: 2,[\s\S]*dispatched: 3,[\s\S]*completed: 6,[\s\S]*cancelled: 7/);
  assert.match(page, /getFieldJob\(token, selectedId\)/);
  assert.match(page, /aria-label="Field jobs"/);
  assert.match(page, /id="current-job-heading"/);
  assert.match(page, /<section aria-labelledby="current-job-heading"/);
  assert.doesNotMatch(page, /<main aria-labelledby="current-job-heading"/);
  assert.match(page, /Open directions/);
  assert.match(page, /Work briefing/);
  assert.match(page, /Report back/);
  assert.match(page, /Recent notes/);
  assert.match(page, /Field complete/);
  assert.match(page, /Ready for invoice is a separate office handoff/);
  assert.match(actions, /start-travel/);
  assert.match(actions, /TRANSITIONS\[transition\]/);
  assert.match(actions, /\/api\/v1\/jobs/);
  assert.match(actions, /notes/);
  assert.match(proxy, /"\/field\/:path\*"/);
});

test("field page delegates direct-link and degraded-list decisions to tested helpers", async () => {
  const page = await readSource("../../app/(app)/field/page.tsx");

  assert.match(page, /resolveRequestedFieldJobId\(query\.job\)/);
  assert.match(page, /resolveSelectedFieldJobId\(query\.job, jobs\)/);
  assert.match(page, /resolveFieldJobLoad/);
  assert.match(page, /resolveFieldJobMembership/);
  assert.match(page, /getFieldWorkspaceLabels/);
  assert.match(page, /This assigned job is outside today’s list/);
  assert.match(page, /Today’s assigned job list couldn’t load/);
  assert.match(page, /visibleJobs\.map/);
});

test("project Job rows use the tested Field-link eligibility helper", async () => {
  const projectPage = await readSource("../../app/(app)/projects/[id]/page.tsx");
  const workspace = await readSource("../projects/project-workspace.tsx");

  assert.match(projectPage, /currentRole=\{settings\.currentRole\}/);
  assert.match(workspace, /currentRole: string/);
  assert.match(workspace, /getProjectFieldJobHref\(currentRole, job\)/);
  assert.match(workspace, /Open field job/);
});

test("field action controls remain bounded to the existing lifecycle transitions", async () => {
  const actions = await readSource("./field-job-actions.tsx");

  assert.match(actions, /startTravel/);
  assert.match(actions, /arrive/);
  assert.match(actions, /pause/);
  assert.match(actions, /resume/);
  assert.match(actions, /complete/);
  assert.match(actions, /fixed inset-x-4 bottom-\[calc\(env\(safe-area-inset-bottom\)\+5\.5rem\)\]/);
  assert.match(actions, /Completes field work\. Invoice handoff stays separate\./);
  assert.doesNotMatch(actions, /["'](?:schedule|assign|delete)["']/i);
});

test("canonical field workspace does not advertise unconnected field capabilities", async () => {
  const page = await readSource("../../app/(app)/field/page.tsx");

  assert.doesNotMatch(page, /Take photo/i);
  assert.doesNotMatch(page, /Create issue/i);
  assert.doesNotMatch(page, /Record change/i);
  assert.doesNotMatch(page, /offline/i);
  assert.doesNotMatch(page, /inventory/i);
  assert.doesNotMatch(page, /create or send an invoice.*button/i);
});
