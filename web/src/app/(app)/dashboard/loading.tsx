export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-44 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
      <div className="h-40 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="h-64 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
        <div className="h-64 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl border border-border/70 bg-muted/30" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="h-64 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
        <div className="h-64 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
      </div>
      <div className="h-40 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
    </div>
  );
}
