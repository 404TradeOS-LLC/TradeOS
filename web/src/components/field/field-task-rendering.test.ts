import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as fieldWorkspace from "../../lib/field-workspace.ts";
import * as motionAdapters from "../../lib/motion/adapters.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../../app/(app)/field/page.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;

type Task = { canUpdateStatus?: boolean; assignedUserId?: string; updatedAt?: string; id: string; title: string; status: string; priority: string; dueDate: string | null; assignedTo: string | null; notes: string | null };
async function renderField(tasks: Task[] | undefined) {
  const job = { id: "assigned-job", archivedAt: null, title: "Assigned kitchen job", jobNumber: "J-1", jobType: "Renovation", status: "scheduled", description: "Real page briefing", customer: null, project: { id: "project-a", name: "Kitchen" }, scheduledStart: null, scheduledEnd: null, arrivalWindowStart: null, arrivalWindowEnd: null, actualStart: null, readyForInvoiceAt: null, serviceAddress: null, equipment: [], notes: [], tasks };
  const runtime: { exports: Record<string, unknown> } = { exports: {} };
  vm.runInNewContext(code, { module: runtime, exports: runtime.exports, Intl, Date, require: (name: string) => {
    if (name === "react/jsx-runtime") return require(name);
    if (name === "@/lib/api") return { getFieldJob: async () => job, getDispatchSummary: async () => ({ todayRangeUtc: {} }), getOrganizationSettings: async () => ({ currentRole: "technician", currentUserId: "tech-a", settings: { timezone: "America/Indiana/Indianapolis" } }), listFieldJobs: async () => [job], ApiClientError: class extends Error {} };
    if (name === "@/lib/session") return { getSessionToken: async () => "test-only-token" };
    if (name === "@/lib/field-workspace") return fieldWorkspace;
    if (name === "@/lib/document-workflow") return { formatScheduleInZone: () => "Schedule" };
    if (name === "@/lib/motion/adapters") return motionAdapters;
    if (name === "@/components/motion/lifecycle-line") return { LifecycleLine: ({ label, stages, current, completed }: { label: string; stages: Array<{ id: string; label: string }>; current: string | null; completed: ReadonlyArray<string> }) => React.createElement("ol", { "aria-label": label }, stages.map((stage) => React.createElement("li", { key: stage.id }, `${stage.label}${stage.id === current ? " (Current)" : completed.includes(stage.id) ? " (Completed)" : ""}`))) };
    if (name === "@/components/ui/empty-state") return { EmptyState: ({ title }: { title: string }) => React.createElement("p", null, title) };
    if (name === "@/components/shared/status-badge") return { StatusBadge: ({ status }: { status: string }) => React.createElement("span", null, status) };
    if (name === "@/components/field/field-task-status-editor") return { FieldTaskStatusEditor: () => React.createElement("button", null, "Save assigned field task") };
    if (name === "@/components/field/field-job-actions") return { FieldJobActions: () => React.createElement("p", null, "Existing job actions") };
    if (name === "@/components/field/field-note-form") return { FieldNoteForm: () => React.createElement("form", { "aria-label": "Job notes" }) };
    throw new Error(`Unexpected Field page dependency: ${name}`);
  } });
  const page = runtime.exports.default as (input: { searchParams: Promise<{ job: string }> }) => Promise<React.ReactNode>;
  return renderToStaticMarkup(await page({ searchParams: Promise.resolve({ job: job.id }) }));
}

test("actual Field page renders shared task details, calendar due date and safe text", async () => {
  const html = await renderField([{ id: "task-1", title: "Inspect <site>", status: "blocked", priority: "high", dueDate: "2026-10-27T00:00:00.000Z", assignedTo: "Other crew member", notes: "Delivery delayed" }, { id: "task-2", title: "Completed preparation", status: "completed", priority: "medium", dueDate: null, assignedTo: null, notes: null }]);
  for (const text of ["Shared job tasks", "Inspect &lt;site&gt;", "blocked", "Oct 27, 2026", "Other crew member", "Delivery delayed", "Completed preparation", "No responsible party recorded", "No due date", "Update tasks personally assigned to you", "Job notes"]) assert.ok(html.includes(text), text);
  assert.ok(html.includes("Scheduled (Current)"), "job progress line renders from the server-confirmed status");
  assert.equal(html.includes("No tasks attached"), false);
  assert.equal(html.includes("Task details are unavailable"), false);
  assert.equal(html.includes("Save task status"), false);
});

test("actual Field page distinguishes an empty task list from unavailable details", async () => {
  const empty = await renderField([]);
  assert.ok(empty.includes("No tasks attached to this job."));
  assert.equal(empty.includes("Task details are unavailable"), false);
  const unavailable = await renderField(undefined);
  assert.ok(unavailable.includes("Task details are unavailable. Other job details remain usable."));
  assert.equal(unavailable.includes("No tasks attached"), false);
  for (const html of [empty, unavailable]) {
    assert.ok(html.includes("Assigned kitchen job"));
    assert.ok(html.includes("Real page briefing"));
    assert.ok(html.includes("Existing job actions"));
  }
});


test("Field page offers an editor only for the authenticated personal assignee", async () => {
  const base = { id: "own", title: "Inspect", status: "todo", priority: "medium", dueDate: null, assignedTo: "Same display name", notes: null, updatedAt: "2026-10-27T10:00:00Z" };
  const own = await renderField([{ ...base, assignedUserId: "tech-a", canUpdateStatus: true }]);
  assert.ok(own.includes("Save assigned field task"));
  for (const task of [{ ...base, assignedUserId: "another-user" }, { ...base, assignedUserId: "tech-a" }, base]) assert.equal((await renderField([task])).includes("Save assigned field task"), false);
});
