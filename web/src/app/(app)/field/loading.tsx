export default function FieldLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="mx-auto grid w-full max-w-4xl gap-4 pb-28 sm:gap-5 2xl:pb-6" aria-label="Loading your field day">
      <span className="sr-only">Loading field view</span>
      <div className="h-16 animate-pulse rounded-xl bg-muted/30" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-20 min-w-40 animate-pulse rounded-xl border border-border/70 bg-muted/30" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
      <div className="h-44 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
    </div>
  );
}
