import { cn } from "@/lib/utils";

interface AIProgressIndicatorProps {
  label: string;
  value: number;
  className?: string;
}

export function AIProgressIndicator({ label, value, className }: AIProgressIndicatorProps) {
  const clamped = Math.min(Math.max(value, 0), 100);

  return (
    <div className={cn("rounded-xl border border-border/60 bg-muted/20 p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-sm text-muted-foreground">{clamped}%</div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-border/60">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

