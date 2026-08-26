interface TimelineItem {
  label: string;
  value: string;
  active: boolean;
}

interface TimelineProps {
  items: TimelineItem[];
}

export function Timeline({ items }: TimelineProps) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
          <div className={`mt-1 size-2 rounded-full ${item.active ? "bg-primary" : "bg-border"}`} />
          <div>
            <div className="text-sm font-medium">{item.label}</div>
            <div className="text-sm text-muted-foreground">{item.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
