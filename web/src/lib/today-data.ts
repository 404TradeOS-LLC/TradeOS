import "server-only";
import { cache } from "react";
import { hasPermission, isSupportedRole, normalizeRole } from "../../../app/domain/contracts";
import {
  getAthenaCapabilities, getDispatchSummary, getOrganizationSettings, getScheduleConflicts,
  listAthenaApprovals, listEstimateQueue, listInvoiceQueue, listJobsForDispatch,
  listAssignedJobTasks, listOrganizationProjectTasks, listProposalQueue, toInclusiveEndBoundary,
  type DispatchJob, type DispatchSummary,
} from "@/lib/api";
import { getSession, getSessionToken } from "@/lib/session";
import { getStaleProposalCutoffIso, buildAttentionInvoiceRows, buildAttentionProposalRows } from "@/components/dashboard/needs-attention-model";
import { prioritizeTodayAttention, safeTodayTimeZone, taskNeedsAttention, isTodayTask, type TodayAttentionItem, type TodayData, type TodaySource, type TodayWorkItem } from "./today-model";

const LIMIT = 50;
const JOB_PAGE_LIMIT = 5;

/** Bounded operational view. Every backend read retains JWT, membership and forced RLS. */
export const loadTodayData = cache(async (): Promise<TodayData | null> => {
  const [token, session] = await Promise.all([getSessionToken(), getSession()]);
  if (!token || !session) return null;
  const [settings, initialSummary, capabilities] = await Promise.all([
    getOrganizationSettings(token).catch(() => null),
    getDispatchSummary(token).catch(() => null),
    getAthenaCapabilities(token).catch(() => null),
  ]);
  if (!settings || !isSupportedRole(settings.currentRole)) return null;
  const role = settings.currentRole;
  const canonicalRole = normalizeRole(role);
  const field = canonicalRole === "technician";
  const manager = hasPermission(role, "dispatch.manage");
  const owner = canonicalRole === "owner" || canonicalRole === "admin";
  const commercial = !field && hasPermission(role, "crm.write");
  const member = settings.teamMembers.find((item) => item.userId === settings.currentUserId);
  const name = member?.fullName?.trim().split(/\s+/)[0] || session.email?.split("@")[0] || "there";
  const generatedAt = new Date().toISOString();
  const sources: TodaySource[] = [];
  const attention: TodayAttentionItem[] = [], work: TodayWorkItem[] = [], upcoming: TodayWorkItem[] = [], progress: TodayAttentionItem[] = [];
  const summary: DispatchSummary | null = initialSummary;
  let todayJobs: DispatchJob[] = [];
  let todayJobsComplete = false;
  let dueTasks: number | null = null, approvals: number | null = null, conflictsCount: number | null = null;
  const athenaEnabled = capabilities?.kernelEnabled === true;
  sources.push({ id: "athena", label: "Athena", state: capabilities ? "ready" : "unavailable", ...(capabilities ? {} : { message: "Athena capabilities could not load." }) });
  const timeZone = safeTodayTimeZone(settings.settings.timezone || summary?.timezone.value);

  async function read<T>(id: string, label: string, request: () => Promise<T>, apply: (value: T) => void) {
    try { const result = await request(); apply(result); sources.push({ id, label, state: "ready" }); }
    catch { sources.push({ id, label, state: "unavailable", message: `${label} could not load. Other sections remain usable.` }); }
  }
  const partial = (id: string, label: string, message: string) => sources.push({ id: `${id}-coverage`, label, state: "partial", message });
  const restricted = (id: string, label: string, message: string) => sources.push({ id, label, state: "restricted", message });

  function addOverdueJobs(jobs: DispatchJob[]) {
    for (const job of jobs) {
      // needsAttention also includes unassigned/unscheduled jobs; only the
      // server's overdue flag identifies this exception. Keep terminal and
      // missing-schedule records out even if a stale transport returned them.
      if (!job.isOverdue || !job.scheduledStart || job.archivedAt || ["completed", "cancelled"].includes(job.status)) continue;
      attention.push({
        id: `job-overdue-${job.id}`, title: `${job.title} · overdue work`, context: job.jobNumber, source: "Jobs", priority: "high",
        assignee: job.assignedTechnicians.map((tech) => tech.name).join(", ") || null, dueAt: job.scheduledStart,
        href: field ? `/field?job=${job.id}` : `/dispatch?view=all&q=${encodeURIComponent(job.jobNumber)}`, action: "Open job",
      });
    }
  }

  const schedule = read("schedule", "Schedule", async () => {
    const result = summary;
    if (!result) throw new Error("Schedule context unavailable");
    const jobs: DispatchJob[] = [];
    let page = 1, total = 0;
    do {
      const response = await listJobsForDispatch(token, {
        scheduledFrom: result.todayRangeUtc.start, scheduledTo: toInclusiveEndBoundary(result.todayRangeUtc.end),
        page, pageSize: 100,
      });
      jobs.push(...response.items); total = response.total; page++;
      if (response.items.length === 0) break;
    } while (jobs.length < total && page <= JOB_PAGE_LIMIT);
    todayJobsComplete = jobs.length >= total;
    if (!todayJobsComplete) partial("schedule", "Schedule coverage", "Showing the first 500 scheduled records. Open Dispatch for the complete schedule.");
    return jobs;
  }, (jobs) => {
    todayJobs = jobs.filter((job) => !["completed", "cancelled"].includes(job.status) && !job.archivedAt);
    for (const job of todayJobs) work.push({
      id: `job-${job.id}`, title: job.title, context: [job.jobNumber, job.project?.name, job.customer?.name].filter(Boolean).join(" · "),
      kind: "job", start: job.scheduledStart, end: job.scheduledEnd,
      assignee: job.assignedTechnicians.map((tech) => tech.name).join(", ") || null, status: job.status,
      href: field ? `/field?job=${job.id}` : `/dispatch?view=all&q=${encodeURIComponent(job.jobNumber)}`,
    });
    addOverdueJobs(todayJobs);
  });

  const requests: Promise<void>[] = [schedule];
  if (summary) requests.push(read("jobs-overdue", "Overdue work", async () => {
    const jobs: DispatchJob[] = [];
    let page = 1, total = 0;
    do {
      const response = await listJobsForDispatch(token, {
        // Deliberately no lower schedule bound: unfinished jobs from prior
        // days remain actionable. The summary instant bounds this snapshot.
        needsAttention: true, scheduledTo: summary.generatedAt, page, pageSize: 100,
      });
      jobs.push(...response.items); total = response.total; page++;
      if (response.items.length === 0) break;
    } while (jobs.length < total && page <= JOB_PAGE_LIMIT);
    if (jobs.length < total) partial("jobs-overdue", "Overdue work coverage", "Only the first 500 attention candidates are loaded. Open Dispatch for the complete overdue queue.");
    return jobs;
  }, addOverdueJobs));
  else sources.push({ id: "jobs-overdue", label: "Overdue work", state: "unavailable", message: "Schedule context is unavailable, so overdue work cannot be determined." });
  if (summary) requests.push(read("upcoming", "Upcoming work", async () => {
    if (Date.parse(summary.todayRangeUtc.end) >= Date.parse(summary.weekRangeUtc.end)) return [] as DispatchJob[];
    const jobs: DispatchJob[] = [];
    let page = 1, total = 0;
    do {
      const response = await listJobsForDispatch(token, {
        scheduledFrom: summary.todayRangeUtc.end, scheduledTo: toInclusiveEndBoundary(summary.weekRangeUtc.end),
        page, pageSize: 100,
      });
      jobs.push(...response.items); total = response.total; page++;
      if (response.items.length === 0) break;
    } while (jobs.length < total && page <= JOB_PAGE_LIMIT);
    if (jobs.length < total) partial("upcoming", "Upcoming coverage", "Showing the first 500 upcoming records. Open Dispatch for the complete schedule.");
    return jobs;
  }, (jobs) => {
    for (const job of jobs) {
      if (["completed", "cancelled"].includes(job.status) || job.archivedAt) continue;
      upcoming.push({ id: `upcoming-${job.id}`, title: job.title,
        context: [job.jobNumber, job.project?.name, job.customer?.name].filter(Boolean).join(" · "),
        kind: "job", start: job.scheduledStart, end: job.scheduledEnd,
        assignee: job.assignedTechnicians.map((tech) => tech.name).join(", ") || null, status: job.status,
        href: field ? `/field?job=${job.id}` : `/dispatch?view=all&q=${encodeURIComponent(job.jobNumber)}`,
      });
    }
  }));
  else sources.push({ id: "upcoming", label: "Upcoming work", state: "unavailable", message: "Schedule context is unavailable, so upcoming work cannot be determined." });
  restricted("site-visits", "Site visits", "Site Visit records are available within Projects. A supported organization-wide visit schedule is not available here; open the Project workspace for visit details.");
  restricted("crew-groups", "Crew groups", "Today shows assigned people from scheduled Jobs. Crew group aggregation is not supported by the existing schedule contract.");
  if (commercial || field) requests.push(read("tasks", field ? "Assigned-job tasks" : "Project tasks",
    () => field ? listAssignedJobTasks(token, { limit: LIMIT }) : listOrganizationProjectTasks(token, { limit: LIMIT, includeCompleted: false }), (tasks) => {
      if (field && tasks.some(task => !("jobId" in task) || !task.jobId)) throw new Error("Assigned tasks are missing job context.");
      dueTasks = tasks.filter(task => isTodayTask(task, generatedAt, timeZone)).length;
      if (tasks.length === LIMIT) { dueTasks = null; partial("tasks", "Task coverage", "The first 50 open tasks are loaded. Totals may be incomplete."); }
      for (const task of tasks) {
        if (task.status === "completed") continue;
        const jobId = "jobId" in task ? task.jobId : null;
        const href = field ? `/field?job=${encodeURIComponent(String(jobId))}` : `/projects/${task.projectId}?tab=tasks`;
        const editable = field ? {} : { task: { projectId: task.projectId, taskId: task.id, status: task.status, updatedAt: task.updatedAt } };
        const context = [task.projectName, field ? task.jobTitle : null].filter(Boolean).join(" · ");
        if (field || isTodayTask(task, generatedAt, timeZone)) work.push({ id: `task-${task.id}`, title: task.title, context,
          kind: "task", start: null, end: null, assignee: task.assignedTo, status: task.status, href, ...editable, dueAt: task.dueDate });
        if (taskNeedsAttention(task, generatedAt, timeZone)) attention.push({ id: `task-${task.id}`, title: task.title,
          context: [context, task.status === "blocked" ? "Blocked task" : "Overdue task"].join(" · "), source: field ? "Job tasks" : "Tasks",
          priority: task.status === "blocked" ? "urgent" : "high", assignee: task.assignedTo, dueAt: task.dueDate, href,
          action: field ? "Open assigned job" : task.status === "blocked" ? "Resolve blocker" : "Update task", updatedAt: task.updatedAt, status: task.status, ...editable });
      }
    }));
  if (commercial) {
    requests.push(read("proposals", "Proposal follow-ups", () => listProposalQueue(token, { unsigned: true, staleBefore: getStaleProposalCutoffIso(new Date(generatedAt)), limit: LIMIT }), (queue) => {
      if (queue.nextCursor) partial("proposals", "Proposal coverage", `${queue.total} stale proposals; the first ${queue.items.length} are loaded.`);
      for (const proposal of buildAttentionProposalRows(queue.items.filter((item) => item.contractId === null && item.sentAt !== null && Date.parse(item.sentAt) <= Date.parse(getStaleProposalCutoffIso(new Date(generatedAt))) && ["sent", "viewed"].includes(item.status)), [])) attention.push({ id: `proposal-${proposal.proposalId}`, title: `${proposal.projectName} · follow-up needed`,
        context: proposal.customerName, source: "Proposals", priority: "high", assignee: null, dueAt: proposal.sentAt,
        href: `/projects/${proposal.projectId}/proposals/${proposal.proposalId}`, action: "Review proposal" });
    }));
    requests.push(read("estimates", "Estimates in progress", () => listEstimateQueue(token, { status: "draft,ready", limit: LIMIT }), (queue) => {
      if (queue.nextCursor) partial("estimates", "Estimate coverage", `The first ${queue.items.length} of ${queue.total} estimates are loaded.`);
      for (const estimate of queue.items) progress.push({ id: `estimate-${estimate.id}`, title: `${estimate.projectName} · estimate v${estimate.revision}`,
        context: [estimate.customerName, estimate.status].filter(Boolean).join(" · "), source: "Estimates", priority: "medium", assignee: null, dueAt: null,
        href: `/projects/${estimate.projectId}/estimates/${estimate.id}`, action: "Continue estimate", updatedAt: estimate.updatedAt });
    }));
    if (hasPermission(role, "billing.write")) requests.push(read("invoices", "Overdue invoices", () => listInvoiceQueue(token, { overdue: true, limit: LIMIT }), (queue) => {
      if (queue.nextCursor) partial("invoices", "Invoice coverage", `${queue.total} overdue invoices; the first ${queue.items.length} are loaded.`);
      for (const invoice of buildAttentionInvoiceRows(queue.items.filter((item) => item.balanceDue > 0 && item.dueDate !== null && Date.parse(item.dueDate) < Date.parse(generatedAt) && !["draft", "paid", "voided"].includes(item.status)), [])) attention.push({ id: `invoice-${invoice.invoiceId}`, title: `Invoice #${invoice.documentNumber} overdue`,
        context: [invoice.projectName, invoice.customerName].join(" · "), source: "Invoices", priority: "high", assignee: null, dueAt: invoice.dueDate,
        href: `/projects/${invoice.projectId}/invoices/${invoice.invoiceId}`, action: "Review invoice" });
    }));
  } else {
    if (field) restricted("task-writes", "Task updates", "Shared tasks are visible through your active Job assignments. Task updates still require the existing office permissions; a personal field-task write contract is not enabled.");
    else restricted("tasks", "Project tasks", "Your role does not have access to the organization task queue.");
    restricted("commercial", "Commercial queues", "Estimates, proposals and invoices are omitted from the field presentation.");
  }
  if (owner && athenaEnabled) requests.push(read("approvals", "Pending approvals", () => listAthenaApprovals(token, { status: "pending", limit: 200 }), (items) => {
    const pending = items.filter((item) => item.status === "pending" && Date.parse(item.expiration) > Date.parse(generatedAt));
    approvals = items.length === 200 ? null : pending.length;
    if (items.length === 200) partial("approvals", "Approval coverage", "The first 200 approvals are loaded; the count is unavailable until the full queue is known.");
    for (const item of pending) attention.push({ id: `approval-${item.approvalId}`, title: `Approval required · ${item.toolId}`, context: `${item.riskLevel} risk action`, source: "Approvals",
      priority: item.riskLevel === "high" ? "urgent" : "high", assignee: null, dueAt: item.expiration,
      href: `/athena/approvals?approvalId=${item.approvalId}`, action: "Review approval" });
  }));
  else if (owner && !capabilities) sources.push({ id: "approvals", label: "Pending approvals", state: "unavailable", message: "Athena capabilities could not load, so pending approval availability is unknown." });
  else restricted("approvals", "Pending approvals", owner ? "Athena approval review is unavailable while Athena is disabled." : "Approval review is available only to owners and administrators.");

  if (manager && summary) requests.push(read("conflicts", "Scheduling conflicts", () => getScheduleConflicts(token, { scheduledFrom: summary!.todayRangeUtc.start, scheduledTo: summary!.weekRangeUtc.end }), (result) => {
    const unique = new Map(result.conflicts.map((conflict) => [`${conflict.technicianId}:${conflict.conflictingJobId}:${conflict.conflictingScheduledStart}`, conflict]));
    conflictsCount = unique.size;
    for (const [id, conflict] of unique) attention.push({ id: `conflict-${id}`, title: `${conflict.conflictingJobNumber} · scheduling conflict`, context: conflict.conflictingJobTitle,
      source: "Schedule", priority: "urgent", assignee: conflict.technicianName, dueAt: conflict.conflictingScheduledStart,
      href: "/dispatch?mode=week", action: "Resolve conflict" });
  }));
  else if (manager) sources.push({ id: "conflicts", label: "Scheduling conflicts", state: "unavailable", message: "Schedule context is unavailable, so conflicts cannot be determined." });
  else restricted("conflicts", "Scheduling conflicts", "Organization conflict review requires dispatch access.");
  await Promise.all(requests);
  const rows = prioritizeTodayAttention(attention);
  const attentionSources = new Set(["schedule", "jobs-overdue", "tasks", "proposals", "invoices", "approvals", "conflicts"]);
  const attentionUnavailable = sources.some((source) => (attentionSources.has(source.id) || [...attentionSources].some((id) => source.id === `${id}-coverage`)) && ["unavailable", "partial"].includes(source.state));
  const summaryValue = summary as DispatchSummary | null;
  const people = new Set(todayJobs.flatMap((job) => job.assignedTechnicians.map((tech) => tech.userId))).size;
  return {
    companyName: settings.settings.companyName?.trim() || "TradeOS",
    viewer: { name, role, presentation: field ? "field" : owner ? "owner" : "office", timeZone }, generatedAt,
    stats: [
      { id: "active-jobs", label: field ? "My active jobs" : "Active jobs", value: summaryValue?.activeJobs ?? null, href: field ? "/field" : "/dispatch", helper: summaryValue?.scope.source === "assigned_only" ? "Assigned jobs only" : "Organization operational summary" },
      { id: "people", label: "People scheduled", value: todayJobsComplete ? people : null, href: field ? "/field" : "/dispatch?scheduled=today", helper: "Distinct assigned people on today's active jobs; crew groups are unavailable" },
      { id: "tasks-due", label: "Tasks due today", value: dueTasks, href: "/dashboard/work", helper: field ? "Shared tasks on your assigned active jobs; stored due day" : "Open tasks due on the organization's local day" },
      { id: "attention", label: "Needs you", value: attentionUnavailable ? null : rows.length, href: "/dashboard/needs-you", helper: attentionUnavailable ? "Some sources are unavailable or only partially loaded" : "Unresolved actions in accessible queues" },
      { id: "approvals", label: "Pending approvals", value: approvals, href: owner ? "/athena/approvals" : "/dashboard/needs-you", helper: owner ? "Unexpired pending Athena approvals" : "Owner/admin approval access required" },
      { id: "conflicts", label: "Schedule conflicts", value: conflictsCount, href: manager ? "/dispatch?mode=week" : "/field", helper: manager ? "Distinct technician/job overlaps in the organization week" : "Dispatch access required" },
    ], attention: rows, work: work.sort((a, b) => (a.start || "z").localeCompare(b.start || "z")), upcoming: upcoming.sort((a, b) => (a.start || "z").localeCompare(b.start || "z")), progress, sources, athenaEnabled,
  };
});
