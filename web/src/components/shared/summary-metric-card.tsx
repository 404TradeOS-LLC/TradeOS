interface SummaryMetricCardProps {
  label: string;
  value: string;
}

export function SummaryMetricCard({ label, value }: SummaryMetricCardProps) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-2 font-mono text-lg font-medium tabular-nums text-foreground">{value}</div>
    </div>
  );
}

