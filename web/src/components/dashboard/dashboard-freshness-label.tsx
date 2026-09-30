"use client";

import { useEffect, useState } from "react";

function formatFreshness(seconds: number): string {
  if (seconds < 45) return "Updated just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Updated ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  return `Updated ${hours} hour${hours === 1 ? "" : "s"} ago`;
}

/**
 * Relative "Updated Xs ago" label for the dashboard header, measured from
 * when this page's data was rendered (component mount) - the dashboard has
 * no other live-data cue, so a static-looking page with real numbers reads
 * as stale even right after loading.
 */
export function DashboardFreshnessLabel() {
  const [loadedAt] = useState(() => Date.now());
  const [label, setLabel] = useState("Updated just now");

  useEffect(() => {
    const tick = () => setLabel(formatFreshness((Date.now() - loadedAt) / 1000));
    tick();
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
  }, [loadedAt]);

  return <span className="text-xs text-muted-foreground">{label}</span>;
}
