export default function BrandStudioLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading Brand Studio</span>
      <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="space-y-2">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="space-y-4">
          <div className="h-40 animate-pulse rounded-lg border border-border/70 bg-muted/30" />
          <div className="h-64 animate-pulse rounded-lg border border-border/70 bg-muted/30" />
        </div>
        <div className="h-96 animate-pulse rounded-lg border border-border/70 bg-muted/30" />
      </div>
      </div>
    </div>
  );
}
