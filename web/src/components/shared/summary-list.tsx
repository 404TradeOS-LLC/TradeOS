interface SummaryListProps {
  items: Array<{ label: string; value: string }>;
}

export function SummaryList({ items }: SummaryListProps) {
  return (
    <dl className="grid gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-border/60 bg-background/80 px-3 py-2">
          <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 text-sm font-medium text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
