export default function CrmLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-5">
      <span className="sr-only">Loading CRM</span>
      <div className="h-16 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
      <div className="h-10 w-80 max-w-full animate-pulse rounded-full border border-border/70 bg-muted/30" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
        <div className="h-72 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
      </div>
      <div className="h-96 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
    </div>
  );
}
