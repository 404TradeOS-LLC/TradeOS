import Link from "next/link";
import type { Metadata } from "next";
import { getKnowledgeStats, getOrganizationSettings, getProject, listProjects } from "@/lib/api";
import { formatCurrency, getInvoiceDisplayStatus, getProposalDisplayStatus } from "@/lib/document-workflow";
import { getSession, getSessionToken } from "@/lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  NeedsAttentionCard,
  type AttentionEstimateRow,
  type AttentionInvoiceRow,
  type AttentionProposalRow,
  type AttentionStartRow,
} from "@/components/dashboard/needs-attention-card";
import { AIAssistantPlaceholderPanel } from "@/components/dashboard/ai-assistant-placeholder-panel";
import {
  buildOwnerKpis,
  mockOwnerActivityEntries,
  mockTodayScheduleItems,
  ownerQuickActions,
} from "@/components/dashboard/owner-dashboard-data";
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

function isSameDay(value: string | null | undefined, comparison: Date) {
  if (!value) return false;
  const date = new Date(value);
  return (
    Number.isFinite(date.getTime()) &&
    date.getFullYear() === comparison.getFullYear() &&
    date.getMonth() === comparison.getMonth() &&
    date.getDate() === comparison.getDate()
  );
}

function isSameWeek(value: string | null | undefined, comparison: Date) {
  if (!value) return false;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return false;

  const start = new Date(comparison);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return date >= start && date < end;
}

function isPastDue(value: string | null | undefined, comparison: Date) {
  if (!value) return false;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return false;
  date.setHours(23, 59, 59, 999);
  return date < comparison;
}

export default async function DashboardPage() {
  const [session, token] = await Promise.all([getSession(), getSessionToken()]);
  const [projects, settingsResponse] = token ? await Promise.all([listProjects(token), getOrganizationSettings(token)]) : [[], null];
  const [projectDetails, knowledgeStats] = token
    ? await Promise.all([
        Promise.all(projects.slice(0, 8).map((project) => getProject(token, project.id))),
        getKnowledgeStats(token),
      ])
    : [[], null];

  const now = new Date();
  const companyName = mergeTradeOsSettingsDraft(settingsResponse?.settings).companyName;
  const currentDateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);
  const allJobs = projectDetails.flatMap((project) => project.jobs);
  const todayLiveJobs = allJobs.filter((job) => isSameDay(job.scheduledStart, now)).length;
  const unscheduledJobs = allJobs.filter((job) => job.status === "unscheduled" || !job.scheduledStart).length;
  const overdueTasks = projectDetails
    .flatMap((project) => project.tasks)
    .filter((task) => !task.completedAt && task.status !== "completed" && isPastDue(task.dueDate, now)).length;
  const openEstimates = projectDetails.flatMap((project) => project.estimates).filter((estimate) => estimate.status === "draft" || estimate.status === "ready").length;
  const invoicesWaiting = projectDetails
    .flatMap((project) => project.invoices)
    .filter((invoice) => ["sent", "overdue", "partially_paid"].includes(getInvoiceDisplayStatus(invoice))).length;
  const revenueThisWeek = projectDetails
    .flatMap((project) => project.invoices)
    .filter((invoice) => invoice.status === "paid" && isSameWeek(invoice.paidAt, now))
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
  const ownerKpis = buildOwnerKpis({
    todaysJobs: Math.max(todayLiveJobs, mockTodayScheduleItems.length),
    openEstimates,
    revenueThisWeek: formatCurrency(revenueThisWeek),
    invoicesWaiting,
    unscheduledJobs,
    overdueTasks,
  });

  return (
    <div className="flex flex-col gap-6">
      <OwnerDashboardHeader companyName={companyName} currentDateLabel={currentDateLabel} notificationCount={notificationCount} />

      <OwnerKpiGrid kpis={ownerKpis} />

      <NeedsAttentionCard
        estimates={attentionEstimates}
        proposals={attentionProposals}
        invoices={attentionInvoices}
        readyToStart={attentionReadyToStart}
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <OwnerTodaySchedule items={mockTodayScheduleItems} />
        <AIAssistantPlaceholderPanel />
      </div>

      <OwnerActivityFeed entries={mockOwnerActivityEntries} />

      <OwnerQuickActions actions={ownerQuickActions} />

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
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
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
