import { cn } from "@/lib/utils";

interface AIConfidenceMeterProps {
  confidence: number | null;
  className?: string;
}

export function AIConfidenceMeter({ confidence, className }: AIConfidenceMeterProps) {
  const value = confidence ?? 0;
  const label = confidence === null ? "Not scored" : `${confidence}%`;

  return (
    <div className={cn("rounded-xl border border-border/60 bg-muted/20 p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">AI confidence</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">{label}</div>
        </div>
        <div className="text-right text-xs text-muted-foreground">Latest intake score</div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-border/60">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
      </div>
    </div>
  );
}

