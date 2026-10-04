import Link from "next/link";
import {
  AlertCircle,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  ReceiptText,
  Sparkles,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDate, formatScheduleInZone } from "@/lib/document-workflow";
import type { OrganizationProjectTask, ScheduleConflict } from "@/lib/api";
import type {
  AttentionEstimateRow,
  AttentionInvoiceRow,
  AttentionProposalRow,
} from "@/components/dashboard/needs-attention-model";
import type { AttentionStartRow } from "@/components/dashboard/needs-attention-card";
import type { ContinueWorkingRow } from "@/components/dashboard/continue-working-model";
import type { OwnerScheduleItem } from "@/components/dashboard/owner-dashboard-data";
import type { ReceivablesSummary } from "@/components/dashboard/receivables-model";

interface TodayCommandBoardProps {
  currentSchedule: OwnerScheduleItem[];
  upcomingSchedule: OwnerScheduleItem[];
  estimates: AttentionEstimateRow[];
  proposals: AttentionProposalRow[];
  invoices: AttentionInvoiceRow[];
  blockedTasks: OrganizationProjectTask[];
  scheduleConflicts: ScheduleConflict[];
  scheduleTimezone: string;
  readyToStart: AttentionStartRow[];
  continueWorking: ContinueWorkingRow[];
  receivables: ReceivablesSummary;
  needsYouUnavailable: boolean;
  errors: {
    currentSchedule: string | null;
    upcomingSchedule: string | null;
    estimates: string | null;
    proposals: string | null;
    invoices: string | null;
    blockedTasks: string | null;
    scheduleConflicts: string | null;
    openInvoicesUnavailable: boolean;
    overdueInvoicesUnavailable: boolean;
  };
}

function BoardSection({
  id,
  label,
  helper,
  count,
  children,
}: {
  id?: string;
  label: string;
  helper: string;
  count?: number | null;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-t border-border/70 first:border-t-0">
      <div className="flex items-end justify-between gap-3 px-4 py-3 sm:px-6">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{helper}</p>
        </div>
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
  tone?: "default" | "attention";
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
      <span>{message}. Open the underlying workspace if you need to act right now.</span>
    </div>
  );
}

