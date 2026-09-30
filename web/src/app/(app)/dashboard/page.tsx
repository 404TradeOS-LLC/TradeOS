import type { Metadata } from "next";
import {
  getDispatchSummary,
  getOrganizationSettings,
  getProject,
  listEstimateQueue,
  listInvoiceQueue,
  listJobsForDispatch,
  listProjects,
  listProposalQueue,
  toInclusiveEndBoundary,
  type DispatchJob,
  type EstimateQueueItem,
  type InvoiceQueueItem,
  type ProposalQueueItem,
} from "@/lib/api";
import { formatScheduleInZone } from "@/lib/document-workflow";
import { getSessionToken } from "@/lib/session";
import type { OwnerScheduleItem } from "@/components/dashboard/owner-dashboard-data";
import type { AttentionStartRow } from "@/components/dashboard/needs-attention-card";
import {
  buildAttentionEstimateRows,
  buildAttentionInvoiceRows,
  buildAttentionProposalRows,
  getStaleProposalCutoffIso,
} from "@/components/dashboard/needs-attention-model";
import { buildContinueWorkingRows } from "@/components/dashboard/continue-working-model";
import { buildReceivablesSummary } from "@/components/dashboard/receivables-model";
import { OwnerDashboardHeader } from "@/components/dashboard/owner-dashboard-header";
import { TodayCommandBoard } from "@/components/dashboard/today-command-board";
import { loadDashboardProjectDetails, loadDashboardStartup, resolveDashboardOrganizationContext } from "./dashboard-startup";

export const metadata: Metadata = {
  title: "Today | TradeOS",
  description: "Contractor command center for work in motion, unresolved action, near-term schedule, and receivables.",
};

const DASHBOARD_PROJECT_DETAIL_LIMIT = 8;
const DASHBOARD_TODAY_JOB_LIMIT = 5;
const DASHBOARD_UPCOMING_JOB_LIMIT = 8;

const ATTENTION_OVERDUE_INVOICE_LIMIT = 10;
const ATTENTION_UNPAID_INVOICE_LIMIT = 15;
const ATTENTION_STALE_PROPOSAL_LIMIT = 10;
const ATTENTION_ESTIMATE_LIMIT = 15;

function emptyQueue<T>(): { items: T[]; total: number; nextCursor: string | null } {
  return { items: [], total: 0, nextCursor: null };
}

interface TodayScheduleWindow {
  today: { items: DispatchJob[]; total: number; error: string | null };
  upcoming: { items: DispatchJob[]; total: number; error: string | null };
  timezone: string;
}

const TERMINAL_JOB_STATUSES = new Set(["completed", "cancelled"]);
const DASHBOARD_SCHEDULE_FETCH_PAGE_SIZE = 100;

async function loadActiveScheduledJobs(
  token: string,
  input: { scheduledFrom: string; scheduledTo: string; limit: number }
): Promise<DispatchJob[]> {
  const activeJobs: DispatchJob[] = [];
  let page = 1;
  let totalRows = 0;

  do {
    const result = await listJobsForDispatch(token, {
      scheduledFrom: input.scheduledFrom,
      scheduledTo: input.scheduledTo,
      page,
      pageSize: DASHBOARD_SCHEDULE_FETCH_PAGE_SIZE,
    });
    totalRows = result.total;

    for (const job of result.items) {
      if (TERMINAL_JOB_STATUSES.has(job.status)) continue;
      activeJobs.push(job);
      if (activeJobs.length >= input.limit) break;
    }

    page += 1;
  } while (
    activeJobs.length < input.limit &&
    (page - 1) * DASHBOARD_SCHEDULE_FETCH_PAGE_SIZE < totalRows
  );

  return activeJobs;
}

