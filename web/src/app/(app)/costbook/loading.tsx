export default function CostbookLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading Costbook workspace</span>
      <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded-md bg-muted" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border/70 bg-card p-4 md:col-span-2">
          <div className="h-4 w-40 animate-pulse rounded-md bg-muted" />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border/70 bg-card p-4">
          <div className="h-4 w-32 animate-pulse rounded-md bg-muted" />
          <div className="mt-4 grid gap-2">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-9 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, item) => (
          <div key={item} className="h-28 animate-pulse rounded-lg border border-border/70 bg-card" />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, item) => (
          <div key={item} className="h-24 animate-pulse rounded-lg border border-border/70 bg-card" />
        ))}
      </div>
      </div>
    </div>
  );
}
