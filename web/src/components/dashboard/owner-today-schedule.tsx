import Link from "next/link";
import { ArrowUpRight, MapPinned, Users2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import type { OwnerScheduleItem } from "./owner-dashboard-data";

interface OwnerTodayScheduleProps {
  items: OwnerScheduleItem[];
}

export function OwnerTodaySchedule({ items }: OwnerTodayScheduleProps) {
  return (
    <DashboardPanel
      title="Today's Schedule"
      description="Jobs scheduled for today, pulled live from the dispatch workspace."
      action={
        <Link href="/dispatch" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Open dispatch
        </Link>
      }
    >
      {items.length === 0 ? (
        <EmptyState
          title="No jobs scheduled today."
          description="Nothing on today's schedule yet. Dispatch a job or check unscheduled work in the dispatch workspace."
          action={
            <Link href="/dispatch" className={buttonVariants({ variant: "outline" })}>
              Open dispatch
            </Link>
          }
        />
      ) : (
        items.map((item) => (
          <article key={item.id} className="rounded-xl border border-border/60 bg-background/85 p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="rounded-full bg-muted px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {item.timeWindow}
                  </p>
                  <StatusBadge status={item.status} />
                </div>
                <h3 className="mt-2 break-words text-base font-semibold text-foreground">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.customer}</p>
              </div>
              <Link href={item.href} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Open
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <MapPinned className="size-3.5" />
                  Site
                </div>
                <p className="mt-2 text-foreground">{item.address}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <Users2 className="size-3.5" />
                  Crew
                </div>
                <p className="mt-2 text-foreground">{item.crew}</p>
              </div>
            </div>
          </article>
        ))
      )}
    </DashboardPanel>
  );
}
