"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientFetch } from "@/lib/clientApi";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Estimate } from "@/lib/api";
import { cn } from "@/lib/utils";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitOfMeasure: string;
  unitCost: number;
  lineCost: number;
}

interface EstimateDetail extends Estimate {
  lineItems: LineItem[];
}

interface PickerResult {
  id: string;
  name: string;
  code: string;
  unitOfMeasure: string;
  kind: "costItem" | "assembly";
}

export function EstimateBuilder({ projectId, estimateId }: { projectId: string; estimateId: string }) {
  const queryClient = useQueryClient();
  const estimateKey = ["estimate", estimateId];

  const { data: estimate, isLoading } = useQuery({
    queryKey: estimateKey,
    queryFn: () => clientFetch<EstimateDetail>(`/estimates/${estimateId}`),
    staleTime: 15_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: estimateKey });

  const removeLineItem = useMutation({
    mutationFn: (lineItemId: string) => clientFetch(`/estimates/${estimateId}/line-items/${lineItemId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const finalize = useMutation({
    mutationFn: () => clientFetch(`/estimates/${estimateId}/finalize`, { method: "POST" }),
    onSuccess: invalidate,
  });

  const runningTotals = useMemo(() => {
    if (!estimate) return null;
    const subtotalCost = estimate.subtotalCost;
    const totalPrice = estimate.totalPrice;
    const grossProfit = totalPrice - subtotalCost;
    const markupPct = subtotalCost > 0 ? (grossProfit / subtotalCost) * 100 : 0;
    const marginPct = totalPrice > 0 ? (grossProfit / totalPrice) * 100 : 0;

    return {
      subtotalCost,
      totalPrice,
      grossProfit,
      markupPct,
      marginPct,
      lineItemCount: estimate.lineItems.length,
    };
  }, [estimate]);

  if (isLoading || !estimate || !runningTotals) return <p className="text-sm text-muted-foreground">Loading estimate…</p>;

  const isDraft = estimate.status === "draft";
  const pricingModeLabel = estimate.targetMarginPct != null ? "Target margin" : "Markup";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Estimate v${estimate.version}`}
        description="Build the estimate quickly with keyboard-first line-item search, then tune pricing with live margin and markup feedback."
        backHref={`/projects/${projectId}`}
        backLabel="Back to project"
        action={
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Link href={`/projects/${projectId}/estimates/compare`} className={buttonVariants({ variant: "outline" })}>
              Compare versions
            </Link>
            <Link href={`/projects/${projectId}/estimates/${estimateId}/assist`} className={buttonVariants({ variant: "outline" })}>
              AI assist
            </Link>
            <StatusBadge status={estimate.status} />
          </div>
        }
      />

      <Card className="border-border/70 bg-muted/10">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Line items" value={runningTotals.lineItemCount.toString()} detail="Counted in the running total" />
          <MetricTile label="Job cost" value={formatCurrency(runningTotals.subtotalCost)} detail="Cost basis from line items" />
          <MetricTile label="Gross profit" value={formatCurrency(runningTotals.grossProfit)} detail="Before overhead" accent={runningTotals.grossProfit >= 0} />
          <MetricTile label="Total price" value={formatCurrency(runningTotals.totalPrice)} detail="Customer-facing price" highlight />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <div className="space-y-6">
          <Card className="border-border/70">
            <CardHeader className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Line items</CardTitle>
                  <CardDescription>Search assemblies first, then cost items. Use the keyboard to move faster.</CardDescription>
                </div>
                {isDraft && <Badge variant="outline">{estimate.lineItems.length} saved</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isDraft && <LineItemPicker estimateId={estimateId} onAdded={invalidate} />}

              {estimate.lineItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
                  No line items yet. Add an assembly or cost item to start the estimate.
                </div>
              ) : (
                <ul className="space-y-3">
                  {estimate.lineItems.map((li) => (
                    <li key={li.id} className="rounded-xl border border-border/70 bg-card px-4 py-3 shadow-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <div className="font-medium">{li.description}</div>
                          <div className="text-sm text-muted-foreground">
                            {li.quantity} {li.unitOfMeasure} × {formatCurrency(li.unitCost)} unit cost
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                          <span className="text-base font-semibold">{formatCurrency(li.lineCost)}</span>
                          {isDraft && (
                            <Button variant="ghost" size="sm" onClick={() => removeLineItem.mutate(li.id)} disabled={removeLineItem.isPending}>
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {isDraft && (
            <div className="flex justify-end">
              <Button onClick={() => finalize.mutate()} disabled={finalize.isPending || estimate.lineItems.length === 0}>
                {finalize.isPending ? "Finalizing…" : "Finalize estimate"}
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-6 xl:sticky xl:top-20 xl:self-start">
          <PricingPanel estimateId={estimateId} estimate={estimate} pricingModeLabel={pricingModeLabel} onUpdated={invalidate} />

          <Card className="border-border/70 bg-muted/10">
            <CardHeader>
              <CardTitle>Running totals</CardTitle>
              <CardDescription>Live pricing signals update as line items and pricing change.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <StatBlock label="Job cost" value={formatCurrency(runningTotals.subtotalCost)} />
                <StatBlock label="Gross profit" value={formatCurrency(runningTotals.grossProfit)} valueClassName={runningTotals.grossProfit >= 0 ? "text-foreground" : "text-destructive"} />
                <StatBlock label="Markup" value={formatPercent(runningTotals.markupPct)} />
                <StatBlock label="Margin" value={formatPercent(runningTotals.marginPct)} />
              </div>
              <div className="rounded-xl border border-border/70 bg-background/80 p-4">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <span>Total price</span>
                  <span>{pricingModeLabel}</span>
                </div>
                <div className="mt-2 text-3xl font-semibold">{formatCurrency(runningTotals.totalPrice)}</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {estimate.overheadPct}% overhead included · {formatPercent(runningTotals.marginPct)} gross margin
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Keyboard shortcuts</CardTitle>
              <CardDescription>Keep your hands on the keyboard when building the estimate.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <ShortcutRow keys="⌘ / Ctrl + K" label="Focus search" />
              <ShortcutRow keys="↑ / ↓" label="Move through search results" />
              <ShortcutRow keys="Enter" label="Add the highlighted item" />
              <ShortcutRow keys="Esc" label="Clear the current search" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function LineItemPicker({ estimateId, onAdded }: { estimateId: string; onAdded: () => void }) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selected, setSelected] = useState<PickerResult | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const { data: results } = useQuery({
    queryKey: ["item-search", debouncedQuery],
    queryFn: async (): Promise<PickerResult[]> => {
      if (!debouncedQuery) return [];
      const [costItems, assemblies] = await Promise.all([
        clientFetch<{ id: string; name: string; code: string; unitOfMeasure: string }[]>(
          `/cost-database/cost-items/search?q=${encodeURIComponent(debouncedQuery)}`
        ),
        clientFetch<{ id: string; name: string; code: string; unitOfMeasure: string }[]>(
          `/assemblies/search?q=${encodeURIComponent(debouncedQuery)}`
        ),
      ]);
      return [
        ...costItems.map((c) => ({ ...c, kind: "costItem" as const })),
        ...assemblies.map((a) => ({ ...a, kind: "assembly" as const })),
      ];
    },
    enabled: debouncedQuery.length > 0,
    staleTime: 5 * 60_000,
  });

  const orderedResults = useMemo(() => {
    const items = results ?? [];
    return [...items.filter((result) => result.kind === "assembly"), ...items.filter((result) => result.kind === "costItem")];
  }, [results]);

  const activeResultIndex = orderedResults.length === 0 ? 0 : Math.min(activeIndex, orderedResults.length - 1);
  const activeResult = orderedResults[activeResultIndex] ?? null;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isSearchShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isSearchShortcut) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const commitLineItem = (item?: PickerResult | null) => {
    const target = item ?? selected ?? activeResult;
    if (!target) {
      setError("Pick a result from the list first.");
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Quantity must be a positive number");
      return;
    }
    addLineItem.mutate({ item: target, quantity: qty });
  };

  const addLineItem = useMutation({
    mutationFn: ({ item, quantity }: { item: PickerResult; quantity: number }) => {
      return clientFetch(`/estimates/${estimateId}/line-items`, {
        method: "POST",
        body: JSON.stringify({
          [item.kind === "costItem" ? "costItemId" : "assemblyId"]: item.id,
          quantity,
        }),
      });
    },
    onSuccess: () => {
      setSelected(null);
      setQuery("");
      setQuantity("1");
      setError(null);
      setActiveIndex(0);
      quantityInputRef.current?.blur();
      searchInputRef.current?.focus();
      onAdded();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to add line item"),
  });

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/10 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Label htmlFor="item-search" className="text-sm font-medium">
          Add line item
        </Label>
        <div className="text-xs text-muted-foreground">Search assemblies first, then cost items</div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_auto] md:items-end">
        <div className="space-y-2">
          <Input
            ref={searchInputRef}
            id="item-search"
            autoFocus
            placeholder="Search assemblies or cost items…"
            value={selected ? selected.name : query}
            onChange={(e) => {
              setSelected(null);
              setQuery(e.target.value);
              setError(null);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                if (orderedResults.length === 0) return;
                const nextIndex = Math.min(activeResultIndex + 1, orderedResults.length - 1);
                setActiveIndex(nextIndex);
                setSelected(orderedResults[nextIndex] ?? null);
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                if (orderedResults.length === 0) return;
                const nextIndex = Math.max(activeResultIndex - 1, 0);
                setActiveIndex(nextIndex);
                setSelected(orderedResults[nextIndex] ?? null);
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                const target = selected ?? activeResult;
                if (!target) {
                  setError("Pick a result from the list first.");
                  return;
                }
                commitLineItem(target);
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setSelected(null);
                setQuery("");
                setError(null);
                setActiveIndex(0);
              }
            }}
          />
          <p className="text-xs text-muted-foreground">Tip: press ⌘/Ctrl+K anywhere on the page to jump back here.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quantity" className="text-sm font-medium">
            Quantity{selected ? ` (${selected.unitOfMeasure})` : ""}
          </Label>
          <Input
            ref={quantityInputRef}
            id="quantity"
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                const target = selected ?? activeResult;
                if (!target) {
                  setError("Pick a result from the list first.");
                  return;
                }
                commitLineItem(target);
              }
            }}
          />
        </div>

        <Button type="button" onClick={() => commitLineItem(selected ?? activeResult)} disabled={addLineItem.isPending || (!selected && !activeResult)}>
          {addLineItem.isPending ? "Adding…" : "Add"}
        </Button>
      </div>

      {!selected && orderedResults.length > 0 && (
        <div className="space-y-4">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Search results</div>
          <div className="max-h-72 space-y-4 overflow-auto pr-1">
            <ResultGroup
              title="Assemblies"
              description="Reusable packages and templates"
              results={orderedResults.filter((result) => result.kind === "assembly")}
              baseIndex={0}
              activeIndex={activeResultIndex}
              onSelect={(result, index) => {
                setSelected(result);
                setActiveIndex(index);
                setQuery(result.name);
                setError(null);
                quantityInputRef.current?.focus();
              }}
            />
            <ResultGroup
              title="Cost items"
              description="Individual labor or material items"
              results={orderedResults.filter((result) => result.kind === "costItem")}
              baseIndex={orderedResults.filter((result) => result.kind === "assembly").length}
              activeIndex={activeResultIndex}
              onSelect={(result, index) => {
                setSelected(result);
                setActiveIndex(index);
                setQuery(result.name);
                setError(null);
                quantityInputRef.current?.focus();
              }}
            />
          </div>
        </div>
      )}

      {!selected && debouncedQuery && orderedResults.length === 0 && !addLineItem.isPending && (
        <div className="rounded-lg border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
          No matches yet. Try a broader assembly name or a cost item code.
        </div>
      )}

      {selected && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-sm">
          <Badge variant={selected.kind === "assembly" ? "default" : "secondary"}>{selected.kind === "assembly" ? "Assembly" : "Cost item"}</Badge>
          <span className="font-medium">{selected.name}</span>
          <span className="text-muted-foreground">
            {selected.code} · {selected.unitOfMeasure}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelected(null);
              setQuery("");
              setError(null);
              searchInputRef.current?.focus();
            }}
          >
            Clear
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function PricingPanel({
  estimateId,
  estimate,
  pricingModeLabel,
  onUpdated,
}: {
  estimateId: string;
  estimate: Estimate;
  pricingModeLabel: string;
  onUpdated: () => void;
}) {
  const [mode, setMode] = useState<"markup" | "targetMargin">(estimate.targetMarginPct != null ? "targetMargin" : "markup");
  const [value, setValue] = useState(String(estimate.targetMarginPct ?? estimate.profitPct ?? 0));
  const [error, setError] = useState<string | null>(null);
  const grossProfit = estimate.totalPrice - estimate.subtotalCost;
  const currentMarkupPct = estimate.subtotalCost > 0 ? (grossProfit / estimate.subtotalCost) * 100 : 0;
  const currentMarginPct = estimate.totalPrice > 0 ? (grossProfit / estimate.totalPrice) * 100 : 0;

  const setPricingMode = useMutation({
    mutationFn: () => {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue) || numericValue < 0) throw new Error("Enter a valid percentage");
      return clientFetch(`/estimates/${estimateId}/pricing-mode`, {
        method: "POST",
        body: JSON.stringify({
          mode,
          markupPct: mode === "markup" ? numericValue : undefined,
          targetMarginPct: mode === "targetMargin" ? numericValue : undefined,
        }),
      });
    },
    onSuccess: () => {
      setError(null);
      onUpdated();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to update pricing"),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Profit / markup</CardTitle>
            <CardDescription>Switch between markup and target margin without changing the estimate math.</CardDescription>
          </div>
          <Badge variant="outline">{pricingModeLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant={mode === "markup" ? "default" : "outline"} onClick={() => setMode("markup")}>
            Markup %
          </Button>
          <Button type="button" variant={mode === "targetMargin" ? "default" : "outline"} onClick={() => setMode("targetMargin")}>
            Target margin %
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="pricing-value">Percentage</Label>
            <Input id="pricing-value" type="number" min="0" step="any" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <Button type="button" variant="outline" onClick={() => setPricingMode.mutate()} disabled={setPricingMode.isPending}>
            {setPricingMode.isPending ? "Applying…" : "Apply"}
          </Button>
        </div>
        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Current gross profit</span>
            <span className="font-medium">{formatCurrency(grossProfit)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Current margin</span>
            <span className="font-medium">{formatPercent(currentMarginPct)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Current markup</span>
            <span className="font-medium">{formatPercent(currentMarkupPct)}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          The saved estimate still uses the same backend pricing endpoints; this panel only makes the current setting easier to edit and understand.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

function MetricTile({
  label,
  value,
  detail,
  accent,
  highlight,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-background/80 p-3",
        highlight && "bg-primary/5",
        accent === false && "opacity-90"
      )}
    >
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className={cn("mt-2 text-2xl font-semibold tabular-nums", highlight && "text-primary")}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function StatBlock({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/80 p-3">
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className={cn("mt-2 text-lg font-semibold tabular-nums", valueClassName)}>{value}</div>
    </div>
  );
}

function ShortcutRow({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-background/80 px-3 py-2">
      <span className="font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{keys}</span>
    </div>
  );
}

function ResultGroup({
  title,
  description,
  results,
  baseIndex,
  activeIndex,
  onSelect,
}: {
  title: string;
  description: string;
  results: PickerResult[];
  baseIndex: number;
  activeIndex: number;
  onSelect: (result: PickerResult, index: number) => void;
}) {
  if (results.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
        <div className="text-xs text-muted-foreground">{results.length}</div>
      </div>
      <div className="space-y-2">
        {results.map((result, offset) => {
          const index = baseIndex + offset;
          const isActive = index === activeIndex;
          return (
            <button
              key={`${result.kind}-${result.id}`}
              type="button"
              className={cn(
                "flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-2 text-left transition",
                isActive ? "border-primary bg-primary/5 shadow-sm" : "border-border/70 bg-background hover:border-primary/40 hover:bg-muted/50"
              )}
              onClick={() => onSelect(result, index)}
            >
              <div className="space-y-1">
                <div className="font-medium">{result.name}</div>
                <div className="text-xs text-muted-foreground">
                  {result.code} · {result.unitOfMeasure}
                </div>
              </div>
              <Badge variant={result.kind === "assembly" ? "default" : "secondary"} className="shrink-0">
                {result.kind === "assembly" ? "Assembly" : "Cost item"}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}
