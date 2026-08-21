import Link from "next/link";

type FilterOption = { value: string; label: string };
type FilterControl = { name: string; label: string; value?: string; options: FilterOption[] };

export function CatalogQueryControls({
  pathname,
  query,
  total,
  shown,
  nextCursor,
  cursorParam = "cursor",
  sortOptions,
  filters = [],
}: {
  pathname: string;
  query: object;
  total: number;
  shown: number;
  nextCursor: string | null;
  cursorParam?: string;
  sortOptions: FilterOption[];
  filters?: FilterControl[];
}) {
  const rawQuery = query as Record<string, string | undefined>;
  const nextParams = new URLSearchParams();
  for (const [key, value] of Object.entries(rawQuery)) {
    if (value) nextParams.set(key, value);
  }
  if (nextCursor) nextParams.set(cursorParam, nextCursor);
  const nextHref = nextCursor ? `${pathname}?${nextParams.toString()}` : null;

  return (
    <section className="grid gap-3 rounded-lg border border-border/70 bg-surface p-4" aria-label="Catalog query controls">
      <form action={pathname} method="get" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-end">
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Search</span>
          <input name="q" defaultValue={rawQuery.q} placeholder="Search code or name" className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Sort</span>
          <select name="sort" defaultValue={rawQuery.sort ?? sortOptions[0]?.value} className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
            {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Order</span>
          <select name="order" defaultValue={rawQuery.order ?? "asc"} className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
        <button type="submit" className="h-8 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Apply</button>
        {filters.map((filter) => (
          <label key={filter.name} className="grid gap-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{filter.label}</span>
            <select name={filter.name} defaultValue={filter.value ?? ""} className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
              <option value="">All</option>
              {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        ))}
      </form>
      <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>Showing {shown} of {total} records</span>
        {nextHref ? <Link href={nextHref} className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Next page</Link> : <span>End of catalog</span>}
      </div>
    </section>
  );
}
