import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { reviewSupplierCanonicalMatchAction } from "@/app/actions/costbook-supplier-evidence";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { getCostbookWorkspace } from "@/lib/api";
import {
  getRegionalSupplierEvidenceSummary,
  listRegionalSupplierEvidence,
  previewRegionalSupplierCanonicalMatch,
  type RegionalSupplierCanonicalMatch,
  type RegionalSupplierEvidenceItem,
  type RegionalSupplierEvidenceSummary,
  type RegionalSupplierPriceStatus,
} from "@/lib/costbook-api";
import { getSessionToken } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Supplier Evidence | Costbook | TradeOS",
  description: "Review tenant-scoped regional supplier observations and governed canonical matches.",
};

type QueryValue = string | string[] | undefined;

type SupplierEvidenceQuery = {
  q?: QueryValue;
  priceStatus?: QueryValue;
  cursor?: QueryValue;
  observationId?: QueryValue;
  productId?: QueryValue;
};

type SupplierEvidenceData = {
  canManage: boolean;
  rows: RegionalSupplierEvidenceItem[];
  summary: RegionalSupplierEvidenceSummary;
  selected: RegionalSupplierEvidenceItem | null;
  match: RegionalSupplierCanonicalMatch | null;
  nextCursor: string | null;
};

const statuses: Array<{ value: RegionalSupplierPriceStatus; label: string }> = [
  { value: "priced", label: "Priced" },
  { value: "needs-review", label: "Needs review" },
  { value: "unavailable", label: "Unavailable" },
  { value: "not-listed", label: "Not listed" },
];

const PAGE_SIZE = 100;

