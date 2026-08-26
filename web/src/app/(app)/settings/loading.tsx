export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-40 animate-pulse rounded-[28px] border border-border/70 bg-muted/30" />
      <div className="h-20 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <div className="hidden h-96 animate-pulse rounded-2xl border border-border/70 bg-muted/30 xl:block" />
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded-[24px] border border-border/70 bg-muted/30" />
          <div className="h-72 animate-pulse rounded-[24px] border border-border/70 bg-muted/30" />
          <div className="h-72 animate-pulse rounded-[24px] border border-border/70 bg-muted/30" />
        </div>
      </div>
    </div>
  );
}
