import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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

test("organization settings failure does not crash the dashboard", async (t) => {
  // Mock getOrganizationSettings to reject
  const mockGetOrganizationSettings = t.mock.fn(async () => {
    throw new Error("Organization settings request failed");
  });

  // Mock other API dependencies to return minimal valid data
  const mockGetSession = t.mock.fn(async () => ({ email: "test@example.com" }));
  const mockGetSessionToken = t.mock.fn(async () => "mock-token");
  const mockListProjects = t.mock.fn(async () => [{ id: "project-1", name: "Test Project" }]);
  const mockGetProject = t.mock.fn(async () => ({
    id: "project-1",
    name: "Test Project",
    jobs: [],
    tasks: [],
    estimates: [],
    invoices: [],
    proposals: [],
    contracts: [],
    changeOrders: [],
  }));
  const mockListInvoiceQueue = t.mock.fn(async () => ({ items: [], total: 0, nextCursor: null }));
  const mockListProposalQueue = t.mock.fn(async () => ({ items: [], total: 0, nextCursor: null }));
  const mockListEstimateQueue = t.mock.fn(async () => ({ items: [], total: 0, nextCursor: null }));
  const mockGetDispatchSummary = t.mock.fn(async () => ({
    todayRangeUtc: { start: new Date().toISOString(), end: new Date().toISOString() },
    timezone: { value: "UTC" },
  }));
  const mockListJobsForDispatch = t.mock.fn(async () => ({ items: [], total: 0 }));
  const mockGetKnowledgeStats = t.mock.fn(async () => null);
  const mockGetCurrentWeekPaymentLedger = t.mock.fn(async () => null);
  const mockListOrganizationProjectTasks = t.mock.fn(async () => []);
  const mockListActivityEvents = t.mock.fn(async () => []);
  const mockLoadDashboardWeather = t.mock.fn(async () => null);

  // Mock the API module
  await t.mock.module("@/lib/api", {
    namedExports: {
      getOrganizationSettings: mockGetOrganizationSettings,
      listProjects: mockListProjects,
      getProject: mockGetProject,
      listInvoiceQueue: mockListInvoiceQueue,
      listProposalQueue: mockListProposalQueue,
      listEstimateQueue: mockListEstimateQueue,
      getDispatchSummary: mockGetDispatchSummary,
      listJobsForDispatch: mockListJobsForDispatch,
      getKnowledgeStats: mockGetKnowledgeStats,
      listOrganizationProjectTasks: mockListOrganizationProjectTasks,
      listActivityEvents: mockListActivityEvents,
      toInclusiveEndBoundary: (date: string) => date,
    },
  });

  await t.mock.module("@/lib/session", {
    namedExports: {
      getSession: mockGetSession,
      getSessionToken: mockGetSessionToken,
    },
  });

  await t.mock.module("@/lib/payment-ledger", {
    namedExports: {
      getCurrentWeekPaymentLedger: mockGetCurrentWeekPaymentLedger,
    },
  });

  await t.mock.module("@/lib/dashboard-weather", {
    namedExports: {
      loadDashboardWeather: mockLoadDashboardWeather,
      selectDashboardWeatherAddress: () => null,
    },
  });

  await t.mock.module("@/lib/weather", {
    namedExports: {
      getWeatherForAddress: async () => null,
    },
  });

  // Dynamically import DashboardPage after mocks are set up
  const { default: DashboardPage } = await import("./page.tsx");

  // Invoke the DashboardPage component
  const result = await DashboardPage();

  // Assert that the page still resolves successfully despite settings failure
  assert.ok(result, "DashboardPage should return a valid React element");
  assert.equal(mockGetOrganizationSettings.mock.callCount(), 1, "getOrganizationSettings should have been called");
  assert.equal(mockListProjects.mock.callCount(), 1, "listProjects should have been called");
  assert.equal(mockGetProject.mock.callCount(), 1, "getProject should have been called (project data loaded)");
});
