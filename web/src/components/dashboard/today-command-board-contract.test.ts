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

test("Now owns normal progression while Needs you is restricted to stale proposals and overdue invoices", async () => {
  const board = await readSource("./today-command-board.tsx");

  assert.match(board, /currentSchedule\.map/);
  assert.match(board, /estimates\.map/);
  assert.match(board, /continueWorking\.map/);
  assert.match(board, /readyToStart\.map/);
  assert.match(board, /const staleProposals = proposals\.filter\(\(row\) => row\.stale\)/);
  assert.match(board, /const overdueInvoices = invoices\.filter\(\(row\) => row\.overdue\)/);
  assert.match(board, /Continue estimate/);
  assert.match(board, /proposal needs follow-up/);
  assert.match(board, /invoice #\$\{row\.documentNumber\} overdue/);
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
  assert.doesNotMatch(page, /getKnowledgeStats|listActivityEvents|listOrganizationProjectTasks|getCurrentWeekPaymentLedger/);
  assert.doesNotMatch(page, /Recent project lifecycle|Knowledge Runtime Coverage|Recent activity/);
});

test("Today attention count uses unresolved human-action queues without inventing zero during outages", async () => {
  const page = await readSource("../../app/(app)/dashboard/page.tsx");
  const header = await readSource("./owner-dashboard-header.tsx");

  assert.match(page, /const attentionUnavailable = Boolean\(staleProposalQueue\.error\) \|\| invoiceQueues\.overdueUnavailable/);
  assert.match(page, /const notificationCount = attentionUnavailable \? null : staleProposalQueue\.queue\.total \+ invoiceQueues\.overdue\.total/);
  assert.match(page, /listProposalQueue\(token, \{/);
  assert.match(page, /staleBefore: staleProposalCutoffIso/);
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

test("Coming Up relies on the active scheduled-job filter", async () => {
  const page = await readSource("../../app/(app)/dashboard/page.tsx");

  assert.match(page, /const TERMINAL_JOB_STATUSES = new Set\(\["completed", "cancelled"\]\)/);
  assert.match(page, /activeScheduledJobs\(upcomingResult\.value\.items\)/);
});
