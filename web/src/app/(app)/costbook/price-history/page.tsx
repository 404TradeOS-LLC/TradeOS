import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getCostbookWorkspace } from "@/lib/api";
import { getCostbookPriceHistory } from "@/lib/costbook-api";
import { getSessionToken } from "@/lib/session";

export const metadata: Metadata = { title: "Price History | Costbook | TradeOS" };

export default async function CostbookPriceHistoryPage() {
  const token = await getSessionToken();
  if (!token) return <EmptyState title="Sign in required" description="You need an authenticated Costbook session." />;

  try {
    const workspace = await getCostbookWorkspace(token);
    if (!workspace.permissions.canManage) {
      return <div className="flex flex-col gap-6"><PageHeader title="Price History" description="Historical Costbook price evidence." backHref="/costbook" backLabel="Costbook" /><EmptyState title="Manage access required" description="Material price audit history is restricted to Costbook managers." /></div>;
    }
    const history = await getCostbookPriceHistory(token);
    return <div className="flex flex-col gap-6">
      <PageHeader title="Price History" description="Review actual Material price changes separately from immutable Estimate pricing snapshots." backHref="/costbook" backLabel="Costbook" />
      <section className="overflow-hidden rounded-lg border border-border/70 bg-surface">
        <div className="border-b border-border/70 p-4"><h2 className="font-semibold">Material price changes</h2><p className="mt-1 text-sm text-muted-foreground">Audited Costbook mutations from manual edits and approved supplier proposals.</p></div>
        {history.materialChanges.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No audited Material price changes yet.</div> : <div className="divide-y divide-border/70">{history.materialChanges.map((row) => <div key={row.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-medium text-foreground">{row.materialName}</p><p className="text-xs text-muted-foreground">{row.source} · {new Date(row.createdAt).toLocaleString()}</p></div><div className="font-mono text-sm tabular-nums">{money(row.oldUnitCost)} → {money(row.newUnitCost)}</div></div>)}</div>}
      </section>
      <section className="overflow-hidden rounded-lg border border-border/70 bg-surface">
        <div className="border-b border-border/70 p-4"><h2 className="font-semibold">Estimate pricing snapshots</h2><p className="mt-1 text-sm text-muted-foreground">These are consumed historical prices, not Costbook price-change events. Later catalog edits do not rewrite them.</p></div>
        {history.estimateSnapshots.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No catalog-backed Estimate snapshots yet.</div> : <div className="divide-y divide-border/70">{history.estimateSnapshots.map((row) => <div key={row.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-medium text-foreground">{row.description}</p><p className="text-xs text-muted-foreground">{row.sourceType === "cost_item" ? "Cost Item" : "Assembly"} · Estimate {row.estimateId} · {new Date(row.createdAt).toLocaleString()}</p></div><div className="text-right font-mono text-sm tabular-nums"><div>{row.quantity} {row.unitOfMeasure} × {money(row.unitCost)}</div><div className="font-semibold">{money(row.lineCost)}</div></div></div>)}</div>}
      </section>
    </div>;
  } catch (error) {
    return <EmptyState title="Couldn't load price history" description={error instanceof Error ? error.message : "Price history is unavailable."} />;
  }
}

function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value); }
