import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  MapPin,
  ReceiptText,
  Sparkles,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDate } from "@/lib/document-workflow";
import type { AttentionEstimateRow, AttentionInvoiceRow, AttentionProposalRow } from "@/components/dashboard/needs-attention-model";
import type { AttentionStartRow } from "@/components/dashboard/needs-attention-card";
import type { ContinueWorkingRow } from "@/components/dashboard/continue-working-model";
import type { OwnerKpi, OwnerScheduleItem } from "@/components/dashboard/owner-dashboard-data";
import type { ReceivablesSummary } from "@/components/dashboard/receivables-model";

interface TodayCommandBoardProps {
  schedule: OwnerScheduleItem[];
  estimates: AttentionEstimateRow[];
  proposals: AttentionProposalRow[];
  invoices: AttentionInvoiceRow[];
  readyToStart: AttentionStartRow[];
  continueWorking: ContinueWorkingRow[];
  kpis: OwnerKpi[];
  receivables: ReceivablesSummary;
  errors: {
    estimates: string | null;
    proposals: string | null;
    invoices: string | null;
  };
}

function BoardSection({
  id,
  label,
  count,
  children,
}: {
  id?: string;
  label: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-t border-border/70 first:border-t-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</h2>
        {count != null ? <span className="font-mono text-xs tabular-nums text-muted-foreground">{count}</span> : null}
      </div>
      <div className="divide-y divide-border/60">{children}</div>
    </section>
  );
}

