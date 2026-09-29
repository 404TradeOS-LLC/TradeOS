export default function ProjectIntakeLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-5" aria-label="Loading Site Visit">
      <span className="sr-only">Loading Site Visit</span>
      <div className="h-24 animate-pulse rounded-xl border border-border/70 bg-muted/30" />
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl border border-border/70 bg-muted/30" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <div className="h-[34rem] animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
        <div className="grid content-start gap-4">
          <div className="h-56 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
          <div className="h-48 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
          <div className="h-40 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
        </div>
      </div>
    </div>
  );
}
