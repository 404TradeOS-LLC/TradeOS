"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientFetch } from "@/lib/clientApi";

type Preview = {
  jobCost: number;
  directOverhead: number;
  overheadPct: number;
  totalCost: number;
  sellPrice: number;
  grossProfit: number;
  markupPct: number;
  marginPct: number;
};

export function PricingPreviewCalculator() {
  const [jobCost, setJobCost] = useState("");
  const [directOverhead, setDirectOverhead] = useState("0");
  const [overheadPct, setOverheadPct] = useState("0");
  const [mode, setMode] = useState<"markup" | "targetMargin">("markup");
  const [profitPct, setProfitPct] = useState("20");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setPreview(await clientFetch<Preview>("/costbook/pricing/preview", {
        method: "POST",
        body: JSON.stringify({
          jobCost: Number(jobCost),
          directOverhead: Number(directOverhead || 0),
          overheadPct: Number(overheadPct || 0),
          mode,
          ...(mode === "markup" ? { markupPct: Number(profitPct) } : { targetMarginPct: Number(profitPct) }),
        }),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pricing preview could not be calculated.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
    <form onSubmit={submit} className="grid gap-4 rounded-lg border border-border/70 bg-surface p-5">
      <div><h2 className="font-semibold text-foreground">Pricing inputs</h2><p className="mt-1 text-sm text-muted-foreground">Preview only. This calculator does not save or change Costbook prices.</p></div>
      <label className="grid gap-1.5 text-sm font-medium"><span>Job cost</span><Input type="number" min="0" step="0.01" value={jobCost} onChange={(event) => setJobCost(event.target.value)} required disabled={loading} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium"><span>Direct overhead</span><Input type="number" min="0" step="0.01" value={directOverhead} onChange={(event) => setDirectOverhead(event.target.value)} disabled={loading} /></label>
        <label className="grid gap-1.5 text-sm font-medium"><span>Indirect overhead %</span><Input type="number" min="0" step="0.01" value={overheadPct} onChange={(event) => setOverheadPct(event.target.value)} disabled={loading} /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium"><span>Pricing mode</span><select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={mode} onChange={(event) => setMode(event.target.value as "markup" | "targetMargin")} disabled={loading}><option value="markup">Markup</option><option value="targetMargin">Target margin</option></select></label>
        <label className="grid gap-1.5 text-sm font-medium"><span>{mode === "markup" ? "Markup %" : "Target margin %"}</span><Input type="number" min="0" max={mode === "targetMargin" ? "99.99" : undefined} step="0.01" value={profitPct} onChange={(event) => setProfitPct(event.target.value)} required disabled={loading} /></label>
      </div>
      <Button type="submit" disabled={loading}><Calculator className="size-4" aria-hidden="true" />{loading ? "Calculating" : "Calculate preview"}</Button>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </form>

    <section className="rounded-lg border border-border/70 bg-surface p-5" aria-live="polite">
      <h2 className="font-semibold text-foreground">Preview</h2>
      {!preview ? <p className="mt-3 text-sm text-muted-foreground">Enter job cost and pricing mode to preview a sell price.</p> : <dl className="mt-4 grid gap-3">
        <Row label="Cost after overhead" value={money(preview.totalCost)} />
        <Row label="Sell price" value={money(preview.sellPrice)} strong />
        <Row label="Gross profit" value={money(preview.grossProfit)} />
        <Row label="Markup" value={`${preview.markupPct.toFixed(2)}%`} />
        <Row label="Margin" value={`${preview.marginPct.toFixed(2)}%`} />
      </dl>}
    </section>
  </div>;
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-3 last:border-0 last:pb-0"><dt className="text-sm text-muted-foreground">{label}</dt><dd className={strong ? "text-lg font-semibold tabular-nums" : "font-medium tabular-nums"}>{value}</dd></div>;
}
function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value); }