function singleQueryValue(value: QueryValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeStatus(value: string | undefined): RegionalSupplierPriceStatus | undefined {
  return statuses.some((status) => status.value === value)
    ? (value as RegionalSupplierPriceStatus)
    : undefined;
}

export default async function SupplierEvidencePage({
  searchParams,
}: {
  searchParams: Promise<SupplierEvidenceQuery>;
}) {
  const token = await getSessionToken();
  const query = await searchParams;

  if (!token) {
    return <EmptyState title="Sign in required" description="You need an authenticated Costbook session." />;
  }

  let data: SupplierEvidenceData | null = null;
  let loadError: string | null = null;

  const q = singleQueryValue(query.q)?.trim() || undefined;
  const priceStatus = normalizeStatus(singleQueryValue(query.priceStatus));
  const cursor = singleQueryValue(query.cursor);
  const observationId = singleQueryValue(query.observationId);
  const productId = singleQueryValue(query.productId);

  try {
    const [workspace, fetchedRows, summary] = await Promise.all([
      getCostbookWorkspace(token),
      listRegionalSupplierEvidence(token, {
        q,
        priceStatus,
        cursor,
        limit: PAGE_SIZE + 1,
      }),
      getRegionalSupplierEvidenceSummary(token),
    ]);

    const hasNextPage = fetchedRows.length > PAGE_SIZE;
    const rows = fetchedRows.slice(0, PAGE_SIZE);
    const selected =
      rows.find((row) => row.id === observationId) ??
      rows.find((row) => row.supplierProductId === productId) ??
      rows[0] ??
      null;

    let match: RegionalSupplierCanonicalMatch | null = null;
    if (selected) {
      try {
        match = await previewRegionalSupplierCanonicalMatch(token, selected.supplierProductId);
      } catch {
        match = null;
      }
    }

    data = {
      canManage: workspace.permissions.canManage,
      rows,
      summary,
      selected,
      match,
      nextCursor: hasNextPage && rows.length > 0 ? rows[rows.length - 1].id : null,
    };
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Supplier evidence is unavailable.";
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Supplier Evidence"
          description="Regional supplier observations stay evidence until a governed review explicitly promotes pricing."
          backHref="/costbook"
          backLabel="Costbook"
        />
        <EmptyState title="Couldn't load supplier evidence" description={loadError ?? "Supplier evidence is unavailable."} />
      </div>
    );
  }

  const { rows, summary, selected, match, nextCursor } = data;
  const activeStatus = priceStatus;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Supplier Evidence"
        description="Review local supplier observations, availability, normalized prices, and canonical identity without silently changing Material costs."
        backHref="/costbook"
        backLabel="Costbook"
      />

      <section aria-label="Supplier evidence summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryTile label="Observations" value={summary.totalObservations} />
        <SummaryTile label="Priced" value={summary.priced} />
        <SummaryTile label="Needs review" value={summary.needsReview} />
        <SummaryTile label="Unavailable" value={summary.unavailable} />
        <SummaryTile label="Suppliers" value={summary.suppliers} />
      </section>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-foreground">Evidence is not the current Material price</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              This workspace reviews supplier observations and product identity only. Confirming a canonical match does not write
              <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">Material.unitCost</code>
              or reprice an existing estimate.
            </p>
          </div>
        </div>
      </div>

      <form method="get" className="grid gap-3 rounded-xl border border-border/70 bg-card p-4 md:grid-cols-[minmax(0,1fr)_220px_auto]">
        <label className="relative">
          <span className="sr-only">Search supplier evidence</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search product, observation, or canonical key…"
            className="h-10 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        <label>
          <span className="sr-only">Filter by price status</span>
          <select
            name="priceStatus"
            defaultValue={activeStatus ?? ""}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">All evidence states</option>
            {statuses.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
        </label>
        <button type="submit" className={cn(buttonVariants(), "h-10")}>Filter</button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title="No supplier evidence matches"
          description="Try a broader search or another evidence state. No placeholder prices are generated for missing observations."
        />
      ) : (
        <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
            <div className="border-b border-border/70 px-4 py-3">
              <h2 className="font-semibold text-foreground">Regional observations</h2>
              <p className="mt-1 text-xs text-muted-foreground">Showing up to {PAGE_SIZE} matching observations per page, newest first.</p>
            </div>
            <div className="divide-y divide-border/70">
              {rows.map((row) => {
                const selectedRow = selected?.id === row.id;
                return (
                  <Link
                    key={row.id}
                    href={evidenceHref({ q, priceStatus, cursor }, row.id, row.supplierProductId)}
                    aria-current={selectedRow ? "true" : undefined}
                    className={cn(
                      "grid gap-3 p-4 outline-none transition hover:bg-muted/30 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 md:grid-cols-[minmax(0,1fr)_140px_150px]",
                      selectedRow && "bg-muted/35"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{row.supplierProductName}</p>
                        <EvidenceStatus status={row.priceStatus} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.supplierName}{row.storeName ? ` · ${row.storeName}` : ""}
                      </p>
                      <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                        {row.canonicalMaterialKey ?? "Canonical identity unlinked"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Normalized price</p>
                      <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-foreground">
                        {row.normalizedUnitPrice === null ? "—" : money(row.normalizedUnitPrice, row.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">{row.normalizedUnit ? `/ ${row.normalizedUnit}` : "Unit unavailable"}</p>
                    </div>
                    <div className="md:text-right">
                      <p className="text-xs text-muted-foreground">Observed</p>
                      <p className="mt-1 text-sm text-foreground">{formatDate(row.observedAt)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.sourceFile ? sourceLabel(row.sourceFile, row.sourceRow) : "Source file unavailable"}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border/70 px-4 py-3">
              {cursor ? (
                <Link href={pageHref({ q, priceStatus })} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  Newest
                </Link>
              ) : <span />}
              {nextCursor ? (
                <Link href={pageHref({ q, priceStatus, cursor: nextCursor })} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Next page
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              ) : (
                <span className="text-xs text-muted-foreground">End of matching evidence</span>
              )}
            </div>
          </div>

          {selected ? (
            <aside className="h-fit rounded-xl border border-border/70 bg-card p-4 xl:sticky xl:top-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Product identity</p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">{selected.supplierProductName}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{selected.supplierName}</p>
                </div>
                <EvidenceStatus status={selected.priceStatus} />
              </div>

              <dl className="mt-4 grid gap-3 border-t border-border/70 pt-4">
                <Detail label="Supplier product key" value={selected.supplierProductKey} mono />
                <Detail label="Current canonical key" value={selected.canonicalMaterialKey ?? "Not linked"} mono />
                <Detail label="Observation key" value={selected.observationKey} mono />
              </dl>

              <div className="mt-4 border-t border-border/70 pt-4">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Canonical matcher</p>
                {match ? (
                  <>
                    <div className="mt-3 flex items-center gap-2">
                      <MatchBadge action={match.match.action} />
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {Math.round(match.match.score * 100)}%
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-foreground">{match.match.rationale}</p>

                    {match.match.canonicalMaterialKey ? (
                      <div className="mt-3 rounded-lg border border-border/70 bg-background p-3">
                        <p className="text-xs text-muted-foreground">Suggested governed identity</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{match.match.displayName ?? "Canonical material"}</p>
                        <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{match.match.canonicalMaterialKey}</p>
                      </div>
                    ) : (
                      <p className="mt-3 rounded-lg border border-border/70 bg-background p-3 text-sm text-muted-foreground">
                        No pilot identity cleared the review threshold. Keep this product unlinked rather than guessing.
                      </p>
                    )}

                    {data.canManage &&
                    !match.currentCanonicalMaterialKey &&
                    match.match.canonicalMaterialKey ? (
                      <form action={reviewSupplierCanonicalMatchAction} className="mt-4">
                        <input type="hidden" name="supplierProductId" value={selected.supplierProductId} />
                        <input type="hidden" name="canonicalMaterialKey" value={match.match.canonicalMaterialKey} />
                        <button type="submit" className={cn(buttonVariants(), "w-full")}>
                          <CheckCircle2 className="size-4" aria-hidden="true" />
                          Confirm suggested match
                        </button>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          Records your authenticated review decision only. It does not apply a supplier price.
                        </p>
                      </form>
                    ) : null}

                    {match.currentCanonicalMaterialKey ? (
                      <div className="mt-4 flex items-start gap-2 rounded-lg border border-border/70 bg-background p-3">
                        <CheckCircle2 className="mt-0.5 size-4 text-primary" aria-hidden="true" />
                        <p className="text-sm text-muted-foreground">This supplier product is already linked to a governed canonical key.</p>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Canonical match analysis is unavailable. The stored observation remains visible and unchanged.
                  </p>
                )}
              </div>

              <Link href="/costbook/materials" className="mt-4 flex items-center justify-between border-t border-border/70 pt-4 text-sm font-medium text-foreground hover:underline">
                Open Material catalog
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </aside>
          ) : null}
        </section>
      )}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function EvidenceStatus({ status }: { status: string }) {
  const label = statuses.find((item) => item.value === status)?.label ?? status;
  return (
    <span className="inline-flex rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {label}
    </span>
  );
}

function MatchBadge({ action }: { action: RegionalSupplierCanonicalMatch["match"]["action"] }) {
  const label =
    action === "AUTO_LINK" ? "High-confidence match" :
    action === "HUMAN_REVIEW" ? "Human review" :
    "No governed match";
  return (
    <span className="inline-flex rounded-full border border-border/70 bg-background px-2 py-1 text-xs font-medium text-foreground">
      {label}
    </span>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 break-words text-sm text-foreground", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}

function pageHref(input: {
  q?: string;
  priceStatus?: RegionalSupplierPriceStatus;
  cursor?: string;
}) {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.priceStatus) params.set("priceStatus", input.priceStatus);
  if (input.cursor) params.set("cursor", input.cursor);
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return `/costbook/supplier-evidence${suffix}`;
}

function evidenceHref(
  input: { q?: string; priceStatus?: RegionalSupplierPriceStatus; cursor?: string },
  observationId: string,
  productId: string
) {
  const base = new URL(pageHref(input), "https://tradeos.local");
  base.searchParams.set("observationId", observationId);
  base.searchParams.set("productId", productId);
  return `${base.pathname}?${base.searchParams.toString()}`;
}

function sourceLabel(sourceFile: string, sourceRow: number | null) {
  return sourceRow ? `${sourceFile} · row ${sourceRow}` : sourceFile;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function money(value: number, currency: string) {
  const code = currency.toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(value);
  } catch {
    return `${code} ${new Intl.NumberFormat("en-US").format(value)}`;
  }
}
