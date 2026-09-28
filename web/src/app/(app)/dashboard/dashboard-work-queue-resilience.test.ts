import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  loadDashboardProjectDetails,
  loadDashboardStartup,
  resolveDashboardOrganizationContext,
} from "./dashboard-startup.ts";

const sourceUrl = new URL("./page.tsx", import.meta.url);

async function readDashboardSource() {
  return readFile(sourceUrl, "utf8");
}

test("Today preserves independent invoice siblings and uses stale-only Proposal attention", async () => {
  const source = await readDashboardSource();

  assert.match(source, /Promise\.allSettled\(\[\s*listInvoiceQueue/);
  assert.match(source, /overdueResult\.status === "fulfilled" \? overdueResult\.value : emptyQueue<InvoiceQueueItem>\(\)/);
  assert.match(source, /unpaidResult\.status === "fulfilled" \? unpaidResult\.value : emptyQueue<InvoiceQueueItem>\(\)/);
  assert.match(source, /listProposalQueue\(token, \{/);
  assert.match(source, /unsigned: true/);
  assert.match(source, /staleBefore: staleBeforeIso/);
  assert.doesNotMatch(source, /ATTENTION_UNSIGNED_PROPOSAL_LIMIT|unsignedResult/);
});

test("Money preserves queue uncertainty instead of converting failed totals to zero", async () => {
  const source = await readDashboardSource();

  assert.match(source, /overdueUnavailable: overdueFailed/);
  assert.match(source, /openUnavailable: unpaidFailed/);
  assert.match(source, /overdueInvoiceTotal: invoiceQueues\.overdueUnavailable \? invoiceRows\.filter\(\(row\) => row\.overdue\)\.length : invoiceQueues\.overdue\.total/);
  assert.match(source, /openInvoiceTotal: invoiceQueues\.openUnavailable \? invoiceRows\.length : invoiceQueues\.unpaid\.total/);
  assert.match(source, /isPartial: invoiceQueues\.openUnavailable \|\| receivablesBase\.isPartial/);
  assert.doesNotMatch(source, /fallbackInvoicesWaiting|buildOwnerKpis/);
});

test("partial source failures remain visible to their Today sections", async () => {
  const source = await readDashboardSource();

  assert.match(source, /overdueFailed \|\| unpaidFailed/);
  assert.match(source, /error: error instanceof Error \? error\.message : "Stale proposal queue is temporarily unavailable"/);
  assert.match(source, /currentSchedule: scheduleWindow\.today\.error/);
  assert.match(source, /upcomingSchedule: scheduleWindow\.upcoming\.error/);
  assert.match(source, /invoices: invoiceQueues\.error/);
  assert.match(source, /proposals: staleProposalQueue\.error/);
  assert.match(source, /openInvoicesUnavailable: invoiceQueues\.openUnavailable/);
  assert.match(source, /overdueInvoicesUnavailable: invoiceQueues\.overdueUnavailable/);
  assert.match(source, /const attentionUnavailable = Boolean\(staleProposalQueue\.error\) \|\| invoiceQueues\.overdueUnavailable/);
  assert.match(source, /const notificationCount = attentionUnavailable \? null : staleProposalQueue\.queue\.total \+ invoiceQueues\.overdue\.total/);
});

test("organization settings failure preserves successfully loaded project data", async () => {
  const projects = [{ id: "project-1", name: "Test Project" }];
  let settingsCalls = 0;

  const result = await loadDashboardStartup("mock-token", {
    listProjects: async () => projects,
    getOrganizationSettings: async () => {
      settingsCalls += 1;
      throw new Error("Organization settings request failed");
    },
  });

  assert.deepEqual(result.projects, projects);
  assert.equal(result.settingsResponse, null);
  assert.equal(settingsCalls, 1);
});

test("one failed project detail preserves fulfilled project siblings", async () => {
  const projects = [{ id: "project-1" }, { id: "project-2" }, { id: "project-3" }];

  const result = await loadDashboardProjectDetails("mock-token", projects, 3, async (_token, projectId) => {
    if (projectId === "project-2") throw new Error("Project detail request failed");
    return { id: projectId, name: `Project ${projectId}` };
  });

  assert.deepEqual(
    result.items.map((project) => project.id),
    ["project-1", "project-3"],
  );
  assert.equal(result.failedCount, 1);
});

test("dashboard wires project details through the isolated fan-out", async () => {
  const source = await readDashboardSource();

  assert.match(source, /loadDashboardProjectDetails\(token, projects, DASHBOARD_PROJECT_DETAIL_LIMIT, getProject\)/);
  assert.match(source, /projectDetailsResult\.failedCount/);
});

test("settings outage uses dispatch timezone and does not expose demo organization identity", () => {
  assert.deepEqual(resolveDashboardOrganizationContext(null, "America/Chicago"), {
    companyName: "Organization unavailable",
    timeZone: "America/Chicago",
  });
});

test("Coming Up excludes terminal scheduled Jobs", async () => {
  const source = await readDashboardSource();

  assert.match(source, /const TERMINAL_JOB_STATUSES = new Set\(\["completed", "cancelled"\]\)/);
  assert.match(source, /activeScheduledJobs/);
  assert.match(source, /todayItems = todayResult\.status === "fulfilled" \? activeScheduledJobs\(todayResult\.value\.items\) : \[\]/);
  assert.match(source, /upcomingItems = upcomingResult\.status === "fulfilled" \? activeScheduledJobs\(upcomingResult\.value\.items\) : \[\]/);
});
