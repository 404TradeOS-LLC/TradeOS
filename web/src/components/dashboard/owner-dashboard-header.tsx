import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DashboardFreshnessLabel } from "@/components/dashboard/dashboard-freshness-label";
import { OwnerDashboardGreeting, OwnerDashboardSynthesis } from "@/components/dashboard/owner-dashboard-greeting";

interface OwnerDashboardHeaderProps {
  companyName: string;
  currentDateLabel: string;
  notificationCount: number | null;
  todaysJobsCount: number;
  projectScopeLabel: string;
}

export function OwnerDashboardHeader({
  companyName,
  currentDateLabel,
  notificationCount,
  todaysJobsCount,
  projectScopeLabel,
}: OwnerDashboardHeaderProps) {
  const attentionUnavailable = notificationCount == null;
  const hasAttention = notificationCount != null && notificationCount > 0;
  const attentionTone =
    (notificationCount ?? 0) >= 15 ? "destructive" : (notificationCount ?? 0) >= 5 ? "warning" : "info";
  const attentionClasses: Record<"info" | "warning" | "destructive", string> = {
    info: "border-info/30 bg-info/10 text-info",
    warning: "border-warning/30 bg-warning/10 text-warning",
    destructive: "border-destructive/30 bg-destructive/10 text-destructive",
  };

  return (
    <header className="border-b border-border/70 pb-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <OwnerDashboardGreeting /> · {companyName}
            </p>
            <Badge
              variant="outline"
              className={
                attentionUnavailable
                  ? "border-warning/30 bg-warning/10 text-warning"
                  : hasAttention
                    ? attentionClasses[attentionTone]
                    : "border-border/70 bg-muted/30 text-muted-foreground"
              }
            >
              {attentionUnavailable ? "Needs you · unavailable" : hasAttention ? `Needs you · ${notificationCount}` : "On track"}
            </Badge>
          </div>

          <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Today</h1>
          <p className="mt-1 text-sm text-muted-foreground">{currentDateLabel} · What needs action now?</p>
          {notificationCount == null ? (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Some Needs you sources are unavailable. Review the visible queue before assuming you are clear.
            </p>
          ) : (
            <OwnerDashboardSynthesis notificationCount={notificationCount} todaysJobsCount={todaysJobsCount} />
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{projectScopeLabel}</span>
            <span aria-hidden="true">·</span>
            <DashboardFreshnessLabel />
          </div>
        </div>

        <Link href="/projects" className={buttonVariants({ variant: "outline" })}>
          Review work
        </Link>
      </div>
    </header>
  );
}
