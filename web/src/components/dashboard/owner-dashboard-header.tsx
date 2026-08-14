import Link from "next/link";
import { Bell, CalendarDays, CloudSun, FileClock, ReceiptText, Sparkles, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { WeatherSnapshot } from "@/lib/weather";

interface ReviewQueueSnapshot {
  estimates: number;
  proposals: number;
  invoices: number;
  starts: number;
}

interface OwnerDashboardHeaderProps {
  companyName: string;
  currentDateLabel: string;
  notificationCount: number;
  weather: WeatherSnapshot | null;
  reviewQueue: ReviewQueueSnapshot;
}

function WeatherSummary({ weather }: { weather: WeatherSnapshot | null }) {
  if (!weather) {
    return <p className="mt-2 text-sm font-medium text-muted-foreground">No forecast for today&apos;s job site</p>;
  }

  const precipitation =
    weather.precipitationChance != null && weather.precipitationChance > 0 ? ` · ${weather.precipitationChance}% precip` : "";

  return (
    <>
      <p className="mt-2 truncate text-sm font-medium text-foreground">
        {weather.temperature}°{weather.temperatureUnit} · {weather.shortForecast}
        {precipitation}
      </p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">
        {weather.periodName}, {weather.locationLabel}
      </p>
    </>
  );
}

export function OwnerDashboardHeader({
  companyName,
  currentDateLabel,
  notificationCount,
  weather,
  reviewQueue,
}: OwnerDashboardHeaderProps) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card/98 p-5 shadow-sm sm:p-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(26rem,0.8fr)]">
        <div className="rounded-2xl border border-border/60 bg-background/80 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Owner dashboard</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{companyName}</h1>
            </div>
            <Badge variant="outline" className="border-primary/20 bg-primary/8 text-primary">
              {notificationCount} in queue
            </Badge>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Your morning command center for jobs, estimates, invoices, scheduling pressure, and the next work that needs an owner decision.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <CloudSun aria-hidden="true" className="size-4" />
                Weather
              </div>
              <WeatherSummary weather={weather} />
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <CalendarDays aria-hidden="true" className="size-4" />
                Today
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">{currentDateLabel}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <Bell aria-hidden="true" className="size-4" />
                Notifications
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">{notificationCount} need review</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link href="/projects" className={buttonVariants()}>
              Review work
            </Link>
            <Link href="/projects/new" className={buttonVariants({ variant: "outline" })}>
              New job
            </Link>
            <Link href="/customers" className={buttonVariants({ variant: "outline" })}>
              Customers
            </Link>
            <Badge variant="outline" className="ml-0 border-border/70 bg-background lg:ml-auto">
              Quick actions ready
            </Badge>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-background/80 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Review Queue</div>
              <p className="mt-1 text-sm text-muted-foreground">Owner-visible work waiting on a decision across estimating, billing, and starts.</p>
            </div>
            <div className="rounded-full border border-border/70 bg-muted px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Live totals
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <FileClock className="size-4" />
                Estimates
              </div>
              <div className="mt-3 text-3xl font-semibold text-foreground">{reviewQueue.estimates}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <Sparkles className="size-4" />
                Proposals
              </div>
              <div className="mt-3 text-3xl font-semibold text-foreground">{reviewQueue.proposals}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <ReceiptText className="size-4" />
                Invoices
              </div>
              <div className="mt-3 text-3xl font-semibold text-foreground">{reviewQueue.invoices}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <Wrench className="size-4" />
                Ready to Start
              </div>
              <div className="mt-3 text-3xl font-semibold text-foreground">{reviewQueue.starts}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