function CommandRow({
  icon,
  title,
  metadata,
  status,
  action,
  href,
  tone = "default",
}: {
  icon: React.ReactNode;
  title: string;
  metadata?: string;
  status?: React.ReactNode;
  action: string;
  href: string;
  tone?: "default" | "attention" | "money";
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6"
    >
      <span
        className={[
          "flex size-9 shrink-0 items-center justify-center rounded-lg border",
          tone === "attention"
            ? "border-warning/30 bg-warning/10 text-warning"
            : tone === "money"
              ? "border-success/30 bg-success/10 text-success"
              : "border-border/70 bg-muted/35 text-muted-foreground",
        ].join(" ")}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium text-foreground">{title}</span>
          {status}
        </span>
        {metadata ? <span className="mt-0.5 block truncate text-sm text-muted-foreground">{metadata}</span> : null}
      </span>
      <span className="hidden shrink-0 text-sm text-muted-foreground sm:block">{action}</span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-5 text-sm text-muted-foreground sm:px-6">{children}</div>;
}

function ErrorRow({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-4 text-sm text-destructive sm:px-6">
      <AlertCircle className="size-4 shrink-0" />
      <span>{message}. Try refreshing or open the underlying workspace.</span>
    </div>
  );
}

export function TodayCommandBoard({
  schedule,
  estimates,
  proposals,
  invoices,
  readyToStart,
  continueWorking,
  kpis,
  receivables,
  errors,
}: TodayCommandBoardProps) {
  const nowCount = schedule.length;
  const needsYouCount = estimates.length + proposals.length + invoices.length + readyToStart.length;
  const comingUpCount = continueWorking.length;
  const revenue = kpis.find((kpi) => kpi.id === "revenue-this-week");
  const unscheduled = kpis.find((kpi) => kpi.id === "unscheduled-jobs");

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-(--elev-1)">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/70 bg-muted/20 px-4 py-4 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-copper">Today</p>
          <p className="mt-1 text-sm text-muted-foreground">One queue for the next action, customer pressure, and cash movement.</p>
        </div>
        <Link href="/dispatch" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Open dispatch
          <ArrowUpRight className="size-4" />
        </Link>
      </div>

      <BoardSection label="Now" count={nowCount}>
        {schedule.length === 0 ? (
          <EmptyRow>No jobs are scheduled today. Open dispatch to place the next job on the calendar.</EmptyRow>
        ) : (
          schedule.map((item) => (
            <CommandRow
              key={item.id}
              icon={<CalendarClock className="size-4" />}
              title={item.title}
              metadata={`${item.timeWindow} · ${item.customer} · ${item.address}`}
              status={<StatusBadge status={item.status} />}
              action="Open job"
              href={item.href}
            />
          ))
        )}
      </BoardSection>

      <BoardSection label="Needs you" count={needsYouCount}>
        {errors.estimates ? <ErrorRow message={errors.estimates} /> : null}
        {estimates.map((row) => (
          <CommandRow
            key={`estimate-${row.estimateId}`}
            icon={<ClipboardCheck className="size-4" />}
            title={`${row.projectName} · estimate v${row.version}`}
            metadata={`${row.customerName} · ${formatCurrency(row.totalPrice)}`}
            status={<StatusBadge status={row.status} />}
            action="Continue"
            href={`/projects/${row.projectId}/estimates/${row.estimateId}`}
            tone="attention"
          />
        ))}
        {errors.proposals ? <ErrorRow message={errors.proposals} /> : null}
        {proposals.map((row) => (
          <CommandRow
            key={`proposal-${row.proposalId}`}
            icon={<Sparkles className="size-4" />}
            title={`${row.projectName} · proposal`}
            metadata={[row.customerName, row.amount != null ? formatCurrency(row.amount) : null, row.stale && row.sentAt ? `stale since ${formatDate(row.sentAt)}` : null].filter(Boolean).join(" · ")}
            status={row.stale ? <StatusBadge status="needs_attention" /> : <StatusBadge status={row.status} />}
            action="Review"
            href={`/projects/${row.projectId}/proposals/${row.proposalId}`}
            tone="attention"
          />
        ))}
        {errors.invoices ? <ErrorRow message={errors.invoices} /> : null}
        {invoices.map((row) => (
          <CommandRow
            key={`invoice-${row.invoiceId}`}
            icon={<ReceiptText className="size-4" />}
            title={`${row.projectName} · invoice #${row.documentNumber}`}
            metadata={`${row.customerName} · ${formatCurrency(row.balanceDue)} owed${row.dueDate ? ` · due ${formatDate(row.dueDate)}` : ""}`}
            status={<StatusBadge status={row.overdue ? "overdue" : row.paidAmount > 0 ? "partially_paid" : row.status} />}
            action="Review"
            href={`/projects/${row.projectId}/invoices/${row.invoiceId}`}
            tone="attention"
          />
        ))}
        {readyToStart.map((row) => (
          <CommandRow
            key={`start-${row.projectId}`}
            icon={<Sparkles className="size-4" />}
            title={`${row.projectName} · start estimate`}
            metadata={row.customerName}
            action="Open project"
            href={`/projects/${row.projectId}`}
            tone="attention"
          />
        ))}
        {needsYouCount === 0 && !errors.estimates && !errors.proposals && !errors.invoices ? (
          <EmptyRow>Nothing is waiting on you. New estimate, proposal, invoice, and project pressure will appear here.</EmptyRow>
        ) : null}
      </BoardSection>

      <BoardSection label="Coming up" count={comingUpCount}>
        {continueWorking.length === 0 ? (
          <EmptyRow>No unfinished handoffs are waiting in the loaded project set.</EmptyRow>
        ) : (
          continueWorking.map((row) => (
            <CommandRow
              key={`continue-${row.projectId}`}
              icon={<Clock3 className="size-4" />}
              title={row.projectName}
              metadata={`${row.customerName} · ${row.helper}`}
              action={row.label}
              href={row.href}
            />
          ))
        )}
        {unscheduled ? (
          <CommandRow
            icon={<MapPin className="size-4" />}
            title={`${unscheduled.value} unscheduled job${unscheduled.value === "1" ? "" : "s"}`}
            metadata={unscheduled.helper}
            action="Open dispatch"
            href={unscheduled.href ?? "/dispatch?status=unscheduled&view=all"}
            tone={unscheduled.tone === "attention" ? "attention" : "default"}
          />
        ) : null}
      </BoardSection>

      <BoardSection id="invoices-waiting" label="Money">
        <CommandRow
          icon={<CircleDollarSign className="size-4" />}
          title={`${receivables.openInvoiceTotal} open invoice${receivables.openInvoiceTotal === 1 ? "" : "s"}`}
          metadata={`${formatCurrency(receivables.loadedOutstanding)} currently visible${receivables.isPartial ? " · partial loaded view" : ""}`}
          action="Review receivables"
          href="/dashboard#invoices-waiting"
          tone={receivables.openInvoiceTotal > 0 ? "money" : "default"}
        />
        <CommandRow
          icon={<ReceiptText className="size-4" />}
          title={`${receivables.overdueInvoiceTotal} overdue invoice${receivables.overdueInvoiceTotal === 1 ? "" : "s"}`}
          metadata={`${formatCurrency(receivables.loadedOverdueOutstanding)} currently visible`}
          action="Follow up"
          href="/dashboard#invoices-waiting"
          tone={receivables.overdueInvoiceTotal > 0 ? "attention" : "default"}
        />
        {revenue ? (
          <CommandRow
            icon={<CircleDollarSign className="size-4" />}
            title={`${revenue.value} received this week`}
            metadata={revenue.helper}
            action="View revenue"
            href={revenue.href ?? "/dashboard/revenue-this-week"}
            tone="money"
          />
        ) : null}
      </BoardSection>
    </div>
  );
}
