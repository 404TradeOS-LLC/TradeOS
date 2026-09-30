export default function CostbookResearchReviewLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading research review queue</span>
      <div className="space-y-2">
        <div className="h-4 w-24 rounded-md bg-muted animate-pulse" />
        <div className="h-8 w-52 rounded-md bg-muted animate-pulse" />
        <div className="h-4 w-full max-w-xl rounded-md bg-muted animate-pulse" />
      </div>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Loading review queue summary">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="rounded-lg border border-border/70 bg-card p-4">
            <div className="h-3 w-24 rounded-md bg-muted animate-pulse" />
            <div className="mt-3 h-8 w-16 rounded-md bg-muted animate-pulse" />
          </div>
        ))}
      </section>
      <div className="rounded-lg border border-border/70 bg-card p-4">
        <div className="h-5 w-44 rounded-md bg-muted animate-pulse" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-8 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(280px,1fr)_minmax(0,1.4fr)]">
        <div className="rounded-lg border border-border/70 bg-card">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="border-b border-border/70 p-4 last:border-b-0">
              <div className="h-4 w-2/3 rounded-md bg-muted animate-pulse" />
              <div className="mt-3 h-3 w-1/3 rounded-md bg-muted animate-pulse" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border/70 bg-card p-4">
          <div className="h-5 w-1/2 rounded-md bg-muted animate-pulse" />
          {[0, 1, 2].map((item) => (
            <div key={item} className="mt-4 h-24 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
