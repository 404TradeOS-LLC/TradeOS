import assert from "node:assert/strict";
import test from "node:test";
import { prioritizeTodayAttention, safeTodayTimeZone, taskNeedsAttention, todayDateKey, taskDueBucket, isTodayTask, type TodayAttentionItem } from "./today-model.ts";

const row = (id: string, priority: TodayAttentionItem["priority"], dueAt: string | null): TodayAttentionItem => ({ id, title: id, priority, dueAt, context: "", source: "Tasks", assignee: null, href: "/projects", action: "Open" });

test("attention is ordered by severity then earliest deadline, with stable null-deadline ordering", () => {
  const ordered = prioritizeTodayAttention([row("low", "medium", "2026-01-01T00:00:00Z"), row("urgent-late", "urgent", "2026-10-26T18:00:00Z"), row("urgent-early", "urgent", "2026-10-26T10:00:00Z"), row("urgent-none", "urgent", null)]);
  assert.deepEqual(ordered.map((item) => item.id), ["urgent-early", "urgent-late", "urgent-none", "low"]);
});

test("a repeated source record occupies one attention row", () => {
  const result = prioritizeTodayAttention([row("task-a", "high", null), { ...row("task-a", "high", null), title: "Fresh snapshot" }, row("invoice-a", "high", null)]);
  assert.equal(result.length, 2);
  assert.equal(result.find((item) => item.id === "task-a")?.title, "Fresh snapshot");
});

test("task deadline follows organization day rather than UTC midnight", () => {
  const zone = "America/Indiana/Indianapolis";
  const now = "2026-10-27T02:00:00Z";
  assert.equal(todayDateKey(now, zone), "2026-10-26");
  assert.equal(taskNeedsAttention({ status: "todo", dueDate: "2026-10-26T16:00:00Z" }, now, zone), false);
  assert.equal(taskNeedsAttention({ status: "todo", dueDate: "2026-10-25T16:00:00Z" }, now, zone), true);
});

test("completed and missing/invalid deadlines never create overdue work; blocked status does", () => {
  const now = "2026-10-26T12:00:00Z";
  assert.equal(taskNeedsAttention({ status: "completed", dueDate: "2020-01-01T00:00:00Z" }, now, "UTC"), false);
  assert.equal(taskNeedsAttention({ status: "todo", dueDate: null }, now, "UTC"), false);
  assert.equal(taskNeedsAttention({ status: "todo", dueDate: "invalid" }, now, "UTC"), false);
  assert.equal(taskNeedsAttention({ status: "blocked", dueDate: null }, now, "UTC"), true);
});

test("DST day identity is stable and invalid timezone falls back to UTC", () => {
  assert.equal(todayDateKey("2026-11-01T05:30:00Z", "America/New_York"), "2026-11-01");
  assert.equal(todayDateKey("2026-11-01T06:30:00Z", "America/New_York"), "2026-11-01");
  assert.equal(safeTodayTimeZone("invalid-zone"), "UTC");
  assert.equal(todayDateKey("invalid", "UTC"), null);
});

// Execute the actual server loader with transport/session seams and real domain logic.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { hasPermission, isSupportedRole, normalizeRole } from "../../../app/domain/contracts.ts";
import * as attentionModel from "../components/dashboard/needs-attention-model.ts";
import * as todayModel from "./today-model.ts";
import type { TodayData } from "./today-model.ts";

const FIXTURE_NOW = "2026-10-26T12:00:00.000Z";
class FixtureDate extends Date {
  constructor(value?: string | number | Date) {
    super(value === undefined ? FIXTURE_NOW : value instanceof Date ? value.getTime() : value);
  }
  static now() { return Date.parse(FIXTURE_NOW); }
}

