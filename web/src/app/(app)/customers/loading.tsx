export default function CustomersLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-16 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-lg border border-border/70 bg-muted/30" />
        ))}
      </div>
      <div className="h-24 animate-pulse rounded-3xl border border-border/70 bg-muted/30" />
      <div className="h-96 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
    </div>
  );
}
