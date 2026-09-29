export default function AssemblyDetailLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-5">
      <span className="sr-only">Loading assembly detail</span>
      <div className="h-20 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-5">
          <div className="h-48 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
          <div className="h-96 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
        </div>
        <div className="grid content-start gap-4">
          <div className="h-40 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
          <div className="h-44 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
          <div className="h-40 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
        </div>
      </div>
    </div>
  );
}
