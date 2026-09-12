export default function AthenaModelsLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading Athena models</span>
      <div className="h-14 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
      <div className="h-10 animate-pulse rounded-lg border border-border/70 bg-muted/30" />
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-lg border border-border/70 bg-muted/30" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
      <div className="h-64 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
    </div>
  );
}
