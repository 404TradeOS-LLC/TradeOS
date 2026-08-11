import Link from "next/link";
import { cn } from "@/lib/utils";
import { athenaWindowPresets, type AthenaWindowPreset } from "@/lib/athena-overview-model";

const PRESET_LABELS: Record<AthenaWindowPreset, string> = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

/**
 * Shared time-window switcher for the metrics pages (Overview, Tool Health,
 * Models & Cost, Events & DLQ). Plain links, not client state - the active
 * preset lives in the URL (?window=7d) so it's shareable and the resulting
 * fetch always happens server-side, matching this app's existing GET-form
 * filter convention (see dispatch-filter-bar.tsx).
 */
export function AthenaWindowSwitcher({ basePath, active }: { basePath: string; active: AthenaWindowPreset }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Time window">
      {athenaWindowPresets.map((preset) => (
        <Link
          key={preset}
          href={preset === "24h" ? basePath : `${basePath}?window=${preset}`}
          aria-current={active === preset ? "true" : undefined}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
            active === preset
              ? "border-foreground bg-foreground text-background"
              : "border-border/70 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
        >
          {PRESET_LABELS[preset]}
        </Link>
      ))}
    </div>
  );
}
