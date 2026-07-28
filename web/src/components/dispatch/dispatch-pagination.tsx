import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DispatchPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  buildHref: (page: number) => string;
}

/**
 * Smallest viable Previous/Next control for the work queue - this app has
 * no existing pagination component to reuse (checked: none exists anywhere
 * under web/src). `buildHref` is supplied by the caller so every link
 * preserves all other active filters/search params, not just `page`.
 * Renders nothing when everything fits on one page (never disabled-and-
 * pointless below its own threshold), and boundary controls render as
 * non-interactive, visually disabled elements rather than dead links.
 */
export function DispatchPagination({ page, pageSize, total, buildHref }: DispatchPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const hasPrevious = page > 1;
  const hasNext = page < totalPages;
  const disabledClassName = cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none opacity-50");

  return (
    <nav aria-label="Work queue pagination" className="flex items-center justify-between gap-3 text-sm">
      {hasPrevious ? (
        <Link href={buildHref(page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Previous
        </Link>
      ) : (
        <span className={disabledClassName} aria-disabled="true">
          Previous
        </span>
      )}

      <span className="text-muted-foreground">
        Page {page} of {totalPages}
      </span>

      {hasNext ? (
        <Link href={buildHref(page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Next
        </Link>
      ) : (
        <span className={disabledClassName} aria-disabled="true">
          Next
        </span>
      )}
    </nav>
  );
}
