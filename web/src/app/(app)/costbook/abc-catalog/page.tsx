import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearch, ShieldCheck, ArrowLeft, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionToken } from "@/lib/session";
import { listAbcSupplyCatalog, type AbcCatalogResult } from "@/lib/costbook-api";

export const metadata: Metadata = {
  title: "ABC Supply Catalog | TradeOS",
  description: "Browse ABC Supply sandbox products without inventing contractor-specific prices.",
};

type CatalogQuery = {
  q?: string;
  searchBy?: string;
  familyId?: string;
  page?: string;
};

function pageHref(query: CatalogQuery, page: number) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.searchBy === "itemNumber") params.set("searchBy", query.searchBy);
  if (query.familyId) params.set("familyId", query.familyId);
  params.set("page", String(page));
  return "/costbook/abc-catalog?" + params.toString();
}

export default async function AbcCatalogPage({ searchParams }: { searchParams: Promise<CatalogQuery> }) {
  const query = await searchParams;
  const token = await getSessionToken();
  const parsedPage = Number(query.page);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 100_000) : 1;
  const q = query.q?.trim().slice(0, 120) || undefined;
  const familyId = query.familyId?.trim().slice(0, 120) || undefined;
  const searchBy = query.searchBy === "itemNumber" ? "itemNumber" : "itemDescription";
  let catalog: AbcCatalogResult | null = null;
  let error: string | null = null;

  if (!token) {
    error = "Sign in to TradeOS to browse the ABC Supply catalog.";
  } else {
    try {
      catalog = await listAbcSupplyCatalog(token, { q, familyId, searchBy, page, limit: 25 });
    } catch {
      error = "ABC sandbox catalog is not available. Product API browsing must be enabled and authorized on the backend; no prices or materials were changed.";
    }
  }

  const currentQuery = { q, familyId, searchBy, page: String(page) };
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="ABC Supply Catalog"
        description="Live sandbox Product API lookup. Browse supplier products before reviewing units, account availability, and authorized price evidence."
        backHref="/costbook"
        backLabel="Costbook"
      />

      <section className="flex items-start gap-3 rounded-xl border border-border/70 bg-card p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Supplier catalog ≠ approved Costbook price</p>
          <p className="text-sm leading-6 text-muted-foreground">
            These results come directly from ABC Supply&apos;s sandbox and are not saved as Materials.
            Pricing requires an authorized ABC customer account, eligible branch, matching units,
            and TradeOS price review. No catalog result has an assumed or zero-dollar price.
          </p>
        </div>
      </section>

      <p className="text-sm text-muted-foreground">Explore the supplier’s official <Link className="font-semibold text-primary underline underline-offset-4" href="/costbook/abc-catalog/hierarchy">product hierarchy</Link> to see ABC-defined groups, categories, and brands.</p>

      <form method="get" action="/costbook/abc-catalog" className="grid gap-3 rounded-xl border border-border/70 bg-card p-4 sm:grid-cols-[minmax(0,1fr)_170px_auto]">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-muted-foreground">ABC product</span>
          <input name="q" defaultValue={q} maxLength={120} placeholder="Product name or exact item number"
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-muted-foreground">Search by</span>
          <select name="searchBy" defaultValue={searchBy}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm">
            <option value="itemDescription">Description</option>
            <option value="itemNumber">Item number</option>
          </select>
        </label>
        <button type="submit" className="h-11 self-end rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          Search products
        </button>
        <label className="space-y-1 sm:col-span-3">
          <span className="text-xs font-semibold text-muted-foreground">Product family ID (optional)</span>
          <input name="familyId" defaultValue={familyId} maxLength={120} placeholder="Filter by verified ABC family ID"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </label>
      </form>

      {error ? (
        <EmptyState title="ABC catalog unavailable" description={error} />
      ) : catalog ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{catalog.pagination.totalItems.toLocaleString("en-US")}</span> provider results
              {" · "}page {catalog.pagination.pageNumber} of {catalog.pagination.totalPages || 1}
            </p>
            <span className="text-xs font-medium text-muted-foreground">ABC Supply · Sandbox · Not priced</span>
          </div>
          {catalog.items.length === 0 ? (
            <EmptyState title="No active products on this page" description="Try another item name, supplier item number, or page. Provider-reported totals can include inactive items." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2" aria-label="ABC Supply product results">
              {catalog.items.map((product) => (
                <article key={product.itemNumber} className="rounded-xl border border-border/70 bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <PackageSearch className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                    <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">Unpriced</span>
                  </div>
                  <h2 className="mt-3 text-base font-semibold leading-6 text-foreground">
                    <Link className="hover:text-primary hover:underline" href={"/costbook/abc-catalog/" + encodeURIComponent(product.itemNumber)}>
                      {product.name || "ABC item — description not supplied"}
                    </Link>
                  </h2>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">ABC #{product.itemNumber}</p>
                  <dl className="mt-3 grid gap-1 text-sm text-muted-foreground">
                    <div><dt className="inline font-medium">Manufacturer: </dt><dd className="inline">{product.manufacturer || "Not supplied"}</dd></div>
                    <div><dt className="inline font-medium">Family: </dt><dd className="inline">{product.familyName || product.familyId || "Not supplied"}</dd></div>
                    <div><dt className="inline font-medium">Units: </dt><dd className="inline">{product.uoms.length ? "Provider unit options available for verification" : "Not supplied"}</dd></div>
                    {product.isDimensional ? <div>Dimensional item — verify exact variation and length before pricing</div> : null}
                    {product.prop65Warnings.length ? <div>Product carries manufacturer/Prop 65 warning information</div> : null}
                  </dl>
                  <p className="mt-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                    Requires account-scoped pricing and reviewed Material activation before estimating.
                  </p>
                  <Link href={"/costbook/abc-catalog/" + encodeURIComponent(product.itemNumber)}
                    className="mt-3 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline">
                    View units, variants &amp; provider details
                  </Link>
                </article>
              ))}
            </div>
          )}
          <nav aria-label="ABC catalog pagination" className="flex items-center justify-between gap-4">
            {page > 1 ? (
              <Link href={pageHref(currentQuery, page - 1)} className={buttonVariants({ variant: "outline" })}>
                <ArrowLeft className="size-4" aria-hidden="true" /> Previous
              </Link>
            ) : <span />}
            {page < catalog.pagination.totalPages ? (
              <Link href={pageHref(currentQuery, page + 1)} className={buttonVariants({ variant: "outline" })}>
                Next page <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            ) : <span />}
          </nav>
        </>
      ) : null}
    </div>
  );
}
