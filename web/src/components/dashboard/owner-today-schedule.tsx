import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import type { OwnerScheduleItem } from "./owner-dashboard-data";

interface OwnerTodayScheduleProps {
  items: OwnerScheduleItem[];
}

export function OwnerTodaySchedule({ items }: OwnerTodayScheduleProps) {
  return (
    <Card className="border-border/70">
      <CardHeader className="border-b border-border/60">
        <CardTitle>Today&apos;s Schedule</CardTitle>
        <CardDescription>Mock dispatch data for the first dashboard shell; live scheduling aggregation comes later.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{item.timeWindow}</p>
                  <StatusBadge status={item.status} />
                </div>
                <h3 className="mt-2 break-words text-base font-semibold text-foreground">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.customer}</p>
              </div>
              <Link href="/projects" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Open
              </Link>
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Site</p>
                <p className="mt-1 text-foreground">{item.address}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Crew</p>
                <p className="mt-1 text-foreground">{item.crew}</p>
              </div>
            </div>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
