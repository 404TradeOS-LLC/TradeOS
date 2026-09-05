import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { CatalogQueryControls } from "@/components/costbook/catalog-query-controls";
import { PageHeader } from "@/components/shared/page-header";
import { getCostbookWorkspace } from "@/lib/api";
import { getCostbookPriceHistory, type CostbookPriceHistory, type CostbookPriceHistoryPage } from "@/lib/costbook-api";
import { getSessionToken } from "@/lib/session";

export const metadata: Metadata = { title: "Price History | Costbook | TradeOS" };

type PriceHistoryPageData = {
  canManage: boolean;
  history: CostbookPriceHistory | null;
  materialTotal: number;
  materialNextCursor: string | null;
  estimateTotal: number;
  estimateNextCursor: string | null;
};

type HistoryQuery = { limit?: string; materialCursor?: string; estimateCursor?: string };

export default async function CostbookPriceHistoryPage({ searchParams }: { searchParams: Promise<HistoryQuery> }) {
  const token = await getSessionToken();
  const query = await searchParams;
  if (!token) return <EmptyState title="Sign in required" description="You need an authenticated Costbook session." />;

  let data: PriceHistoryPageData | null = null;
  let loadError: string | null = null;

  try {
    const workspace = await getCostbookWorkspace(token);
    const loadedHistory: CostbookPriceHistoryPage | null = workspace.permissions.canManage ? await getCostbookPriceHistory(token, { limit: query.limit ? Number(query.limit) : undefined, materialCursor: query.materialCursor, estimateCursor: query.estimateCursor }) : null;
    data = {
      canManage: workspace.permissions.canManage,
      history: loadedHistory ? { materialChanges: loadedHistory.materialChanges.items, estimateSnapshots: loadedHistory.estimateSnapshots.items } : null,
      materialTotal: loadedHistory?.materialChanges.total ?? 0,
      materialNextCursor: loadedHistory?.materialChanges.nextCursor ?? null,
      estimateTotal: loadedHistory?.estimateSnapshots.total ?? 0,
      estimateNextCursor: loadedHistory?.estimateSnapshots.nextCursor ?? null,
    };
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Price history is unavailable.";
  }

  if (!data) {
    return <EmptyState title="Couldn't load price history" description={loadError ?? "Price history is unavailable."} />;
  }

  if (!data.canManage) {
    return <div className="flex flex-col gap-6">
      <PageHeader title="Price History" description="Historical Costbook price evidence." backHref="/costbook" backLabel="Costbook" />
      <EmptyState title="Manage access required" description="Material price audit history is restricted to Costbook managers." />
    </div>;
  }

  const history = data.history;
  if (!history) {
    return <EmptyState title="Couldn't load price history" description="Price history is unavailable." />;
  }

  const paginationOnlyProps = { showSearch: false, showSort: false, showOrder: false, showApply: false } as const;

  return <div className="flex flex-col gap-6">
    <PageHeader title="Price History" description="Review actual Material price changes separately from immutable Estimate pricing snapshots." backHref="/costbook" backLabel="Costbook" />
    <CatalogQueryControls pathname="/costbook/price-history" query={{ limit: query.limit, estimateCursor: query.estimateCursor }} total={data.materialTotal} shown={history.materialChanges.length} nextCursor={data.materialNextCursor} cursorParam="materialCursor" sortOptions={[]} {...paginationOnlyProps} />
    <section className="overflow-hidden rounded-lg border border-border/70 bg-card">
      <div className="border-b border-border/70 p-4"><h2 className="font-semibold">Material price changes</h2><p className="mt-1 text-sm text-muted-foreground">Audited Costbook mutations from manual edits and approved supplier proposals.</p></div>
      {history.materialChanges.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No audited Material price changes yet.</div> : <div className="divide-y divide-border/70">{history.materialChanges.map((row) => <div key={row.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-medium text-foreground">{row.materialName}</p><p className="text-xs text-muted-foreground">{row.source} · {new Date(row.createdAt).toLocaleString()}</p></div><div className="font-mono text-sm tabular-nums">{money(row.oldUnitCost)} → {money(row.newUnitCost)}</div></div>)}</div>}
    </section>
    <CatalogQueryControls pathname="/costbook/price-history" query={{ limit: query.limit, materialCursor: query.materialCursor }} total={data.estimateTotal} shown={history.estimateSnapshots.length} nextCursor={data.estimateNextCursor} cursorParam="estimateCursor" sortOptions={[]} {...paginationOnlyProps} />
    <section className="overflow-hidden rounded-lg border border-border/70 bg-card">
      <div className="border-b border-border/70 p-4"><h2 className="font-semibold">Estimate pricing snapshots</h2><p className="mt-1 text-sm text-muted-foreground">These are consumed historical prices, not Costbook price-change events. Later catalog edits do not rewrite them.</p></div>
      {history.estimateSnapshots.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No catalog-backed Estimate snapshots yet.</div> : <div className="divide-y divide-border/70">{history.estimateSnapshots.map((row) => <div key={row.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-medium text-foreground">{row.description}</p><p className="text-xs text-muted-foreground">{row.sourceType === "cost_item" ? "Cost Item" : "Assembly"} · Estimate {row.estimateId} · {new Date(row.createdAt).toLocaleString()}</p></div><div className="text-right font-mono text-sm tabular-nums"><div>{row.quantity} {row.unitOfMeasure} × {money(row.unitCost)}</div><div className="font-semibold">{money(row.lineCost)}</div></div></div>)}</div>}
    </section>
  </div>;
}

function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value); }
