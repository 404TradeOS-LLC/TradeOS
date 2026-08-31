import Link from "next/link";
import type { Metadata } from "next";
import {
  getDispatchSummary,
  getKnowledgeStats,
  getOrganizationSettings,
  getProject,
  listActivityEvents,
  listEstimateQueue,
  listInvoiceQueue,
  listJobsForDispatch,
  listOrganizationProjectTasks,
  listProjects,
  listProposalQueue,
  toInclusiveEndBoundary,
  type DispatchJob,
  type EstimateQueueItem,
  type InvoiceQueueItem,
  type JobSummary,
  type ProposalQueueItem,
} from "@/lib/api";
import { formatCurrency, formatScheduleInZone, getInvoiceDisplayStatus, getProposalDisplayStatus } from "@/lib/document-workflow";
import { getCurrentWeekPaymentLedger } from "@/lib/payment-ledger";
import { getSession, getSessionToken } from "@/lib/session";
import { loadDashboardWeather, selectDashboardWeatherAddress } from "@/lib/dashboard-weather";
import { getWeatherForAddress } from "@/lib/weather";
import type { OwnerScheduleItem } from "@/components/dashboard/owner-dashboard-data";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { isTerminalStatus, jobStatuses } from "@/domain";
import { NeedsAttentionCard, type AttentionStartRow } from "@/components/dashboard/needs-attention-card";
import { buildAttentionEstimateRows, buildAttentionInvoiceRows, buildAttentionProposalRows, getStaleProposalCutoffIso } from "@/components/dashboard/needs-attention-model";
import { AIAssistantPlaceholderPanel } from "@/components/dashboard/ai-assistant-placeholder-panel";
import { buildDashboardTaskSnapshot, buildTaskActivityEntries } from "@/components/dashboard/dashboard-task-model";
import { buildOwnerKpis, ownerQuickActions } from "@/components/dashboard/owner-dashboard-data";
import { OwnerActivityFeed } from "@/components/dashboard/owner-activity-feed";
import { OwnerDashboardHeader } from "@/components/dashboard/owner-dashboard-header";
import { OwnerKpiGrid } from "@/components/dashboard/owner-kpi-card";
import { OwnerQuickActions } from "@/components/dashboard/owner-quick-actions";
import { OwnerTaskBoard } from "@/components/dashboard/owner-task-board";
import { OwnerTodaySchedule } from "@/components/dashboard/owner-today-schedule";
import { loadDashboardProjectDetails, loadDashboardStartup, resolveDashboardOrganizationContext } from "./dashboard-startup";

export const metadata: Metadata = {
  title: "Owner Dashboard | TradeOS",
  description: "Morning command center for contractor owners to review jobs, estimates, invoices, schedule pressure, and activity.",
};

const DASHBOARD_PROJECT_DETAIL_LIMIT = 8;
const DASHBOARD_TODAY_JOB_LIMIT = 5;
const DASHBOARD_TASK_FEED_LIMIT = 24;
const ACTIONABLE_JOB_STATUSES: ReadonlySet<JobSummary["status"]> = new Set(jobStatuses.filter((status) => !isTerminalStatus(status)));

// Bounded page sizes for the organization-wide "Needs attention" work
// queues (PR #251) — enough to populate the dashboard without loading full
// organization history. `total` (the exact filtered count) is used for KPI
// tiles independent of how many rows were fetched.
const ATTENTION_OVERDUE_INVOICE_LIMIT = 10;
const ATTENTION_UNPAID_INVOICE_LIMIT = 15;
const ATTENTION_STALE_PROPOSAL_LIMIT = 10;
const ATTENTION_UNSIGNED_PROPOSAL_LIMIT = 15;
const ATTENTION_ESTIMATE_LIMIT = 15;

/**
 * Creates an empty paginated queue result.
 *
 * @returns An empty item list with a total of zero and no next-page cursor.
 */
