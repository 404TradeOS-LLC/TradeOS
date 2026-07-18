import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OwnerKpi } from "./owner-dashboard-data";

interface OwnerKpiCardProps {
  kpi: OwnerKpi;
}

const toneClasses: Record<OwnerKpi["tone"], string> = {
  neutral: "bg-muted/30 text-muted-foreground ring-foreground/10",
  attention: "bg-accent text-accent-foreground ring-primary/20",
  success: "bg-primary/10 text-primary ring-primary/20",
};

export function OwnerKpiCard({ kpi }: OwnerKpiCardProps) {
  const Icon = kpi.icon;

  return (
    <Card className="border-border/70 bg-card">
      <CardContent className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{kpi.label}</p>
          <p className="mt-3 font-mono text-2xl font-semibold tabular-nums text-foreground">{kpi.value}</p>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">{kpi.helper}</p>
        </div>
        <div className={cn("rounded-xl p-2.5 ring-1", toneClasses[kpi.tone])}>
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
