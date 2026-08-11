export default function CostbookLaborRatesLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="space-y-2">
        <div className="h-4 w-24 rounded-md bg-muted" />
        <div className="h-8 w-44 rounded-md bg-muted" />
        <div className="h-4 w-full max-w-xl rounded-md bg-muted" />
      </div>
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Loading labor rates summary">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-lg border border-border/70 bg-surface p-4">
            <div className="h-3 w-24 rounded-md bg-muted" />
            <div className="mt-3 h-8 w-16 rounded-md bg-muted" />
          </div>
        ))}
      </section>
      <div className="rounded-lg border border-border/70 bg-surface p-4">
        <div className="h-5 w-40 rounded-md bg-muted" />
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-8 rounded-md bg-muted" />
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-border/70 bg-surface">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="border-b border-border/70 p-4 last:border-b-0">
            <div className="h-4 w-2/3 rounded-md bg-muted" />
            <div className="mt-3 h-3 w-1/3 rounded-md bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
