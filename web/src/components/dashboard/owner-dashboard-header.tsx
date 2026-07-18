import Link from "next/link";
import { Bell, CalendarDays, CloudSun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

interface OwnerDashboardHeaderProps {
  companyName: string;
  currentDateLabel: string;
  notificationCount: number;
}

export function OwnerDashboardHeader({ companyName, currentDateLabel, notificationCount }: OwnerDashboardHeaderProps) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Owner dashboard</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{companyName}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Your morning command center for jobs, estimates, invoices, scheduling pressure, and the next work that needs an owner decision.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[28rem]">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <CloudSun aria-hidden="true" />
              Weather
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">Rain watch after 3 PM</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <CalendarDays aria-hidden="true" />
              Today
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">{currentDateLabel}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <Bell aria-hidden="true" />
              Notifications
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">{notificationCount} need review</p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link href="/projects" className={buttonVariants()}>
          Review Work
        </Link>
        <Link href="/projects/new" className={buttonVariants({ variant: "outline" })}>
          New Job
        </Link>
        <Link href="/customers" className={buttonVariants({ variant: "outline" })}>
          Customers
        </Link>
        <Badge variant="outline" className="ml-0 border-border/70 bg-background lg:ml-auto">
          Quick actions ready
        </Badge>
      </div>
    </section>
  );
}
