import Link from "next/link";
import type { Metadata } from "next";
import {
  getDispatchSummary,
  getKnowledgeStats,
  getOrganizationSettings,
  getProject,
  listJobsForDispatch,
  listProjects,
  toInclusiveEndBoundary,
  type DispatchJob,
  type JobSummary,
} from "@/lib/api";
import { formatCurrency, formatScheduleInZone, getInvoiceDisplayStatus, getProposalDisplayStatus } from "@/lib/document-workflow";
import { getSession, getSessionToken } from "@/lib/session";
import { getWeatherForAddress } from "@/lib/weather";
import type { OwnerScheduleItem } from "@/components/dashboard/owner-dashboard-data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { isTerminalStatus, jobStatuses } from "@/domain";
import {
  NeedsAttentionCard,
  type AttentionEstimateRow,
  type AttentionInvoiceRow,
  type AttentionProposalRow,
  type AttentionStartRow,
} from "@/components/dashboard/needs-attention-card";
import { AIAssistantPlaceholderPanel } from "@/components/dashboard/ai-assistant-placeholder-panel";
import { buildOwnerKpis, ownerQuickActions } from "@/components/dashboard/owner-dashboard-data";
import { OwnerActivityFeed } from "@/components/dashboard/owner-activity-feed";
import { OwnerDashboardHeader } from "@/components/dashboard/owner-dashboard-header";
import { OwnerKpiGrid } from "@/components/dashboard/owner-kpi-card";
import { OwnerQuickActions } from "@/components/dashboard/owner-quick-actions";
import { OwnerTodaySchedule } from "@/components/dashboard/owner-today-schedule";
import { mergeTradeOsSettingsDraft } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Owner Dashboard | TradeOS",
  description: "Morning command center for contractor owners to review jobs, estimates, invoices, schedule pressure, and activity.",
};

const DASHBOARD_PROJECT_DETAIL_LIMIT = 8;
const DASHBOARD_TODAY_JOB_LIMIT = 5;
const ACTIONABLE_JOB_STATUSES: ReadonlySet<JobSummary["status"]> = new Set(jobStatuses.filter((status) => !isTerminalStatus(status)));

// Reuses the same dispatch endpoints the /dispatch workspace itself calls
// (dispatch-summary for the org-timezone-aware "today" boundary, then the
// jobs list scoped to it) so the dashboard's "Today" section is never a
// second, divergent source of truth for what "today" means. Failure here
// degrades to an empty schedule rather than crashing the dashboard, matching
// the existing resilience pattern used for the knowledge-stats panel below.
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

// Proposal money fields come off the wire as Prisma Decimal-serialized
// strings on this endpoint (unlike estimates/invoices, which are normalized
// server-side) - coerce before arithmetic so `sum + amount` doesn't silently
// string-concatenate.
function toProposalAmount(proposal: { finalPrice: number | null; priceHigh: number | null; priceLow: number | null }): number | null {
  const raw = proposal.finalPrice ?? proposal.priceHigh ?? proposal.priceLow;
  if (raw == null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

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

function getSafeTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "UTC";
  }
}

function isSameDay(value: string | null | undefined, comparison: Date, timeZone: string) {
  const date = toValidDate(value);
  return date ? getZonedDayOrdinal(date, timeZone) === getZonedDayOrdinal(comparison, timeZone) : false;
}

function isSameWeek(value: string | null | undefined, comparison: Date, timeZone: string) {
  const date = toValidDate(value);
  if (!date) return false;
  const comparisonDay = getZonedDayOrdinal(comparison, timeZone);
  const weekStart = comparisonDay - new Date(comparisonDay * 86_400_000).getUTCDay();
  const targetDay = getZonedDayOrdinal(date, timeZone);

  return targetDay >= weekStart && targetDay < weekStart + 7;
}

function isPastDue(value: string | null | undefined, comparison: Date, timeZone: string) {
  const date = toValidDate(value);
  return date ? getZonedDayOrdinal(date, timeZone) < getZonedDayOrdinal(comparison, timeZone) : false;
}

function isActionableJob(job: Pick<JobSummary, "status" | "archivedAt">) {
  return !job.archivedAt && ACTIONABLE_JOB_STATUSES.has(job.status);
}

function getProjectScopeLabel(projectCount: number) {
  if (projectCount === 0) return "loaded project set";
  if (projectCount === 1) return "1 loaded project";
  if (projectCount < DASHBOARD_PROJECT_DETAIL_LIMIT) return `${projectCount} loaded projects`;
  return `recent ${DASHBOARD_PROJECT_DETAIL_LIMIT} loaded projects`;
}

