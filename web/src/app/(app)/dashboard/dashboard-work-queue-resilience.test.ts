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

test("paired dashboard work queues preserve fulfilled siblings", async () => {
  const source = await readDashboardSource();

  assert.match(source, /Promise\.allSettled\(\[\s*listInvoiceQueue/);
  assert.match(source, /Promise\.allSettled\(\[\s*listProposalQueue/);
  assert.match(source, /overdueResult\.status === "fulfilled" \? overdueResult\.value : emptyQueue<InvoiceQueueItem>\(\)/);
  assert.match(source, /unpaidResult\.status === "fulfilled" \? unpaidResult\.value : emptyQueue<InvoiceQueueItem>\(\)/);
  assert.match(source, /staleResult\.status === "fulfilled" \? staleResult\.value : emptyQueue<ProposalQueueItem>\(\)/);
  assert.match(source, /unsignedResult\.status === "fulfilled" \? unsignedResult\.value : emptyQueue<ProposalQueueItem>\(\)/);
});

test("invoice KPI fallback depends only on the unpaid total request", async () => {
  const source = await readDashboardSource();

  assert.match(source, /const unpaidFailed = unpaidResult\.status === "rejected"/);
  assert.match(source, /return \{ overdue, unpaid, unpaidFailed, error \}/);
  assert.match(source, /invoiceAttentionQueues\.unpaidFailed \? fallbackInvoicesWaiting : invoiceAttentionQueues\.unpaid\.total/);
});

test("partial paired-request failures remain visible to the Needs Attention UI", async () => {
  const source = await readDashboardSource();

  assert.match(source, /overdueFailed \|\| unpaidFailed/);
  assert.match(source, /staleResult\.status === "rejected" \|\| unsignedResult\.status === "rejected"/);
  assert.match(source, /invoicesError=\{invoiceAttentionQueues\.error\}/);
  assert.match(source, /proposalsError=\{proposalAttentionQueues\.error\}/);
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
