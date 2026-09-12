"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const STORAGE_PREFIX = "tradeos-collapsed:";

function storageKey(id: string) {
  return `${STORAGE_PREFIX}${id}`;
}

function isCollapsed(id: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(id)) === "1";
  } catch {
    return false;
  }
}

function setCollapsed(id: string, value: boolean) {
  try {
    window.localStorage.setItem(storageKey(id), value ? "1" : "0");
    window.dispatchEvent(new Event(storageKey(id)));
  } catch {
    // Storage may be unavailable (private browsing); collapse state just
    // won't persist across reloads, which is a fine degradation.
  }
}

function subscribe(id: string, onChange: () => void) {
  window.addEventListener(storageKey(id), onChange);
  return () => window.removeEventListener(storageKey(id), onChange);
}

function getServerSnapshot() {
  return false;
}

interface CollapsibleCardProps {
  /** Stable, unique id for this section's persisted collapsed state. */
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/**
 * A dashboard Card whose body can be collapsed, per-browser-persisted via
 * localStorage - for supplementary sections a returning owner may not want
 * to see every time (not the core Needs Attention / KPI / Quick Actions
 * sections, which always stay expanded).
 */
export function CollapsibleCard({ id, title, description, children, className }: CollapsibleCardProps) {
  const collapsed = useSyncExternalStore(
    (onChange) => subscribe(id, onChange),
    () => isCollapsed(id),
    getServerSnapshot
  );

  return (
    <Card className={cn("border-border/70", className)}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={`${id}-content`}
          onClick={() => setCollapsed(id, !collapsed)}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronDown className={cn("size-4 transition-transform duration-(--dur-2)", collapsed && "-rotate-90")} aria-hidden="true" />
          <span className="sr-only">{collapsed ? `Expand ${title}` : `Collapse ${title}`}</span>
        </button>
      </CardHeader>
      {collapsed ? null : <CardContent id={`${id}-content`}>{children}</CardContent>}
    </Card>
  );
}
