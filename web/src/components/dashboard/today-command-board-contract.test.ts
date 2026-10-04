import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string): Promise<string> {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Today command board preserves the canonical four-section hierarchy", async () => {
  const board = await readSource("./today-command-board.tsx");

  assert.match(board, /label="Now" helper="Current work and normal progression"/);
  assert.match(board, /label="Needs you" helper="Only unresolved human action"/);
  assert.match(board, /label="Coming up" helper="Scheduled work and near-term commitments"/);
  assert.match(board, /label="Money" helper="Receivables summary, not a second ledger"/);
});

test("Now owns normal progression while Needs you is restricted to real unresolved exception sources", async () => {
  const board = await readSource("./today-command-board.tsx");

  assert.match(board, /currentSchedule\.map/);
  assert.match(board, /estimates\.map/);
  assert.match(board, /continueWorking\.map/);
  assert.match(board, /readyToStart\.map/);
  assert.match(board, /const staleProposals = proposals\.filter\(\(row\) => row\.stale\)/);
  assert.match(board, /const overdueInvoices = invoices\.filter\(\(row\) => row\.overdue\)/);
  assert.match(board, /blockedTasks\.length/);
  assert.match(board, /scheduleConflicts\.length/);
  assert.match(board, /Continue estimate/);
  assert.match(board, /proposal needs follow-up/);
  assert.match(board, /invoice #\$\{row\.documentNumber\} overdue/);
  assert.match(board, /Resolve conflict/);
  assert.match(board, /Resolve blocker/);
});

test("Coming up is sourced from the real near-term schedule instead of normal-progress or unscheduled buckets", async () => {
  const board = await readSource("./today-command-board.tsx");
  const page = await readSource("../../app/(app)/dashboard/page.tsx");

  assert.match(board, /upcomingSchedule\.map/);
  assert.match(board, /action="Open schedule"/);
  assert.match(page, /scheduledFrom: summary\.todayRangeUtc\.end/);
  assert.match(page, /scheduledTo: toInclusiveEndBoundary\(summary\.weekRangeUtc\.end\)/);
  assert.match(page, /DASHBOARD_UPCOMING_JOB_LIMIT/);
  assert.doesNotMatch(board, /unscheduled-jobs|Unscheduled Jobs/);
});

test("Money is a receivables summary and never links to a nonexistent Money workspace or removed dashboard anchor", async () => {
  const board = await readSource("./today-command-board.tsx");

  assert.match(board, /Money keeps the receivables picture/);
  assert.match(board, /receivables\.loadedOutstanding/);
  assert.match(board, /receivables\.overdueInvoiceTotal/);
  assert.match(board, /Open overdue invoice/);
  assert.doesNotMatch(board, /href="\/money"/);
  assert.doesNotMatch(board, /#invoices-waiting/);
});

test("Today landing page no longer loads or renders duplicate dashboard modules", async () => {
  const page = await readSource("../../app/(app)/dashboard/page.tsx");

  assert.match(page, /<OwnerDashboardHeader/);
  assert.match(page, /<TodayCommandBoard/);
  assert.doesNotMatch(page, /OwnerTaskBoard|OwnerActivityFeed|CollapsibleCard/);
  assert.doesNotMatch(page, /getKnowledgeStats|listActivityEvents|getCurrentWeekPaymentLedger/);
  assert.match(page, /listOrganizationProjectTasks/);
  assert.match(page, /getScheduleConflicts/);
  assert.doesNotMatch(page, /Recent project lifecycle|Knowledge Runtime Coverage|Recent activity/);
});

test("Today attention count uses unresolved human-action queues without inventing zero during outages", async () => {
  const page = await readSource("../../app/(app)/dashboard/page.tsx");
  const header = await readSource("./owner-dashboard-header.tsx");

  assert.match(page, /Boolean\(blockedTaskQueue\.error\)/);
  assert.match(page, /Boolean\(scheduleWindow\.conflicts\.error\)/);
  assert.match(page, /blockedTaskQueue\.items\.length/);
  assert.match(page, /scheduleWindow\.conflicts\.items\.length/);
  assert.match(page, /listProposalQueue\(token, \{/);
  assert.match(page, /const staleProposalCutoffIso = getStaleProposalCutoffIso\(now\)/);
  assert.match(page, /loadStaleProposalAttentionQueue\(token, staleProposalCutoffIso\)/);
  assert.match(page, /staleBefore: staleBeforeIso/);
  assert.match(header, /Needs you · unavailable/);
  assert.match(header, /Some Needs you sources are unavailable/);
  assert.doesNotMatch(page, /ATTENTION_UNSIGNED_PROPOSAL_LIMIT/);
});

test("Today header keeps page identity ahead of company/dashboard chrome", async () => {
  const header = await readSource("./owner-dashboard-header.tsx");
  const page = await readSource("../../app/(app)/dashboard/page.tsx");

  assert.match(header, />Today<\/h1>/);
  assert.match(header, /What needs action now\?/);
  assert.match(header, /Needs you · \$\{notificationCount\}/);
  assert.match(header, /Review work/);
  assert.doesNotMatch(header, /buildReviewQueueMetrics|MetricChip|reviewQueue/);
  assert.doesNotMatch(page, /loadDashboardWeather|selectDashboardWeatherAddress|getWeatherForAddress/);
});

test("Money shows unavailable queue totals explicitly instead of synthetic zero", async () => {
  const board = await readSource("./today-command-board.tsx");

  assert.match(board, /openInvoicesUnavailable \? "Unavailable" : receivables\.openInvoiceTotal/);
  assert.match(board, /overdueInvoicesUnavailable \? "Unavailable" : receivables\.overdueInvoiceTotal/);
  assert.match(board, /Overdue queue unavailable/);
});

test("Coming Up backfills active scheduled Jobs instead of filtering only a bounded first page", async () => {
  const page = await readSource("../../app/(app)/dashboard/page.tsx");

  assert.match(page, /async function loadActiveScheduledJobs/);
  assert.match(page, /pageSize: DASHBOARD_SCHEDULE_FETCH_PAGE_SIZE/);
  assert.match(page, /if \(TERMINAL_JOB_STATUSES\.has\(job\.status\)\) continue/);
  assert.match(page, /limit: DASHBOARD_UPCOMING_JOB_LIMIT/);
  assert.match(page, /total: summary\.scheduledToday/);
});

test("Needs You uses the existing conflict preview and blocked Project Task contracts", async () => {
  const page = await readSource("../../app/(app)/dashboard/page.tsx");
  const board = await readSource("./today-command-board.tsx");
  const api = await readSource("../../lib/api.ts");

  assert.match(api, /\/api\/v1\/schedule\/conflicts/);
  assert.match(page, /scheduledFrom: summary\.todayRangeUtc\.start/);
  assert.match(page, /scheduledTo: summary\.weekRangeUtc\.end/);
  const blockedTaskLoader = page.match(
    /async function loadBlockedProjectTasks\(token: string\) \{([\s\S]*?)\n\}/,
  )?.[1];
  assert.ok(blockedTaskLoader);
  assert.match(
    blockedTaskLoader,
    /items:\s*tasks\.filter\(\(task\) => task\.status === "blocked"\)/,
  );
  assert.match(blockedTaskLoader, /tasks\.length === 50 \? "Blocked project tasks may be incomplete" : null/);
  assert.match(board, /href="\/dispatch\?mode=week"/);
  assert.match(board, /href=\{\`\/projects\/\$\{task\.projectId\}\?tab=tasks\`\}/);
  assert.doesNotMatch(board, /material unavailable|stale supplier|verify price/i);
});
