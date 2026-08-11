export default function AthenaOverviewLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-14 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
      <div className="h-14 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-lg border border-border/70 bg-muted/30" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
    </div>
  );
}
