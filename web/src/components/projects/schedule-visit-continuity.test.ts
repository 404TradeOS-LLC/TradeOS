import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(relativePath: string) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("Site Visit DTO and action preserve the existing optional Job relationship", async () => {
  const [api, action, form] = await Promise.all([
    readSource("../../lib/api.ts"),
    readSource("../../app/actions/projects.ts"),
    readSource("./site-visit-form.tsx"),
  ]);

  assert.ok(api.includes("jobId: string | null;"));
  assert.ok(action.includes('const jobId = String(formData.get("jobId") ?? "").trim();'));
  assert.ok(action.includes("jobId: jobId || undefined"));
  assert.ok(form.includes('name="jobId" value={jobId}'));
});

test("Project intake accepts only active Jobs already returned on that Project", async () => {
  const page = await readSource("../../app/(app)/projects/[id]/intake/page.tsx");

  assert.ok(page.includes("project.jobs.find((job) => job.id === requestedJobId && !job.archivedAt)"));
  assert.ok(page.includes("invalidJobContext"));
  assert.ok(page.includes("This visit will remain Project-only"));
  assert.ok(page.includes("<SiteVisitForm projectId={project.id} jobId={linkedJob?.id} />"));
});

test("Dispatch and Project job rows route active work into the canonical intake workspace", async () => {
  const [dispatch, project] = await Promise.all([
    readSource("../dispatch/dispatch-job-actions.tsx"),
    readSource("./project-workspace.tsx"),
  ]);

  assert.ok(dispatch.includes("Capture site visit"));
  assert.ok(dispatch.includes('/intake?jobId=${encodeURIComponent(job.id)}'));
  assert.ok(project.includes("Capture site visit"));
  assert.ok(project.includes('currentRole !== "technician"'));
  assert.ok(project.includes('!["completed", "cancelled"].includes(job.status)'));
});

test("Saving a linked visit refreshes existing schedule/project/field reads and preserves context", async () => {
  const action = await readSource("../../app/actions/projects.ts");

  assert.ok(action.includes('revalidatePath("/dispatch")'));
  assert.ok(action.includes('revalidatePath("/field")'));
  assert.ok(action.includes('redirectQuery.set("jobId", jobId)'));
  assert.ok(action.includes('redirect(`/projects/${projectId}/intake?${redirectQuery.toString()}`)'));
});

test("Historical Project Site Visits disclose real Job linkage without inventing schedule state", async () => {
  const project = await readSource("./project-workspace.tsx");

  assert.ok(project.includes("visit.jobId ? jobs.find((job) => job.id === visit.jobId)"));
  assert.ok(project.includes("Linked Job #"));
  assert.ok(project.includes("Project-only Site Visit"));
});
