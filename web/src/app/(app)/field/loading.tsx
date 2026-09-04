export default function FieldLoading() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,2fr)]" aria-busy="true" aria-label="Loading your field day">
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-lg border border-border/70 bg-muted/30" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
    </div>
  );
}