async function loadTodayScheduleWindow(token: string): Promise<TodayScheduleWindow> {
  let summary: Awaited<ReturnType<typeof getDispatchSummary>>;

  try {
    summary = await getDispatchSummary(token);
  } catch {
    const error = "Schedule context is temporarily unavailable";
    return {
      today: { items: [], total: 0, error },
      upcoming: { items: [], total: 0, error },
      timezone: "UTC",
    };
  }

  const todayRequest = loadActiveScheduledJobs(token, {
    scheduledFrom: summary.todayRangeUtc.start,
    scheduledTo: toInclusiveEndBoundary(summary.todayRangeUtc.end),
    limit: DASHBOARD_TODAY_JOB_LIMIT,
  });

  const hasUpcomingWindow = Date.parse(summary.todayRangeUtc.end) < Date.parse(summary.weekRangeUtc.end);
  const upcomingRequest = hasUpcomingWindow
    ? loadActiveScheduledJobs(token, {
        scheduledFrom: summary.todayRangeUtc.end,
        scheduledTo: toInclusiveEndBoundary(summary.weekRangeUtc.end),
        limit: DASHBOARD_UPCOMING_JOB_LIMIT,
      })
    : Promise.resolve([] as DispatchJob[]);

  const [todayResult, upcomingResult] = await Promise.allSettled([todayRequest, upcomingRequest]);

  return {
    today:
      todayResult.status === "fulfilled"
        ? { items: todayResult.value, total: summary.scheduledToday, error: null }
        : { items: [], total: summary.scheduledToday, error: "Today's schedule is temporarily unavailable" },
    upcoming:
      upcomingResult.status === "fulfilled"
        ? { items: upcomingResult.value, total: upcomingResult.value.length, error: null }
        : { items: [], total: 0, error: "Upcoming schedule is temporarily unavailable" },
    timezone: summary.timezone.value,
  };
}

async function loadInvoiceAttentionQueues(token: string) {
  const [overdueResult, unpaidResult] = await Promise.allSettled([
    listInvoiceQueue(token, { overdue: true, limit: ATTENTION_OVERDUE_INVOICE_LIMIT }),
    listInvoiceQueue(token, { unpaid: true, limit: ATTENTION_UNPAID_INVOICE_LIMIT }),
  ]);

  const overdue = overdueResult.status === "fulfilled" ? overdueResult.value : emptyQueue<InvoiceQueueItem>();
  const unpaid = unpaidResult.status === "fulfilled" ? unpaidResult.value : emptyQueue<InvoiceQueueItem>();
  const overdueFailed = overdueResult.status === "rejected";
  const unpaidFailed = unpaidResult.status === "rejected";
  const error =
    overdueFailed || unpaidFailed
      ? overdueFailed && unpaidFailed
        ? "Invoice queues are temporarily unavailable"
        : overdueFailed
          ? "Overdue invoice queue is temporarily unavailable"
          : "Open invoice queue is temporarily unavailable"
      : null;

  return {
    overdue,
    unpaid,
    error,
    overdueUnavailable: overdueFailed,
    openUnavailable: unpaidFailed,
  };
}

async function loadStaleProposalAttentionQueue(token: string, staleBeforeIso: string) {
  try {
    const queue = await listProposalQueue(token, {
      unsigned: true,
      staleBefore: staleBeforeIso,
      limit: ATTENTION_STALE_PROPOSAL_LIMIT,
    });
    return { queue, error: null as string | null };
  } catch (error) {
    return {
      queue: emptyQueue<ProposalQueueItem>(),
      error: error instanceof Error ? error.message : "Stale proposal queue is temporarily unavailable",
    };
  }
}

async function loadEstimateProgressQueue(token: string) {
  try {
    const queue = await listEstimateQueue(token, { status: "draft,ready", limit: ATTENTION_ESTIMATE_LIMIT });
    return { queue, error: null as string | null };
  } catch (error) {
    return {
      queue: emptyQueue<EstimateQueueItem>(),
      error: error instanceof Error ? error.message : "Estimate queue is temporarily unavailable",
    };
  }
}

function getProjectScopeLabel(projectCount: number, failedCount = 0) {
  let scopeLabel: string;
  if (projectCount === 0) scopeLabel = "loaded project set";
  else if (projectCount === 1) scopeLabel = "1 loaded project";
  else if (projectCount < DASHBOARD_PROJECT_DETAIL_LIMIT) scopeLabel = `${projectCount} loaded projects`;
  else scopeLabel = `recent ${DASHBOARD_PROJECT_DETAIL_LIMIT} loaded projects`;

  if (failedCount === 0) return scopeLabel;
  return `${scopeLabel}; ${failedCount} project detail${failedCount === 1 ? "" : "s"} unavailable`;
}

function toScheduleItem(job: DispatchJob, timezone: string): OwnerScheduleItem {
  return {
    id: job.id,
    timeWindow: job.scheduledStart ? formatScheduleInZone(job.scheduledStart, timezone) : "Unscheduled",
    title: job.title,
    customer: job.customer?.name ?? "No customer linked",
    address: job.project?.siteAddress ?? "No site address on file",
    crew: job.assignedTechnicians.length > 0 ? job.assignedTechnicians.map((tech) => tech.name).join(", ") : "Unassigned",
    status: job.status,
    href: job.project ? `/projects/${job.project.id}` : "/dispatch",
  };
}

