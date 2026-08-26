import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ListRowLinkProps {
  href: string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  className?: string;
}

/**
 * Standard row for link-list patterns (customers, projects, estimates, documents, …).
 * Centralizes the border/hover/focus treatment and guards long titles/subtitles against
 * overflowing their flex row on narrow viewports.
 */
export function ListRowLink({ href, title, subtitle, trailing, className }: ListRowLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3 text-sm outline-none transition-colors hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{title}</span>
        {subtitle ? <span className="truncate text-muted-foreground">{subtitle}</span> : null}
      </span>
      {trailing ? <span className="flex shrink-0 items-center gap-2">{trailing}</span> : null}
    </Link>
  );
}
