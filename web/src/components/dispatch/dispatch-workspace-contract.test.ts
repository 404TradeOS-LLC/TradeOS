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

test("dispatch observability uses existing scoped summary and activity contracts", async () => {
  const page = await readSource("../../app/(app)/dispatch/page.tsx");
  const panel = await readSource("./dispatch-observability-panel.tsx");
  const api = await readSource("../../lib/api.ts");

  assert.match(page, /listActivityEvents\(token, \{ entityType: "job", limit: 8 \}\)/);
  assert.match(page, /activityError/);
  assert.match(panel, /summary\.scope\.source/);
  assert.match(panel, /status=unscheduled/);
  assert.match(panel, /No dispatch activity yet/);
  assert.match(panel, /Activity is temporarily unavailable/);
  assert.match(api, /entityType\?: string/);
});

test("dispatch route defaults to the current contract-backed Schedule board while preserving the attention queue", async () => {
  const page = await readSource("../../app/(app)/dispatch/page.tsx");
  const board = await readSource("./schedule-board.tsx");

  assert.match(page, /title: "Schedule \| TradeOS"/);
  assert.match(page, /resolveScheduleMode/);
  assert.match(page, /query\.mode === "week"/);
  assert.match(page, /query\.mode === "crew"/);
  assert.match(page, /status: "unscheduled"/);
  assert.match(page, /todayRangeUtc/);
  assert.match(page, /weekRangeUtc/);
  assert.match(page, /BOARD_PAGE_SIZE = 100/);
  assert.match(page, /<ScheduleBoard/);
  assert.match(page, /<ScheduleModeNav/);
  assert.match(board, /label: "Day"/);
  assert.match(board, /label: "Week"/);
  assert.match(board, /label: "Crew"/);
  assert.match(board, /label: "Attention queue"/);
});

test("Schedule views remain derived from real Jobs and conflict-aware actions", async () => {
  const board = await readSource("./schedule-board.tsx");
  const actions = await readSource("./dispatch-job-actions.tsx");

  assert.match(board, /DispatchJob\[\]/);
  assert.match(board, /assignedTechnicians/);
  assert.match(board, /formatScheduleInZone/);
  assert.match(board, /<DispatchJobActions/);
  assert.match(board, /Real Jobs waiting for a schedule slot/);
  assert.match(board, /Check conflicts before saving/);
  assert.match(actions, /\/schedule\/conflicts/);
  assert.doesNotMatch(board, /draggable|onDragStart|route optimizer|GPS|live location/i);
});


test("scheduled work exposes manager-gated Site Visit capture through the existing Project and Job ids", async () => {
  const page = await readSource("../../app/(app)/dispatch/page.tsx");
  const board = await readSource("./schedule-board.tsx");

  assert.match(page, /canCaptureSiteVisit\(settings\.currentRole\)/);
  assert.match(board, /canCaptureSiteVisits && job\.project && !job\.archivedAt/);
  assert.match(board, /buildSiteVisitCaptureHref\(job\.project\.id, job\.id\)/);
  assert.match(board, /Capture site visit/);
  assert.doesNotMatch(board, /create.*site.*visit|POST.*site-visits/i);
});

test("attention queue pagination keeps an explicit queue discriminator at page one", async () => {
  const page = await readSource("../../app/(app)/dispatch/page.tsx");

  assert.match(page, /if \(merged\.view\) params\.set\("view", merged\.view\)/);
  assert.doesNotMatch(page, /merged\.view !== "attention"/);
});

test("unscheduled tray discloses the six-row display bound", async () => {
  const board = await readSource("./schedule-board.tsx");

  assert.match(board, /const visibleUnscheduledJobs = unscheduledJobs\.slice\(0, 6\)/);
  assert.match(board, /visibleUnscheduledJobs\.map/);
  assert.match(board, /unscheduledTotal > visibleUnscheduledJobs\.length/);
  assert.match(board, /Showing \{visibleUnscheduledJobs\.length\} of \{unscheduledTotal\} unscheduled jobs/);
});

test("crew grouping uses stable sorted technician identities instead of display names", async () => {
  const board = await readSource("./schedule-board.tsx");

  assert.match(board, /technicians = \[\.\.\.job\.assignedTechnicians\]\.sort/);
  assert.match(board, /left\.userId\.localeCompare\(right\.userId\)/);
  assert.ok(board.includes('technicians.map((technician) => technician.userId).join("|")'));
  assert.match(board, /technicians\.map\(\(technician\) => technician\.name\)\.join\(" \+ "\)/);
});