function createLoader(role = "owner", overrides: Record<string, (...args: unknown[]) => Promise<unknown>> = {}, authenticated = true) {
  const calls: { method: string; args: unknown[] }[] = [];
  const summary = { generatedAt: FIXTURE_NOW, activeJobs: 3, scheduledToday: 1, scope: { source: role === "technician" ? "assigned_only" : "organization", role }, todayRangeUtc: { start: "2026-10-26T04:00:00Z", end: "2026-10-27T04:00:00Z" }, weekRangeUtc: { start: "2026-10-26T04:00:00Z", end: "2026-11-02T05:00:00Z" }, timezone: { value: "America/Indiana/Indianapolis" } };
  const base: Record<string, (...args: unknown[]) => Promise<unknown>> = {
    getOrganizationSettings: async () => ({ currentRole: role, currentUserId: "user-a", settings: { companyName: "Acme" }, teamMembers: [{ userId: "user-a", fullName: "Billy Showalter" }] }),
    getDispatchSummary: async () => summary,
    getAthenaCapabilities: async () => ({ kernelEnabled: true }),
    listJobsForDispatch: async () => ({ items: [{ id: "job-a", title: "Paint cabinets", jobNumber: "J1", status: "scheduled", archivedAt: null, scheduledStart: "2026-10-26T12:00:00Z", scheduledEnd: "2026-10-26T16:00:00Z", project: { id: "project-a", name: "Kitchen" }, customer: null, assignedTechnicians: [{ userId: "user-a", name: "Billy" }], isOverdue: false }], total: 1 }),
    listAssignedJobTasks: async () => [], listOrganizationProjectTasks: async () => [], listProposalQueue: async () => ({ items: [], total: 0, nextCursor: null }),
    listEstimateQueue: async () => ({ items: [], total: 0, nextCursor: null }), listInvoiceQueue: async () => ({ items: [], total: 0, nextCursor: null }),
    listAthenaApprovals: async () => [], getScheduleConflicts: async () => ({ conflicts: [] }),
  };
  const api = Object.fromEntries(Object.entries({ ...base, ...overrides }).map(([method, fn]) => [method, async (...args: unknown[]) => { calls.push({ method, args }); return fn(...args); }]));
  const code = ts.transpileModule(readFileSync(new URL("./today-data.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const runtimeModule: { exports: Record<string, unknown> } = { exports: {} };
  vm.runInNewContext(code, { module: runtimeModule, exports: runtimeModule.exports, Date: FixtureDate, Intl, Map, Set,
    require: (specifier: string) => {
      switch (specifier) {
        case "server-only": return {};
        case "react": return { cache: (fn: unknown) => fn };
        case "../../../app/domain/contracts": return { hasPermission, isSupportedRole, normalizeRole };
        case "@/lib/api": return { ...api, toInclusiveEndBoundary: (value: string) => new Date(Date.parse(value) - 1).toISOString() };
        case "@/lib/session": return { getSessionToken: async () => authenticated ? "private-test-token" : null, getSession: async () => authenticated ? { sub: "user-a", email: "billy@example.test" } : null };
        case "@/components/dashboard/needs-attention-model": return attentionModel;
        case "./today-model": return todayModel;
        default: throw new Error(`Unstubbed dependency ${specifier}`);
      }
    },
  });
  return { calls, run: runtimeModule.exports.loadTodayData as () => Promise<TodayData | null> };
}

test("actual loader preserves authenticated owner scope and never serializes credentials", async () => {
  const fixture = createLoader(); const data = await fixture.run(); assert.ok(data);
  assert.equal(data.viewer.presentation, "owner"); assert.equal(data.viewer.name, "Billy");
  assert.equal(data.generatedAt, FIXTURE_NOW);
  assert.equal(data.viewer.timeZone, "America/Indiana/Indianapolis"); assert.equal(data.companyName, "Acme");
  assert.equal(data.stats.find((stat) => stat.id === "active-jobs")?.value, 3);
  assert.equal(data.work[0].title, "Paint cabinets");
  assert.ok(fixture.calls.every((call) => call.args[0] === "private-test-token"));
  assert.equal(JSON.stringify(data).includes("private-test-token"), false);
});

test("actual field loader skips commercial, organization-task, approval and manager-conflict reads", async () => {
  const fixture = createLoader("technician"); const data = await fixture.run(); assert.ok(data);
  assert.equal(data.viewer.presentation, "field"); assert.equal(data.work[0].href, "/field?job=job-a");
  for (const method of ["listOrganizationProjectTasks", "listProposalQueue", "listEstimateQueue", "listInvoiceQueue", "listAthenaApprovals", "getScheduleConflicts"]) assert.equal(fixture.calls.some((call) => call.method === method), false, method);
  assert.equal(data.stats.find((stat) => stat.id === "tasks-due")?.value, 0);
  assert.ok(data.sources.some((source) => source.id === "tasks" && source.state === "ready"));
  assert.ok(data.sources.some((source) => source.id === "task-writes" && source.state === "restricted"));
});

test("actual loader rejects missing identity and unsupported roles before operational queue reads", async () => {
  const anonymous = createLoader("owner", {}, false); assert.equal(await anonymous.run(), null); assert.equal(anonymous.calls.length, 0);
  const unknown = createLoader("unknown-role"); assert.equal(await unknown.run(), null); assert.equal(unknown.calls.some((call) => call.method.startsWith("list")), false);
});

test("actual loader keeps schedule usable after an independent queue failure and marks attention unknown", async () => {
  const fixture = createLoader("owner", { listProposalQueue: async () => { throw new Error("network unavailable"); } });
  const data = await fixture.run(); assert.ok(data); assert.equal(data.work.length, 1);
  assert.equal(data.stats.find((stat) => stat.id === "active-jobs")?.value, 3);
  assert.equal(data.stats.find((stat) => stat.id === "attention")?.value, null);
  assert.ok(data.sources.some((source) => source.id === "proposals" && source.state === "unavailable"));
});

test("actual loader marks bounded queues partial and excludes passive or settled records", async () => {
  const invoice = { id: "invoice", projectId: "p", projectName: "Kitchen", customerName: "Customer", documentNumber: 1, status: "paid", balanceDue: 0, amount: 100, paidAmount: 100, dueDate: "2020-01-01T00:00:00Z", updatedAt: "2020-01-01T00:00:00Z" };
  const proposal = { id: "proposal", projectId: "p", projectName: "Kitchen", customerName: "Customer", status: "draft", amount: 100, contractId: null, sentAt: null, updatedAt: "2020-01-01T00:00:00Z" };
  const fixture = createLoader("owner", { listInvoiceQueue: async () => ({ items: [invoice], total: 100, nextCursor: "cursor" }), listProposalQueue: async () => ({ items: [proposal], total: 1, nextCursor: null }) });
  const data = await fixture.run(); assert.ok(data); assert.equal(data.attention.length, 0);
  assert.equal(data.stats.find((stat) => stat.id === "attention")?.value, null);
  assert.ok(data.sources.some((source) => source.id === "invoices-coverage" && source.state === "partial"));
});

test("disabled Athena skips pending approvals and does not advertise active capability", async () => {
  const fixture = createLoader("owner", { getAthenaCapabilities: async () => ({ kernelEnabled: false }) });
  const data = await fixture.run(); assert.ok(data); assert.equal(data.athenaEnabled, false);
  assert.equal(fixture.calls.some((call) => call.method === "listAthenaApprovals"), false);
  assert.equal(data.stats.find((stat) => stat.id === "approvals")?.value, null);
});

test("Athena capability failure makes owner approval and total attention unknown", async () => {
  const fixture = createLoader("owner", { getAthenaCapabilities: async () => { throw new Error("timeout"); } });
  const data = await fixture.run(); assert.ok(data);
  assert.equal(data.stats.find((stat) => stat.id === "attention")?.value, null);
  assert.ok(data.sources.some((source) => source.id === "approvals" && source.state === "unavailable"));
  assert.equal(fixture.calls.some((call) => call.method === "listAthenaApprovals"), false);
});

test("real upcoming schedule remains separate from today's work and excludes terminal jobs", async () => {
  const future = { id: "job-next", title: "Future cabinet install", jobNumber: "J2", status: "scheduled", archivedAt: null, scheduledStart: "2026-10-28T12:00:00Z", scheduledEnd: "2026-10-28T16:00:00Z", project: { id: "project-a", name: "Kitchen" }, customer: null, assignedTechnicians: [{ userId: "user-a", name: "Billy" }], isOverdue: false };
  const fixture = createLoader("owner", { listJobsForDispatch: async (_token, params) => {
    const range = params as { scheduledFrom: string };
    return range.scheduledFrom === "2026-10-27T04:00:00Z" ? { items: [future, { ...future, id: "closed", status: "completed" }], total: 2 } : { items: [], total: 0 };
  } });
  const data = await fixture.run(); assert.ok(data);
  assert.equal(data.work.length, 0);
  assert.equal(data.upcoming?.length, 1);
  assert.equal(data.upcoming?.[0].title, "Future cabinet install");
  assert.equal(data.stats.find((stat) => stat.id === "people")?.value, 0);
  const upcomingRead = fixture.calls.find((call) => call.method === "listJobsForDispatch" && (call.args[1] as { scheduledFrom: string }).scheduledFrom === "2026-10-27T04:00:00Z");
  assert.equal((upcomingRead?.args[1] as { scheduledTo: string }).scheduledTo, "2026-11-02T04:59:59.999Z");
  assert.ok(data.sources.some((source) => source.id === "site-visits" && source.state === "restricted"));
  assert.ok(data.sources.some((source) => source.id === "crew-groups" && source.state === "restricted"));
});


test("stored midnight UTC task deadline preserves its calendar day in Indiana and positive timezones", () => {
  const task = { status: "todo", dueDate: "2026-10-26T00:00:00.000Z" };
  // Both users are on October 26 locally, despite the deadline instant being Oct 25 in Indiana.
  for (const zone of ["America/Indiana/Indianapolis", "Asia/Tokyo"]) {
    assert.equal(taskDueBucket(task, "2026-10-26T12:00:00Z", zone), "today");
    assert.equal(isTodayTask(task, "2026-10-26T12:00:00Z", zone), true);
    assert.equal(taskNeedsAttention(task, "2026-10-26T12:00:00Z", zone), false);
  }
  assert.equal(taskDueBucket(task, "2026-10-27T02:00:00Z", "America/Indiana/Indianapolis"), "today");
  assert.equal(taskDueBucket(task, "2026-10-27T05:00:00Z", "America/Indiana/Indianapolis"), "overdue");
  assert.equal(taskDueBucket(task, "2026-10-26T16:00:00Z", "Asia/Tokyo"), "overdue");
});

test("actual loader reconciles midnight-UTC task KPI, work list and attention to the stored due day", async () => {
  for (const timeZone of ["America/Indiana/Indianapolis", "Asia/Tokyo"]) {
    const storedDay = todayDateKey(FIXTURE_NOW, timeZone);
    const fixture = createLoader("owner", {
      getOrganizationSettings: async () => ({ currentRole: "owner", currentUserId: "user-a", settings: { companyName: "Acme", timezone: timeZone }, teamMembers: [] }),
      listOrganizationProjectTasks: async () => [{ id: "task-midnight", projectId: "project-a", projectName: "Kitchen", title: "Finish trim", status: "todo", priority: "medium", assignedTo: "Billy", dueDate: `${storedDay}T00:00:00.000Z`, updatedAt: "2026-10-20T00:00:00Z" }],
    });
    const data = await fixture.run(); assert.ok(data);
    assert.equal(data.stats.find((stat) => stat.id === "tasks-due")?.value, 1, timeZone);
    assert.equal(data.work.filter((item) => item.kind === "task").length, 1, timeZone);
    assert.equal(data.attention.some((item) => item.id === "task-task-midnight"), false, timeZone);
  }
});

function jobFixture(id: string, scheduledStart: string | null, extra: Record<string, unknown> = {}) {
  return { id, title: `Work ${id}`, jobNumber: id, status: "on_site", archivedAt: null, scheduledStart, scheduledEnd: null,
    project: { id: "project-a", name: "Kitchen" }, customer: null, assignedTechnicians: [{ userId: "user-a", name: "Billy" }],
    isOverdue: true, isUnassigned: false, needsAttention: true, ...extra };
}

test("overdue attention includes unfinished prior-day jobs, dedupes today's overlap and retains assigned field routes", async () => {
  const prior = jobFixture("prior", "2026-10-25T12:00:00Z");
  const current = jobFixture("current", "2026-10-26T10:00:00Z");
  for (const role of ["owner", "technician"]) {
    const fixture = createLoader(role, { listJobsForDispatch: async (_token, params) => {
      const filter = params as { needsAttention?: boolean; scheduledFrom?: string };
      return filter.needsAttention ? { items: [prior, current, prior], total: 3 }
        : filter.scheduledFrom === "2026-10-26T04:00:00Z" ? { items: [current], total: 1 } : { items: [], total: 0 };
    } });
    const data = await fixture.run(); assert.ok(data);
    assert.equal(data.attention.filter((item) => item.source === "Jobs").length, 2);
    assert.equal(data.attention.filter((item) => item.id === "job-overdue-current").length, 1);
    const oldJob = data.attention.find((item) => item.id === "job-overdue-prior"); assert.ok(oldJob);
    assert.equal(oldJob.dueAt, "2026-10-25T12:00:00Z");
    assert.equal(oldJob.href, role === "technician" ? "/field?job=prior" : "/dispatch?view=all&q=prior");
    assert.equal(data.work.some((item) => item.id === "job-prior"), false);
    const read = fixture.calls.find((call) => call.method === "listJobsForDispatch" && (call.args[1] as { needsAttention?: boolean }).needsAttention);
    assert.ok(read);
    assert.equal((read.args[1] as { scheduledFrom?: string }).scheduledFrom, undefined);
    assert.equal((read.args[1] as { scheduledTo: string }).scheduledTo, FIXTURE_NOW);
    assert.ok(data.sources.some((source) => source.id === "jobs-overdue" && source.state === "ready"));
  }
});

test("broad needsAttention candidates do not invent overdue exceptions for unassigned or unscheduled jobs", async () => {
  const candidates = [
    jobFixture("unassigned", "2026-10-25T10:00:00Z", { isOverdue: false, isUnassigned: true }),
    jobFixture("unscheduled", null, { isOverdue: false, status: "unscheduled" }),
    jobFixture("complete", "2026-10-25T10:00:00Z", { status: "completed" }),
    jobFixture("archived", "2026-10-25T10:00:00Z", { archivedAt: "2026-10-25T11:00:00Z" }),
  ];
  const fixture = createLoader("owner", { listJobsForDispatch: async (_token, params) => ({ items: (params as { needsAttention?: boolean }).needsAttention ? candidates : [], total: (params as { needsAttention?: boolean }).needsAttention ? candidates.length : 0 }) });
  const data = await fixture.run(); assert.ok(data);
  assert.equal(data.attention.length, 0);
  assert.equal(data.stats.find((stat) => stat.id === "attention")?.value, 0);
});

test("bounded overdue candidate pagination marks Needs You unknown rather than a complete count", async () => {
  const prior = jobFixture("prior", "2026-10-25T12:00:00Z");
  const fixture = createLoader("owner", { listJobsForDispatch: async (_token, params) => (params as { needsAttention?: boolean }).needsAttention
    ? { items: Array.from({ length: 100 }, () => prior), total: 501 } : { items: [], total: 0 } });
  const data = await fixture.run(); assert.ok(data);
  const reads = fixture.calls.filter((call) => call.method === "listJobsForDispatch" && (call.args[1] as { needsAttention?: boolean }).needsAttention);
  assert.equal(reads.length, 5);
  assert.equal(data.attention.length, 1);
  assert.equal(data.stats.find((stat) => stat.id === "attention")?.value, null);
  assert.ok(data.sources.some((source) => source.id === "jobs-overdue-coverage" && source.state === "partial"));
});

test("an overdue-read failure leaves today's schedule usable and aggregate attention unknown", async () => {
  const current = jobFixture("current", "2026-10-26T10:00:00Z", { isOverdue: false });
  const fixture = createLoader("owner", { listJobsForDispatch: async (_token, params) => {
    if ((params as { needsAttention?: boolean }).needsAttention) throw new Error("overdue read offline");
    return { items: [current], total: 1 };
  } });
  const data = await fixture.run(); assert.ok(data);
  assert.equal(data.work.length, 1);
  assert.equal(data.stats.find((stat) => stat.id === "attention")?.value, null);
  assert.ok(data.sources.some((source) => source.id === "jobs-overdue" && source.state === "unavailable"));
});


test("manager scheduled, overdue and upcoming Jobs navigate to the canonical filtered Dispatch source", async () => {
  const job = jobFixture("specific", "2026-10-26T10:00:00Z", { jobNumber: "JOB #42/A&B" });
  const fixture = createLoader("owner", { listJobsForDispatch: async () => ({ items: [job], total: 1 }) });
  const data = await fixture.run(); assert.ok(data);
  const destination = "/dispatch?view=all&q=JOB%20%2342%2FA%26B";
  assert.equal(data.work.find((item) => item.kind === "job")?.href, destination);
  assert.equal(data.upcoming?.[0].href, destination);
  assert.equal(data.attention.find((item) => item.source === "Jobs")?.href, destination);
  assert.equal(JSON.stringify(data).includes("tab=jobs"), false);
});

test("task mutation targets come from the source record and completed refreshes clear work and attention", async () => {
  const task = { id: "task-saved", projectId: "project-a", projectName: "Kitchen", title: "Inspect flashing", status: "blocked", priority: "high", assignedTo: "Office", dueDate: "2026-10-26T00:00:00.000Z", updatedAt: FIXTURE_NOW };
  const { run } = createLoader("dispatcher", { listOrganizationProjectTasks: async () => [task] });
  const before = (await run())!;
  assert.deepEqual(JSON.parse(JSON.stringify(before.attention[0].task)), { taskId: task.id, projectId: task.projectId, status: "blocked", updatedAt: FIXTURE_NOW });
  assert.equal(before.attention[0].status, "blocked");
  assert.equal(before.work.find(item => item.id === `task-${task.id}`)?.task?.taskId, task.id);
  task.status = "completed";
  const after = (await run())!;
  assert.equal(after.attention.some(item => item.id === `task-${task.id}`), false);
  assert.equal(after.work.some(item => item.id === `task-${task.id}`), false);
  assert.equal(after.stats.find(item => item.id === "tasks-due")?.value, 0);
  assert.equal(after.stats.find(item => item.id === "attention")?.value, 0);
});


test("field tasks use active job scope, stored due day and read-only source navigation", async () => {
  const task = { id: "shared-task", jobId: "job-a", projectId: "project-a", projectName: "Kitchen", jobTitle: "Paint cabinets", title: "Collect materials", status: "blocked", priority: "high", assignedTo: "Another crew member", dueDate: "2026-10-26T00:00:00Z", updatedAt: FIXTURE_NOW };
  const fixture = createLoader("technician", { listAssignedJobTasks: async () => [task, { ...task, id: "ordinary", status: "todo", dueDate: null }] });
  const data = await fixture.run(); assert.ok(data);
  assert.equal(data.stats.find((stat) => stat.id === "tasks-due")?.value, 1);
  const work = data.work.filter((row) => row.kind === "task"); assert.equal(work.length, 2);
  assert.ok(work.every((row) => row.href === "/field?job=job-a" && !row.task));
  const item = data.attention.find((row) => row.id === "task-shared-task"); assert.ok(item);
  assert.equal(item.source, "Job tasks"); assert.equal(item.task, undefined);
  assert.equal(item.action, "Open assigned job");
  assert.equal(data.attention.some((row) => row.id === "task-ordinary"), false);
  assert.equal(fixture.calls.filter((call) => call.method === "listAssignedJobTasks").length, 1);
});

test("field task failure preserves jobs and marks task counts unknown", async () => {
  for (const load of [async () => { throw new Error("network unavailable"); }, async () => [{ id: "missing-job", status: "todo" }]]) {
    const data = await createLoader("technician", { listAssignedJobTasks: load }).run(); assert.ok(data);
    assert.ok(data.work.some((row) => row.kind === "job"));
    assert.equal(data.stats.find((stat) => stat.id === "tasks-due")?.value, null);
    assert.ok(data.sources.some((source) => source.id === "tasks" && source.state === "unavailable"));
  }
});

test("capped field task results do not claim an exact total", async () => {
  const data = await createLoader("technician", { listAssignedJobTasks: async () => Array.from({ length: 50 }, (_, i) => ({ id: String(i), jobId: "job-a", title: "Shared task", projectName: "Kitchen", status: "todo", dueDate: "2026-10-26T00:00:00Z" })) }).run(); assert.ok(data);
  assert.equal(data.stats.find((stat) => stat.id === "tasks-due")?.value, null);
  assert.ok(data.sources.some((source) => source.id === "tasks-coverage" && source.state === "partial"));
});


test("field loader grants edit targets only to explicit personal identity on assigned Jobs", async () => {
  const base = { id: "own", projectId: "project-a", jobId: "job-a", projectName: "Kitchen", title: "Inspect", status: "blocked", assignedTo: "Same display name", updatedAt: FIXTURE_NOW };
  const data = await createLoader("technician", { listAssignedJobTasks: async () => [{ ...base, assignedUserId: "user-a", canUpdateStatus: true }, { ...base, id: "other", assignedUserId: "other" }, { ...base, id: "legacy" }] }).run(); assert.ok(data);
  const own = data.work.find(row => row.id === "task-own"); assert.equal(own?.task?.access, "assigned-field"); assert.equal(own?.task?.jobId, "job-a");
  assert.equal(data.work.find(row => row.id === "task-other")?.task, undefined);
  assert.equal(data.work.find(row => row.id === "task-legacy")?.task, undefined);
});
