import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OwnerKpi } from "./owner-dashboard-data";

interface OwnerKpiCardProps {
  kpi: OwnerKpi;
}

const toneClasses: Record<OwnerKpi["tone"], string> = {
  neutral: "bg-muted/60 text-muted-foreground ring-foreground/10",
  attention: "bg-amber-500/12 text-amber-800 ring-amber-500/20 dark:text-amber-200",
  success: "bg-primary/10 text-primary ring-primary/20",
};

export function OwnerKpiCard({ kpi }: OwnerKpiCardProps) {
  const Icon = kpi.icon;

  return (
    <Card className={cn("relative border-border/70 bg-card/98", kpi.href && "transition-all hover:-translate-y-0.5 hover:bg-card hover:shadow-md")}>
      {kpi.href ? (
        <Link
          href={kpi.href}
          className="absolute inset-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={`${kpi.label}: ${kpi.value}. ${kpi.helper}`}
        />
      ) : null}
      <CardContent className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{kpi.label}</p>
          <p className="mt-3 font-mono text-[1.75rem] font-semibold tabular-nums text-foreground">{kpi.value}</p>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">{kpi.helper}</p>
        </div>
        <div className={cn("rounded-xl p-2.5 ring-1 shadow-sm", toneClasses[kpi.tone])}>
          <Icon aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
  );
}

interface OwnerKpiGridProps {
  kpis: OwnerKpi[];
}

export function OwnerKpiGrid({ kpis }: OwnerKpiGridProps) {
  return (
    <section aria-labelledby="owner-kpis-heading" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <h2 id="owner-kpis-heading" className="sr-only">
        Owner dashboard key metrics
      </h2>
      {kpis.map((kpi) => (
        <OwnerKpiCard key={kpi.id} kpi={kpi} />
      ))}
    </section>
  );
}