function emptyQueue<T>(): { items: T[]; total: number; nextCursor: string | null } {
  return { items: [], total: 0, nextCursor: null };
}

/**
 * Loads the organization's scheduled jobs for the current day.
 *
 * @param token - Authentication token for the organization
 * @returns The day's scheduled jobs, total count, and timezone; empty results with UTC when loading fails
 */
async function loadTodaySchedule(token: string): Promise<{ items: DispatchJob[]; total: number; timezone: string }> {
  try {
    const summary = await getDispatchSummary(token);
    const result = await listJobsForDispatch(token, {
      scheduledFrom: summary.todayRangeUtc.start,
      scheduledTo: toInclusiveEndBoundary(summary.todayRangeUtc.end),
      pageSize: DASHBOARD_TODAY_JOB_LIMIT,
    });
    return { items: result.items, total: result.total, timezone: summary.timezone.value };
  } catch {
    return { items: [], total: 0, timezone: "UTC" };
  }
}

// Each of the three "Needs attention" work-queue resources is fetched (and
// can fail) independently, so one resource going down doesn't blank the
// other two sections — see AGENTS.md's "surface failure without crashing
/**
 * Loads overdue and unpaid invoice attention queues independently.
 *
 * Failed queue requests produce empty queues while preserving results from successful requests.
 *
 * @returns The overdue and unpaid invoice queues, a flag indicating whether the unpaid queue failed, and an error message when one or both requests fail.
 */
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
        ? "Invoice attention queues are temporarily unavailable"
        : overdueFailed
          ? "Overdue invoice queue is temporarily unavailable"
          : "Unpaid invoice queue is temporarily unavailable"
      : null;

  return { overdue, unpaid, unpaidFailed, error };
}

/**
 * Loads stale and unsigned proposal attention queues.
 *
 * @param staleBeforeIso - ISO timestamp used to identify stale proposals
 * @returns The stale queue, unsigned queue, and an error message when either queue cannot be loaded
 */
async function loadProposalAttentionQueues(token: string, staleBeforeIso: string) {
  const [staleResult, unsignedResult] = await Promise.allSettled([
    listProposalQueue(token, { unsigned: true, staleBefore: staleBeforeIso, limit: ATTENTION_STALE_PROPOSAL_LIMIT }),
    listProposalQueue(token, { unsigned: true, limit: ATTENTION_UNSIGNED_PROPOSAL_LIMIT }),
  ]);

  const stale = staleResult.status === "fulfilled" ? staleResult.value : emptyQueue<ProposalQueueItem>();
  const unsigned = unsignedResult.status === "fulfilled" ? unsignedResult.value : emptyQueue<ProposalQueueItem>();

  const error =
    staleResult.status === "rejected" || unsignedResult.status === "rejected"
      ? staleResult.status === "rejected" && unsignedResult.status === "rejected"
        ? "Proposal attention queues are temporarily unavailable"
        : staleResult.status === "rejected"
          ? "Stale proposal queue is temporarily unavailable"
          : "Unsigned proposal queue is temporarily unavailable"
      : null;

  return { stale, unsigned, error };
}

/**
 * Loads draft and ready estimates for the attention queue.
 *
 * @param token - The authentication token used to request estimate data
 * @returns The estimate queue and a request error message, if loading fails
 */
async function loadEstimateAttentionQueue(token: string) {
  try {
    const queue = await listEstimateQueue(token, { status: "draft,ready", limit: ATTENTION_ESTIMATE_LIMIT });
    return { queue, error: null as string | null };
  } catch (error) {
    return { queue: emptyQueue<EstimateQueueItem>(), error: error instanceof Error ? error.message : "Estimate queue request failed" };
  }
}

/**
 * Parses a date string into a valid `Date` object.
 *
 * @param value - The date string to parse
 * @returns The parsed date, or `null` when the value is missing or invalid
 */
function toValidDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function getZonedDayOrdinal(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function isSameDay(value: string | null | undefined, comparison: Date, timeZone: string) {
  const date = toValidDate(value);
  return date ? getZonedDayOrdinal(date, timeZone) === getZonedDayOrdinal(comparison, timeZone) : false;
}

function isPastDue(value: string | null | undefined, comparison: Date, timeZone: string) {
  const date = toValidDate(value);
  return date ? getZonedDayOrdinal(date, timeZone) < getZonedDayOrdinal(comparison, timeZone) : false;
}

function isActionableJob(job: Pick<JobSummary, "status" | "archivedAt">) {
  return !job.archivedAt && ACTIONABLE_JOB_STATUSES.has(job.status);
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

/**
 * Renders the authenticated owner's dashboard with project, schedule, task, payment, and attention-queue summaries.
 *
 * @returns The owner dashboard page content.
 */
export default async function DashboardPage() {
  const [session, token] = await Promise.all([getSession(), getSessionToken()]);
  const now = new Date();
  const staleProposalCutoffIso = getStaleProposalCutoffIso(now);
  const { projects, settingsResponse } = token
    ? await loadDashboardStartup(token, { listProjects, getOrganizationSettings })
    : { projects: [], settingsResponse: null };
  const [projectDetailsResult, knowledgeStats, todaySchedule, paymentLedger, invoiceAttentionQueues, proposalAttentionQueues, estimateAttentionQueue] = token
    ? await Promise.all([
        loadDashboardProjectDetails(token, projects, DASHBOARD_PROJECT_DETAIL_LIMIT, getProject),
        getKnowledgeStats(token).catch(() => null),
        loadTodaySchedule(token),
        getCurrentWeekPaymentLedger(token).catch(() => null),
        loadInvoiceAttentionQueues(token),
        loadProposalAttentionQueues(token, staleProposalCutoffIso),
        loadEstimateAttentionQueue(token),
      ])
    : [
        { items: [] as Awaited<ReturnType<typeof getProject>>[], failedCount: 0 },
        null,
        { items: [] as DispatchJob[], total: 0, timezone: "UTC" },
        null,
        { overdue: emptyQueue<InvoiceQueueItem>(), unpaid: emptyQueue<InvoiceQueueItem>(), unpaidFailed: false, error: null as string | null },
        { stale: emptyQueue<ProposalQueueItem>(), unsigned: emptyQueue<ProposalQueueItem>(), error: null as string | null },
        { queue: emptyQueue<EstimateQueueItem>(), error: null as string | null },
      ];
  const projectDetails = projectDetailsResult.items;

  const weatherAddress = selectDashboardWeatherAddress({
    jobSiteAddresses: todaySchedule.items.map((job) => job.project?.siteAddress),
    persistedOrganizationAddress: settingsResponse?.settings?.address,
  });
  const weather = await loadDashboardWeather(weatherAddress, getWeatherForAddress);

  const { companyName, timeZone } = resolveDashboardOrganizationContext(settingsResponse?.settings, todaySchedule.timezone);
  let dashboardTasksError: string | null = null;
  let taskActivityError: string | null = null;
  const dashboardTasks = token
    ? await listOrganizationProjectTasks(token, { limit: DASHBOARD_TASK_FEED_LIMIT, includeCompleted: true }).catch((error: unknown) => {
        dashboardTasksError = error instanceof Error ? error.message : "Task feed request failed";
        return [];
      })
    : [];
  const taskActivityEntries = token
    ? await listActivityEvents(token, { entityType: "task", limit: 8 })
        .then((events) => buildTaskActivityEntries(events))
        .catch((error: unknown) => {
          taskActivityError = error instanceof Error ? error.message : "Task activity request failed";
          return [];
        })
    : [];
  const dashboardTaskSnapshot = buildDashboardTaskSnapshot(dashboardTasks, now, timeZone);
  const projectScopeLabel = getProjectScopeLabel(projectDetails.length, projectDetailsResult.failedCount);
  const currentDateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);
  const allJobs = projectDetails.flatMap((project) => project.jobs);
  const actionableJobs = allJobs.filter(isActionableJob);
  const todayLiveJobs = actionableJobs.filter((job) => job.status !== "unscheduled" && isSameDay(job.scheduledStart, now, timeZone)).length;
  const unscheduledJobs = actionableJobs.filter((job) => job.status === "unscheduled" || !job.scheduledStart).length;
  const fallbackOverdueTasks = projectDetails
    .flatMap((project) => project.tasks)
    .filter((task) => !task.completedAt && task.status !== "completed" && isPastDue(task.dueDate, now, timeZone)).length;
  const overdueTasks = dashboardTasksError ? fallbackOverdueTasks : dashboardTaskSnapshot.overdueCount;
  // Org-wide exact totals from the work-queue APIs (PR #251), not the
  // DASHBOARD_PROJECT_DETAIL_LIMIT-bounded per-project fan-out those KPI
  // tiles used to derive their counts from. Falls back to the old
  // (incomplete, first-8-projects-only) count only if the queue request
  // itself failed, matching the overdueTasks fallback pattern above.
  const fallbackOpenEstimates = projectDetails.flatMap((project) => project.estimates).filter((estimate) => estimate.status === "draft" || estimate.status === "ready").length;
  const openEstimates = estimateAttentionQueue.error ? fallbackOpenEstimates : estimateAttentionQueue.queue.total;
  const fallbackInvoicesWaiting = projectDetails
    .flatMap((project) => project.invoices)
    .filter((invoice) => ["sent", "overdue", "partially_paid"].includes(getInvoiceDisplayStatus(invoice))).length;
  const invoicesWaiting = invoiceAttentionQueues.unpaidFailed ? fallbackInvoicesWaiting : invoiceAttentionQueues.unpaid.total;

  const attentionEstimates = buildAttentionEstimateRows(estimateAttentionQueue.queue.items);
  const attentionProposals = buildAttentionProposalRows(proposalAttentionQueues.stale.items, proposalAttentionQueues.unsigned.items);
  const attentionInvoices = buildAttentionInvoiceRows(invoiceAttentionQueues.overdue.items, invoiceAttentionQueues.unpaid.items);

  const attentionReadyToStart: AttentionStartRow[] = projectDetails
    .filter((project) => project.estimates.length === 0)
    .map((project) => ({
      projectId: project.id,
      projectName: project.name,
      customerName: project.customer?.name ?? "No customer linked",
    }));
  const notificationCount = attentionEstimates.length + attentionProposals.length + attentionInvoices.length + attentionReadyToStart.length;
  const ownerScheduleItems: OwnerScheduleItem[] = todaySchedule.items.map((job) => ({
    id: job.id,
    timeWindow: job.scheduledStart ? formatScheduleInZone(job.scheduledStart, todaySchedule.timezone) : "Unscheduled",
    title: job.title,
    customer: job.customer?.name ?? "No customer linked",
    address: job.project?.siteAddress ?? "No site address on file",
    crew: job.assignedTechnicians.length > 0 ? job.assignedTechnicians.map((tech) => tech.name).join(", ") : "Unassigned",
    status: job.status,
    href: job.project ? `/projects/${job.project.id}` : "/dispatch",
  }));
  const ownerKpis = buildOwnerKpis({
    todaysJobs: todayLiveJobs,
    openEstimates,
    revenueThisWeek: paymentLedger ? formatCurrency(paymentLedger.totalAmount) : "Unavailable",
    invoicesWaiting,
    unscheduledJobs,
    overdueTasks,
    scopeLabel: projectScopeLabel,
  });

  return (
    <div className="flex flex-col gap-6">
      <OwnerDashboardHeader
        companyName={companyName}
        currentDateLabel={currentDateLabel}
        notificationCount={notificationCount}
        weather={weather}
        projectScopeLabel={projectScopeLabel}
        reviewQueue={{
          estimates: attentionEstimates.length,
          proposals: attentionProposals.length,
          invoices: attentionInvoices.length,
          starts: attentionReadyToStart.length,
        }}
      />

      <NeedsAttentionCard
        estimates={attentionEstimates}
        proposals={attentionProposals}
        invoices={attentionInvoices}
        readyToStart={attentionReadyToStart}
        scopeLabel={projectScopeLabel}
        estimatesError={estimateAttentionQueue.error}
        proposalsError={proposalAttentionQueues.error}
        invoicesError={invoiceAttentionQueues.error}
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <OwnerTodaySchedule items={ownerScheduleItems} />
        <AIAssistantPlaceholderPanel />
      </div>

      <OwnerKpiGrid kpis={ownerKpis} />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <OwnerTaskBoard tasks={dashboardTasks} now={now} timeZone={timeZone} errorMessage={dashboardTasksError} />
        <OwnerActivityFeed
          entries={taskActivityError ? [] : taskActivityEntries}
          title="Recent task movement"
          description="Real task activity events from the live task workflow, so the dashboard shows actual movement instead of inferring it from the current row snapshot."
          emptyState={
            <EmptyState
              title={taskActivityError ? "Task activity is temporarily unavailable." : "No recent task movement yet."}
              description={
                taskActivityError
                  ? `${taskActivityError} Open the project workspace directly if you need task detail right away.`
                  : "Task updates will appear here as the team moves work from to-do through completion."
              }
            />
          }
        />
      </div>

      <OwnerQuickActions actions={ownerQuickActions} />

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Knowledge Runtime Coverage</CardTitle>
          <CardDescription>Live read-only estimating knowledge coverage. Open the diagnostic view for trade coverage and runtime health.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <p className="font-mono text-lg font-medium tabular-nums text-foreground">
            {knowledgeStats ? `${knowledgeStats.tradesCount} trades / ${knowledgeStats.assembliesCount} assemblies` : "Unavailable"}
          </p>
          <Link href="/dashboard/knowledge-coverage" className={buttonVariants({ variant: "outline", size: "sm" })}>
            View coverage
          </Link>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Recent project lifecycle</CardTitle>
          <CardDescription>
            Signed in as {session?.email}. Latest proposal, contract, invoice, and change-order state for the {projectScopeLabel}; this is a recent-project snapshot, not an organization-wide work queue.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {projectDetails.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects yet.</p>
          ) : (
            projectDetails.map((project) => {
              const latestProposal = project.proposals[0] ?? null;
              const latestContract = project.contracts[0] ?? null;
              const latestInvoice = project.invoices[0] ?? null;

              return (
                <div key={project.id} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-foreground">{project.name}</div>
                      <div className="text-sm text-muted-foreground">{project.customer?.name ?? "No customer linked"}</div>
                    </div>
                    <Link href={`/projects/${project.id}`} className={buttonVariants({ variant: "outline" })}>
                      Open project
                    </Link>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border border-border/60 bg-background/80 p-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Proposal</div>
                      <div className="mt-2">{latestProposal ? <StatusBadge status={getProposalDisplayStatus(latestProposal)} /> : "No proposal"}</div>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background/80 p-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Contract</div>
                      <div className="mt-2">{latestContract ? <StatusBadge status={latestContract.status} /> : "No contract"}</div>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background/80 p-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Invoice</div>
                      <div className="mt-2">{latestInvoice ? <StatusBadge status={getInvoiceDisplayStatus(latestInvoice)} /> : "No invoice"}</div>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background/80 p-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Change orders</div>
                      <div className="mt-2">{project.changeOrders.length > 0 ? <StatusBadge status={project.changeOrders[0].status} /> : "No change order"}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
