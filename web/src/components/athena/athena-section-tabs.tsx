import Link from "next/link";
import { cn } from "@/lib/utils";

// Real sub-routes (not the ?tab= query-param pattern project-workspace-tabs.tsx
// uses), matching how the task described this section's layout - each of
// these is its own page.tsx with its own loading.tsx, not a client-rendered
// tab switch over one route.
export const ATHENA_SECTIONS = [
  { key: "overview", href: "/athena", label: "Overview" },
  { key: "approvals", href: "/athena/approvals", label: "Approvals" },
  { key: "traces", href: "/athena/traces", label: "Traces" },
  { key: "tools", href: "/athena/tools", label: "Tool Health" },
  { key: "models", href: "/athena/models", label: "Models & Cost" },
  { key: "events", href: "/athena/events", label: "Events & DLQ" },
] as const;

export type AthenaSectionKey = (typeof ATHENA_SECTIONS)[number]["key"];

export function AthenaSectionTabs({ active }: { active: AthenaSectionKey }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card/85 p-2">
      <nav className="flex min-w-max gap-2" aria-label="Athena observability sections">
        {ATHENA_SECTIONS.map((section) => (
          <Link
            key={section.key}
            href={section.href}
            aria-current={active === section.key ? "page" : undefined}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
              active === section.key ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            {section.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
