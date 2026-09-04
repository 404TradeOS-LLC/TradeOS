export default function CostbookPriceHistoryLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading price history">
      <div className="space-y-2">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-12 animate-pulse rounded-lg border border-border/70 bg-muted/30" />
      <div className="overflow-hidden rounded-lg border border-border/70 bg-card">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="border-b border-border/70 p-4 last:border-b-0">
            <div className="h-4 w-2/3 animate-pulse rounded-md bg-muted" />
            <div className="mt-3 h-3 w-1/3 animate-pulse rounded-md bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