export default async function DashboardPage() {
  const [session, token] = await Promise.all([getSession(), getSessionToken()]);
  const [projects, settingsResponse] = token ? await Promise.all([listProjects(token), getOrganizationSettings(token)]) : [[], null];
  const [projectDetails, knowledgeStats, todaySchedule] = token
    ? await Promise.all([
        Promise.all(projects.slice(0, DASHBOARD_PROJECT_DETAIL_LIMIT).map((project) => getProject(token, project.id))),
        // Knowledge Engine stats are a supplementary panel, not a core
        // dashboard dependency (the UI already renders "Unavailable" for
        // null below) — a failure here must never crash the entire
        // dashboard render into the generic error boundary.
        getKnowledgeStats(token).catch(() => null),
        loadTodaySchedule(token),
      ])
    : [[], null, { items: [] as DispatchJob[], total: 0, timezone: "UTC" }];

  // Weather is scoped to today's first scheduled job's site address (not a
  // generic company-wide forecast) - a rain delay only matters relative to
  // where the crew is actually working today. No job today or no site
  // address on file both degrade to an honest "no forecast" state rather
  // than showing nothing tied to a real location.
  const todaySiteAddress = todaySchedule.items.find((job) => job.project?.siteAddress)?.project?.siteAddress ?? null;
  const weather = todaySiteAddress ? await getWeatherForAddress(todaySiteAddress).catch(() => null) : null;

  const now = new Date();
  const settings = mergeTradeOsSettingsDraft(settingsResponse?.settings);
  const companyName = settings.companyName;
  const timeZone = getSafeTimeZone(settings.timezone);
  const projectScopeLabel = getProjectScopeLabel(projectDetails.length);
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
  const overdueTasks = projectDetails
    .flatMap((project) => project.tasks)
    .filter((task) => !task.completedAt && task.status !== "completed" && isPastDue(task.dueDate, now, timeZone)).length;
  const openEstimates = projectDetails.flatMap((project) => project.estimates).filter((estimate) => estimate.status === "draft" || estimate.status === "ready").length;
  const invoicesWaiting = projectDetails
    .flatMap((project) => project.invoices)
    .filter((invoice) => ["sent", "overdue", "partially_paid"].includes(getInvoiceDisplayStatus(invoice))).length;
  const revenueThisWeek = projectDetails
    .flatMap((project) => project.invoices)
    .filter((invoice) => invoice.status === "paid" && isSameWeek(invoice.paidAt, now, timeZone))
    .reduce((sum, invoice) => sum + invoice.amount, 0);

  const attentionEstimates: AttentionEstimateRow[] = projectDetails.flatMap((project) =>
    project.estimates
      .filter((estimate) => estimate.status === "draft" || estimate.status === "ready")
      .map((estimate) => ({
        projectId: project.id,
        projectName: project.name,
        customerName: project.customer?.name ?? "No customer linked",
        estimateId: estimate.id,
        version: estimate.version,
        status: estimate.status,
        totalPrice: estimate.totalPrice,
      }))
  );

  const attentionProposals: AttentionProposalRow[] = projectDetails.flatMap((project) =>
    project.proposals
      .filter((proposal) => ["sent", "viewed"].includes(getProposalDisplayStatus(proposal)))
      .map((proposal) => ({
        projectId: project.id,
        projectName: project.name,
        customerName: project.customer?.name ?? "No customer linked",
        proposalId: proposal.id,
        status: getProposalDisplayStatus(proposal),
        amount: toProposalAmount(proposal),
      }))
  );

  const attentionInvoices: AttentionInvoiceRow[] = projectDetails.flatMap((project) =>
    project.invoices
      .filter((invoice) => ["sent", "overdue", "partially_paid"].includes(getInvoiceDisplayStatus(invoice)))
      .map((invoice) => ({
        projectId: project.id,
        projectName: project.name,
        customerName: project.customer?.name ?? "No customer linked",
        invoiceId: invoice.id,
        status: getInvoiceDisplayStatus(invoice),
        amount: invoice.amount,
        dueDate: invoice.dueDate,
      }))
  );

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
    revenueThisWeek: formatCurrency(revenueThisWeek),
    invoicesWaiting,
    unscheduledJobs,
    overdueTasks,
    scopeLabel: projectScopeLabel,
  });

  return (
    <div className="flex flex-col gap-6">
      <OwnerDashboardHeader companyName={companyName} currentDateLabel={currentDateLabel} notificationCount={notificationCount} weather={weather} />

      <NeedsAttentionCard
        estimates={attentionEstimates}
        proposals={attentionProposals}
        invoices={attentionInvoices}
        readyToStart={attentionReadyToStart}
        scopeLabel={projectScopeLabel}
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <OwnerTodaySchedule items={ownerScheduleItems} />
        <AIAssistantPlaceholderPanel />
      </div>

      <OwnerKpiGrid kpis={ownerKpis} />

      <OwnerQuickActions actions={ownerQuickActions} />

      <OwnerActivityFeed
        entries={[]}
        emptyState={
          <EmptyState
            title="No live owner activity source is connected yet."
            description="This dashboard foundation does not fabricate customer, job, invoice, or review activity. Live activity can appear here once an authoritative activity feed is wired."
          />
        }
      />

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Knowledge Runtime Coverage</CardTitle>
          <CardDescription>Read-only estimating knowledge remains visible without adding AI execution to the owner dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="font-mono text-lg font-medium tabular-nums text-foreground">
            {knowledgeStats ? `${knowledgeStats.tradesCount} trades / ${knowledgeStats.assembliesCount} assemblies` : "Unavailable"}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Operational queues</CardTitle>
          <CardDescription>
            Signed in as {session?.email}. Project workspace status remains connected to the live project, proposal, contract, invoice, and
            change-order data already loaded by the dashboard.
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
