export default function AthenaLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="grid gap-5">
      <span className="sr-only">Loading Athena workspace</span>
      <div className="h-24 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_280px]">
        <div className="grid content-start gap-4">
          <div className="h-64 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
          <div className="h-56 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
        </div>
        <div className="h-[40rem] animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
        <div className="grid content-start gap-4">
          <div className="h-64 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
          <div className="h-44 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
        </div>
      </div>
    </div>
  );
}
