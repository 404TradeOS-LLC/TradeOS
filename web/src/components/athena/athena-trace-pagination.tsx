import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Cursor-based pagination is forward-only by construction (nextCursor is an
 * opaque execution id, not a page number - see AthenaTraceSearchResult in
 * lib/api.ts), so there is no "Previous" to build without keeping a client-
 * side cursor history. "Start over" (clear the cursor, keep filters) is the
 * reachable way back rather than a fake/broken Previous link.
 */
interface AthenaTracePaginationProps {
  nextHref: string | null;
  hasCursor: boolean;
  resetHref: string;
}

export function AthenaTracePagination({ nextHref, hasCursor, resetHref }: AthenaTracePaginationProps) {
  if (!nextHref && !hasCursor) return null;

  return (
    <nav aria-label="Trace results pagination" className="flex items-center justify-between gap-3 text-sm">
      {hasCursor ? (
        <Link href={resetHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Start over
        </Link>
      ) : (
        <span />
      )}

      {nextHref ? (
        <Link href={nextHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Next page
        </Link>
      ) : (
        <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none opacity-50")} aria-disabled="true">
          Next page
        </span>
      )}
    </nav>
  );
}
