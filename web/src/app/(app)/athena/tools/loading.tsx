export default function AthenaToolsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-14 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
      <div className="h-10 animate-pulse rounded-lg border border-border/70 bg-muted/30" />
      <div className="h-80 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
    </div>
  );
}
