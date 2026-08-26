import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getKnowledgeStats, getKnowledgeTrades } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export const metadata: Metadata = {
  title: "Knowledge Runtime Coverage | TradeOS",
  description: "Read-only coverage and source health for TradeOS estimating knowledge.",
};

export default async function KnowledgeCoveragePage() {
  const token = await getSessionToken();

  if (!token) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Knowledge Runtime Coverage" description="Read-only estimating knowledge coverage." backHref="/dashboard" backLabel="Dashboard" />
        <EmptyState title="Knowledge coverage is unavailable." description="Sign in again to inspect the estimating knowledge runtime." />
      </div>
    );
  }

  const [stats, trades] = await Promise.all([getKnowledgeStats(token).catch(() => null), getKnowledgeTrades(token).catch(() => null)]);

  if (!stats || !trades) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Knowledge Runtime Coverage"
          description="Read-only estimating knowledge coverage."
          backHref="/dashboard"
          backLabel="Dashboard"
        />
        <EmptyState
          title="Knowledge coverage is temporarily unavailable."
          description="The dashboard will not invent coverage numbers when the Knowledge Runtime cannot be read."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Knowledge Runtime Coverage"
        description="Live read-only coverage from the Knowledge Runtime used by estimating assistance."
        backHref="/dashboard"
        backLabel="Dashboard"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/70">
          <CardHeader className="pb-2">
            <CardDescription>Trades</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums">{stats.tradesCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/70">
          <CardHeader className="pb-2">
            <CardDescription>Assemblies</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums">{stats.assembliesCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/70">
          <CardHeader className="pb-2">
            <CardDescription>Cost items</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums">{stats.costItemsCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/70">
          <CardHeader className="pb-2">
            <CardDescription>Indexed keywords</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums">{stats.indexedKeywordCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Trade coverage</CardTitle>
          <CardDescription>Coverage metadata reported by the live read-only Knowledge Runtime.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {trades.map((trade) => (
            <article key={trade.id} className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-foreground">{trade.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{trade.notes || "No coverage note provided."}</p>
                </div>
                <span className="rounded-full border border-border/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">{trade.status}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span><strong className="font-medium text-foreground">{trade.itemCount}</strong> source items</span>
                <span>Coverage: {trade.coverage}</span>
              </div>
            </article>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Runtime health</CardTitle>
          <CardDescription>This surface is diagnostic and read-only; it does not execute AI or mutate estimates.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
          <div><span className="font-medium text-foreground">Schemas:</span> {stats.schemaCount}</div>
          <div><span className="font-medium text-foreground">Source files:</span> {stats.sourceFileCount}</div>
          <div><span className="font-medium text-foreground">Load warnings:</span> {stats.loadWarnings.length}</div>
          {stats.loadWarnings.length > 0 ? (
            <div className="sm:col-span-3 rounded-xl border border-border/60 bg-muted/20 p-4">
              <ul className="list-disc space-y-1 pl-5">
                {stats.loadWarnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