function MoneySummary({
  receivables,
  firstOverdue,
  openInvoicesUnavailable,
  overdueInvoicesUnavailable,
}: {
  receivables: ReceivablesSummary;
  firstOverdue?: AttentionInvoiceRow;
  openInvoicesUnavailable: boolean;
  overdueInvoicesUnavailable: boolean;
}) {
  return (
    <div className="px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">
            {formatCurrency(receivables.loadedOutstanding)}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Outstanding across {receivables.loadedInvoiceCount} loaded invoice{receivables.loadedInvoiceCount === 1 ? "" : "s"}
            {receivables.isPartial ? " · partial loaded view" : ""}
          </p>
        </div>
        {firstOverdue ? (
          <Link
            href={`/projects/${firstOverdue.projectId}/invoices/${firstOverdue.invoiceId}`}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-sm font-medium text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Open overdue invoice
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border/70 bg-background/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Open</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
            {openInvoicesUnavailable ? "Unavailable" : receivables.openInvoiceTotal}
          </p>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Overdue</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
            {overdueInvoicesUnavailable ? "Unavailable" : receivables.overdueInvoiceTotal}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {overdueInvoicesUnavailable ? "Overdue queue unavailable" : `${formatCurrency(receivables.loadedOverdueOutstanding)} visible overdue balance`}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Money keeps the receivables picture. When an invoice requires action, that action appears in Needs you.
      </p>
    </div>
  );
}

export function TodayCommandBoard({
  currentSchedule,
  upcomingSchedule,
  estimates,
  proposals,
  invoices,
  blockedTasks,
  scheduleConflicts,
  scheduleTimezone,
  readyToStart,
  continueWorking,
  receivables,
  needsYouUnavailable,
  errors,
}: TodayCommandBoardProps) {
  const staleProposals = proposals.filter((row) => row.stale);
  const overdueInvoices = invoices.filter((row) => row.overdue);
  const nowCount = currentSchedule.length + estimates.length + readyToStart.length + continueWorking.length;
  const needsYouCount = needsYouUnavailable
    ? null
    : staleProposals.length +
      overdueInvoices.length +
      blockedTasks.length +
      scheduleConflicts.length;
  const comingUpCount = upcomingSchedule.length;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-(--elev-1)">
      <div className="border-b border-border/70 bg-muted/20 px-4 py-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-copper">Today</p>
        <p className="mt-1 text-sm text-muted-foreground">What needs action now, what is already moving, and what is coming next.</p>
      </div>

      <BoardSection label="Now" helper="Current work and normal progression" count={nowCount}>
        {errors.currentSchedule ? <ErrorRow message={errors.currentSchedule} /> : null}
        {currentSchedule.map((item) => (
          <CommandRow
            key={`schedule-${item.id}`}
            icon={<CalendarClock className="size-4" />}
            title={item.title}
            metadata={`${item.timeWindow} · ${item.customer} · ${item.crew}`}
            status={<StatusBadge status={item.status} />}
            action="Open job"
            href={item.href}
          />
        ))}

        {errors.estimates ? <ErrorRow message={errors.estimates} /> : null}
        {estimates.map((row) => (
          <CommandRow
            key={`estimate-${row.estimateId}`}
            icon={<ClipboardCheck className="size-4" />}
            title={`${row.projectName} · estimate v${row.version}`}
            metadata={`${row.customerName} · ${formatCurrency(row.totalPrice)}`}
            status={<StatusBadge status={row.status} />}
            action="Continue estimate"
            href={`/projects/${row.projectId}/estimates/${row.estimateId}`}
          />
        ))}

        {continueWorking.map((row) => (
          <CommandRow
            key={`continue-${row.projectId}`}
            icon={<Clock3 className="size-4" />}
            title={row.projectName}
            metadata={`${row.customerName} · ${row.helper}`}
            action={row.label}
            href={row.href}
          />
        ))}

        {readyToStart.map((row) => (
          <CommandRow
            key={`start-${row.projectId}`}
            icon={<Sparkles className="size-4" />}
            title={`${row.projectName} · ready to estimate`}
            metadata={row.customerName}
            action="Open project"
            href={`/projects/${row.projectId}`}
          />
        ))}

        {nowCount === 0 && !errors.currentSchedule && !errors.estimates ? (
          <EmptyRow>No work is currently moving. New field work and normal next steps will appear here.</EmptyRow>
        ) : null}
      </BoardSection>

      <BoardSection label="Needs you" helper="Only unresolved human action" count={needsYouCount}>
        {errors.proposals ? <ErrorRow message={errors.proposals} /> : null}
        {staleProposals.map((row) => (
          <CommandRow
            key={`proposal-${row.proposalId}`}
            icon={<Sparkles className="size-4" />}
            title={`${row.projectName} · proposal needs follow-up`}
            metadata={[row.customerName, row.amount != null ? formatCurrency(row.amount) : null, row.sentAt ? `stale since ${formatDate(row.sentAt)}` : null]
              .filter(Boolean)
              .join(" · ")}
            status={<StatusBadge status="needs_attention" />}
            action="Review proposal"
            href={`/projects/${row.projectId}/proposals/${row.proposalId}`}
            tone="attention"
          />
        ))}

        {errors.invoices ? <ErrorRow message={errors.invoices} /> : null}
        {overdueInvoices.map((row) => (
          <CommandRow
            key={`invoice-${row.invoiceId}`}
            icon={<ReceiptText className="size-4" />}
            title={`${row.projectName} · invoice #${row.documentNumber} overdue`}
            metadata={`${row.customerName} · ${formatCurrency(row.balanceDue)} owed${row.dueDate ? ` · due ${formatDate(row.dueDate)}` : ""}`}
            status={<StatusBadge status="overdue" />}
            action="Review invoice"
            href={`/projects/${row.projectId}/invoices/${row.invoiceId}`}
            tone="attention"
          />
        ))}

        {errors.scheduleConflicts ? <ErrorRow message={errors.scheduleConflicts} /> : null}
        {scheduleConflicts.map((conflict) => (
          <CommandRow
            key={`conflict-${conflict.technicianId}-${conflict.conflictingJobId}-${conflict.conflictingScheduledStart}`}
            icon={<CalendarClock className="size-4" />}
            title={`Schedule conflict · ${conflict.conflictingJobNumber}`}
            metadata={[
              conflict.technicianName ?? "Assigned technician",
              formatScheduleInZone(conflict.conflictingScheduledStart, scheduleTimezone),
              conflict.conflictingJobTitle,
            ]
              .filter(Boolean)
              .join(" · ")}
            status={<StatusBadge status="needs_attention" />}
            action="Resolve conflict"
            href="/dispatch?mode=week"
            tone="attention"
          />
        ))}

        {errors.blockedTasks ? <ErrorRow message={errors.blockedTasks} /> : null}
        {blockedTasks.map((task) => (
          <CommandRow
            key={`blocked-task-${task.id}`}
            icon={<AlertCircle className="size-4" />}
            title={`${task.projectName} · ${task.title}`}
            metadata={[task.customerName, task.jobTitle, "blocked project task"].filter(Boolean).join(" · ")}
            status={<StatusBadge status="blocked" />}
            action="Resolve blocker"
            href={`/projects/${task.projectId}?tab=tasks`}
            tone="attention"
          />
        ))}

        {needsYouCount === 0 &&
        !errors.proposals &&
        !errors.invoices &&
        !errors.blockedTasks &&
        !errors.scheduleConflicts ? (
          <EmptyRow>Nothing is waiting on you right now.</EmptyRow>
        ) : null}
      </BoardSection>

      <BoardSection label="Coming up" helper="Scheduled work and near-term commitments" count={comingUpCount}>
        {errors.upcomingSchedule ? <ErrorRow message={errors.upcomingSchedule} /> : null}
        {upcomingSchedule.map((item) => (
          <CommandRow
            key={`upcoming-${item.id}`}
            icon={<CalendarClock className="size-4" />}
            title={item.title}
            metadata={`${item.timeWindow} · ${item.customer} · ${item.crew}`}
            status={<StatusBadge status={item.status} />}
            action="Open schedule"
            href="/dispatch"
          />
        ))}
        {comingUpCount === 0 && !errors.upcomingSchedule ? (
          <EmptyRow>No scheduled work is coming up in the current organization week.</EmptyRow>
        ) : null}
      </BoardSection>

      <BoardSection id="money" label="Money" helper="Receivables summary, not a second ledger">
        <MoneySummary
          receivables={receivables}
          firstOverdue={overdueInvoices[0]}
          openInvoicesUnavailable={errors.openInvoicesUnavailable}
          overdueInvoicesUnavailable={errors.overdueInvoicesUnavailable}
        />
      </BoardSection>
    </div>
  );
}
