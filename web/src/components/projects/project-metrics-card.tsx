import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SummaryMetricCard } from "@/components/shared/summary-metric-card";

interface ProjectMetricsCardProps {
  metrics: Array<{ label: string; value: string }>;
}

export function ProjectMetricsCard({ metrics }: ProjectMetricsCardProps) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>At a glance</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <SummaryMetricCard key={metric.label} label={metric.label} value={metric.value} />
        ))}
      </CardContent>
    </Card>
  );
}
