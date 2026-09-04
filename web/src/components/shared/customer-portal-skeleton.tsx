interface CustomerPortalSkeletonProps {
  label: string;
  /** Number of stacked card placeholders below the header. */
  cards?: number;
}

/**
 * Shared loading skeleton for the external customer-portal routes. These
 * pages render their own <main> shell (no AppNav, narrower max-w-5xl
 * container) rather than the internal app layout, so they get their own
 * skeleton instead of reusing DocumentDetailSkeleton.
 */
export function CustomerPortalSkeleton({ label, cards = 2 }: CustomerPortalSkeletonProps) {
  return (
    <main
      className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10"
      aria-busy="true"
      aria-label={label}
    >
      <div className="space-y-3">
        <div className="h-3 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: cards }).map((_, index) => (
          <div key={index} className="h-40 animate-pulse rounded-xl border border-border/70 bg-muted/30" />
        ))}
      </div>
    </main>
  );
}
