import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

interface OwnerDashboardHeaderProps {
  companyName: string;
  currentDateLabel: string;
  notificationCount: number;
  weather?: unknown;
  projectScopeLabel: string;
  reviewQueue?: {
    estimates: number;
    proposals: number;
    invoices: number;
    starts: number;
  };
}

export function OwnerDashboardHeader({
  companyName,
  currentDateLabel,
  notificationCount,
  projectScopeLabel,
}: OwnerDashboardHeaderProps) {
  const hasAttention = notificationCount > 0;

  return (
    <section className="rounded-2xl border border-border/70 bg-card/98 p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Owner dashboard</p>
            <Badge
              variant="outline"
              className={
                hasAttention
                  ? "border-primary/20 bg-primary/8 text-primary"
                  : "border-border/70 bg-muted/30 text-muted-foreground"
              }
            >
              {hasAttention ? `Needs attention · ${notificationCount}` : "On track"}
            </Badge>
          </div>
          <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{companyName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays aria-hidden="true" className="size-4" />
              {currentDateLabel}
            </span>
            <span>{projectScopeLabel}</span>
          </div>
        </div>

        <Link href="/projects" className={buttonVariants()}>
          Review work
        </Link>
      </div>
    </section>
  );
}
