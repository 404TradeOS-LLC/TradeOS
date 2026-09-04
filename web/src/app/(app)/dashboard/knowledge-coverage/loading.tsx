export default function KnowledgeCoverageLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading knowledge coverage">
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-lg border border-border/70 bg-muted/30" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg border border-border/70 bg-muted/30" />
    </div>
  );
}
