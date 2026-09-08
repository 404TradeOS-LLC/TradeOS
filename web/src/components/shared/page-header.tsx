import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  /** Full ancestor trail (e.g. Project name -> Estimate v2), for routes
   *  nested more than one level deep. Takes precedence over backHref/backLabel
   *  when present - the last entry (the current page) should omit href. */
  breadcrumbs?: Breadcrumb[];
  action?: ReactNode;
  className?: string;
}

/**
 * Standard title block for list/detail pages. Centralizes the back-link
 * pattern (previously only present on a couple of pages) so every
 * detail/sub-detail view gets a consistent way back to its parent list.
 */
export function PageHeader({ title, description, backHref, backLabel = "Back", breadcrumbs, action, className }: PageHeaderProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? <ChevronRight aria-hidden="true" className="size-3.5 shrink-0" /> : null}
              {crumb.href ? (
                <Link href={crumb.href} className="truncate outline-none transition-colors hover:text-foreground focus-visible:text-foreground">
                  {crumb.label}
                </Link>
              ) : (
                <span className="truncate text-foreground" aria-current="page">
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      ) : backHref ? (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {backLabel}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {description ? <p className="max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
