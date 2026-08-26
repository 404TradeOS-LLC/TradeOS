import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string): Promise<string> {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("dispatcher workspace exposes the existing mutation contract through an authenticated client surface", async () => {
  const actions = await readSource("./dispatch-job-actions.tsx");
  const table = await readSource("./dispatch-work-queue-table.tsx");
  const proxy = await readSource("../../app/api/proxy/[...path]/route.ts");

  assert.match(actions, /clientFetch\("\/jobs\/" \+ job\.id \+ "\/assignments"/);
  assert.match(actions, /job\.scheduledStart \? "reschedule" : "schedule"/);
  assert.match(actions, /clientFetch<ScheduleConflictResult>\("\/schedule\/conflicts\?" \+ query\.toString\(\)/);
  assert.match(actions, /result\.conflicts/);
  assert.match(actions, /clientFetch\("\/jobs\/" \+ job\.id \+ "\/dispatch"/);
  assert.match(actions, /window\.location\.reload\(\)/);
  assert.match(actions, /role="alert"/);
  assert.match(table, /<DispatchJobActions job=\{job\} canManageInvoiceReadiness=\{canManageInvoiceReadiness\} \/>/);
  assert.match(table, /<th scope="col" className="px-3 py-2">Actions<\/th>/);
  assert.match(table, /className="grid gap-3 lg:hidden"/);
  assert.match(proxy, /export async function PUT\(/);
});

test("dispatcher workspace exposes a bounded manager-only invoice-readiness handoff", async () => {
  const page = await readSource("../../app/(app)/dispatch/page.tsx");
  const actions = await readSource("./dispatch-job-actions.tsx");
  const api = await readSource("../../lib/api.ts");

  assert.match(page, /invoice-ready/);
  assert.match(page, /getOrganizationSettings/);
  assert.match(page, /canManageInvoiceReadiness/);
  assert.match(api, /readyForInvoice\?: boolean/);
  assert.match(actions, /ready-for-invoice/);
  assert.match(actions, /canManageInvoiceReadiness && job\.status === "completed"/);
  assert.doesNotMatch(actions, /create.*invoice|send.*invoice/i);
});

test("dispatcher actions preserve security and conflict boundaries in the client contract", async () => {
  const actions = await readSource("./dispatch-job-actions.tsx");

  assert.match(actions, /overrideConflict/);
  assert.match(actions, /overrideReason/);
  assert.match(actions, /assignmentId \?\?/);
  assert.match(actions, /disabled=\{!technician\.assignmentId/);
  assert.match(actions, /UUID from organization membership/);
});
