export default function AthenaTracesLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading Athena traces</span>
      <div className="h-14 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
      <div className="h-14 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
      <div className="h-48 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
      <div className="h-96 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
    </div>
  );
}