export default async function DashboardPage() {
  const token = await getSessionToken();
  const now = new Date();
  const staleProposalCutoffIso = getStaleProposalCutoffIso(now);

  const { projects, settingsResponse } = token
    ? await loadDashboardStartup(token, { listProjects, getOrganizationSettings })
    : { projects: [], settingsResponse: null };

  const [projectDetailsResult, scheduleWindow, invoiceQueues, staleProposalQueue, estimateProgressQueue] = token
    ? await Promise.all([
        loadDashboardProjectDetails(token, projects, DASHBOARD_PROJECT_DETAIL_LIMIT, getProject),
        loadTodayScheduleWindow(token),
        loadInvoiceAttentionQueues(token),
        loadStaleProposalAttentionQueue(token, staleProposalCutoffIso),
        loadEstimateProgressQueue(token),
      ])
    : [
        { items: [] as Awaited<ReturnType<typeof getProject>>[], failedCount: 0 },
        {
          today: { items: [] as DispatchJob[], total: 0, error: null as string | null },
          upcoming: { items: [] as DispatchJob[], total: 0, error: null as string | null },
          timezone: "UTC",
        },
        {
          overdue: emptyQueue<InvoiceQueueItem>(),
          unpaid: emptyQueue<InvoiceQueueItem>(),
          error: null as string | null,
          overdueUnavailable: false,
          openUnavailable: false,
        },
        { queue: emptyQueue<ProposalQueueItem>(), error: null as string | null },
        { queue: emptyQueue<EstimateQueueItem>(), error: null as string | null },
      ];

  const projectDetails = projectDetailsResult.items;
  const { companyName, timeZone } = resolveDashboardOrganizationContext(settingsResponse?.settings, scheduleWindow.timezone);
  const projectScopeLabel = getProjectScopeLabel(projectDetails.length, projectDetailsResult.failedCount);
  const currentDateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);

  const progressEstimates = buildAttentionEstimateRows(estimateProgressQueue.queue.items);
  const staleProposals = buildAttentionProposalRows(staleProposalQueue.queue.items, []);
  const invoiceRows = buildAttentionInvoiceRows(invoiceQueues.overdue.items, invoiceQueues.unpaid.items);

  const readyToStart: AttentionStartRow[] = projectDetails
    .filter((project) => (project.status === "lead" || project.status === "estimating") && project.estimates.length === 0)
    .map((project) => ({
      projectId: project.id,
      projectName: project.name,
      customerName: project.customer?.name ?? "No customer linked",
    }));

  const continueWorking = buildContinueWorkingRows(projectDetails);
  const receivablesBase = buildReceivablesSummary(invoiceRows, {
    overdueInvoiceTotal: invoiceQueues.overdueUnavailable ? invoiceRows.filter((row) => row.overdue).length : invoiceQueues.overdue.total,
    openInvoiceTotal: invoiceQueues.openUnavailable ? invoiceRows.length : invoiceQueues.unpaid.total,
  });
  const receivables = {
    ...receivablesBase,
    isPartial: invoiceQueues.openUnavailable || receivablesBase.isPartial,
  };

  const currentSchedule = scheduleWindow.today.items.map((job) => toScheduleItem(job, scheduleWindow.timezone));
  const upcomingSchedule = scheduleWindow.upcoming.items.map((job) => toScheduleItem(job, scheduleWindow.timezone));
  const attentionUnavailable = Boolean(staleProposalQueue.error) || invoiceQueues.overdueUnavailable;
  const notificationCount = attentionUnavailable ? null : staleProposalQueue.queue.total + invoiceQueues.overdue.total;

  return (
    <div className="flex flex-col gap-6">
      <OwnerDashboardHeader
        companyName={companyName}
        currentDateLabel={currentDateLabel}
        notificationCount={notificationCount}
        todaysJobsCount={scheduleWindow.today.total}
        projectScopeLabel={projectScopeLabel}
      />

      <TodayCommandBoard
        currentSchedule={currentSchedule}
        upcomingSchedule={upcomingSchedule}
        estimates={progressEstimates}
        proposals={staleProposals}
        invoices={invoiceRows}
        readyToStart={readyToStart}
        continueWorking={continueWorking}
        receivables={receivables}
        errors={{
          currentSchedule: scheduleWindow.today.error,
          upcomingSchedule: scheduleWindow.upcoming.error,
          estimates: estimateProgressQueue.error,
          proposals: staleProposalQueue.error,
          invoices: invoiceQueues.error,
          openInvoicesUnavailable: invoiceQueues.openUnavailable,
          overdueInvoicesUnavailable: invoiceQueues.overdueUnavailable,
        }}
      />
    </div>
  );
}
