import Link from "next/link";
import type { ComponentType } from "react";
import { CalendarClock, CircleDollarSign, ListTodo, Sparkles } from "lucide-react";
import { buildDashboardTaskSnapshot } from "@/components/dashboard/dashboard-task-model";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDispatchSummary, listOrganizationProjectTasks } from "@/lib/api";
import { formatCurrency } from "@/lib/document-workflow";
import { getCurrentWeekPaymentLedger } from "@/lib/payment-ledger";
import { getSessionToken } from "@/lib/session";
import { cn } from "@/lib/utils";

interface OwnerBriefingPanelProps {
  className?: string;
}

interface BriefingSignal {
  label: string;
  value: string;
  detail: string;
  href: string;
  action: string;
  icon: ComponentType<{ className?: string }>;
}

const TASK_FEED_LIMIT = 24;

export async function OwnerBriefingPanel({ className }: OwnerBriefingPanelProps) {
  const token = await getSessionToken();

  const [dispatchSummary, tasks, paymentLedger] = token
    ? await Promise.all([
        getDispatchSummary(token).catch(() => null),
        listOrganizationProjectTasks(token, { limit: TASK_FEED_LIMIT, includeCompleted: true }).catch(() => null),
        getCurrentWeekPaymentLedger(token).catch(() => null),
      ])
    : [null, null, null];

  const taskTimeZone = dispatchSummary?.timezone.value ?? "UTC";
  const taskSnapshot = tasks ? buildDashboardTaskSnapshot(tasks, new Date(), taskTimeZone) : null;

  const signals: BriefingSignal[] = [
    {
      label: "Schedule pressure",
      value: dispatchSummary ? `${dispatchSummary.scheduledToday} today · ${dispatchSummary.unscheduledJobs} unscheduled` : "Unavailable",
      detail: dispatchSummary
        ? `${dispatchSummary.needsAttention} dispatch item${dispatchSummary.needsAttention === 1 ? "" : "s"} currently need attention.`
        : "Dispatch summary could not be loaded.",
      href: "/dispatch",
      action: "Open dispatch",
      icon: CalendarClock,
    },
    {
      label: "Task pressure",
      value: taskSnapshot ? `${taskSnapshot.overdueCount} overdue · ${taskSnapshot.blockedCount} blocked` : "Unavailable",
      detail: taskSnapshot
        ? `${taskSnapshot.dueTodayCount} open task${taskSnapshot.dueTodayCount === 1 ? " is" : "s are"} due today in the live task feed.`
        : "Task feed could not be loaded.",
      href: "/dashboard/overdue-tasks",
      action: "Review tasks",
      icon: ListTodo,
    },
    {
      label: "Recorded revenue",
      value: paymentLedger ? formatCurrency(paymentLedger.totalAmount) : "Unavailable",
      detail: paymentLedger
        ? `${paymentLedger.payments.length} recorded payment${paymentLedger.payments.length === 1 ? "" : "s"} in the current organization week.`
        : "Payment ledger could not be loaded.",
      href: "/dashboard/revenue-this-week",
      action: "View ledger",
      icon: CircleDollarSign,
    },
  ];

  const urgentSignal = taskSnapshot?.overdueCount
    ? `${taskSnapshot.overdueCount} overdue task${taskSnapshot.overdueCount === 1 ? " needs" : "s need"} attention.`
    : dispatchSummary?.needsAttention
      ? `${dispatchSummary.needsAttention} dispatch item${dispatchSummary.needsAttention === 1 ? " needs" : "s need"} attention.`
      : dispatchSummary || taskSnapshot || paymentLedger
        ? "No urgent signal is currently elevated by this briefing."
        : "Live briefing signals are temporarily unavailable.";

  return (
    <Card className={cn("border-border/70 bg-muted/10", className)}>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Owner Briefing</CardTitle>
            <CardDescription>Deterministic summary of live TradeOS signals. No AI-generated facts or autonomous actions.</CardDescription>
          </div>
          <div className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            Live signals
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl border border-border/60 bg-background/80 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-2 text-muted-foreground">
              <Sparkles className="size-4" aria-hidden="true" />
            </div>
            <div>
              <div className="font-medium text-foreground">{urgentSignal}</div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Athena execution stays off here until business-tool rollout. This briefing only summarizes already-authorized read paths and links you to the existing workflows.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          {signals.map((signal) => {
            const Icon = signal.icon;

            return (
              <div key={signal.label} className="rounded-xl border border-border/60 bg-background/80 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-2 text-muted-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{signal.label}</div>
                    <div className="mt-1 break-words font-medium text-foreground">{signal.value}</div>
                    <p className="mt-1 text-sm text-muted-foreground">{signal.detail}</p>
                    <Link href={signal.href} className={cn(buttonVariants({ variant: "link", size: "sm" }), "mt-2 h-auto px-0 py-0")}>
                      {signal.action}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
