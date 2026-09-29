export default function DispatchLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-5">
      <span className="sr-only">Loading schedule</span>
      <div className="h-16 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
      <div className="h-10 w-80 max-w-full animate-pulse rounded-full border border-border/70 bg-muted/30" />
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="h-[28rem] animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
        <div className="grid gap-4">
          <div className="h-16 animate-pulse rounded-xl border border-border/70 bg-muted/30" />
          <div className="h-64 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
          <div className="h-48 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
        </div>
      </div>
    </div>
  );
}
