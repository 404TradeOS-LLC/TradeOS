export default function EstimateCompareLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-6" aria-label="Loading estimate comparison">
      <span className="sr-only">Loading estimate comparison</span>
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-16 animate-pulse rounded-lg border border-border/70 bg-muted/30" />
        <div className="h-16 animate-pulse rounded-lg border border-border/70 bg-muted/30" />
      </div>
      <div className="h-96 animate-pulse rounded-lg border border-border/70 bg-muted/30" />
    </div>
  );
}
