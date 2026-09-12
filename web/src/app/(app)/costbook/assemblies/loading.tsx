export default function CostbookAssembliesLoading() {
  return <div role="status" aria-live="polite" aria-busy="true" className="grid gap-6" aria-label="Loading Costbook assemblies">
    <span className="sr-only">Loading Costbook assemblies</span>
    <div className="h-16 animate-pulse rounded-lg bg-muted" />
    <div className="grid gap-6 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,2fr)]">
      <div className="h-96 animate-pulse rounded-lg bg-muted" />
      <div className="h-96 animate-pulse rounded-lg bg-muted" />
    </div>
  </div>;
}
