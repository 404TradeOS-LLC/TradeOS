"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientFetch } from "@/lib/clientApi";
import { PageHeader } from "@/components/shared/page-header";
import { ContextualAthenaPanel } from "@/components/estimate-assist/contextual-athena-panel";
import { assessCostItemMapping, type StarterCatalogComponent, type StarterCatalogTemplate } from "@/components/costbook/assembly-catalog-model";
import type { CostItemCatalogRecord } from "@/components/costbook/cost-item-catalog-actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Estimate } from "@/lib/api";
import { cn } from "@/lib/utils";

interface LineItem {
  id: string;
  costItemId: string | null;
  assemblyId: string | null;
  description: string;
  quantity: number;
  unitOfMeasure: string;
  unitCost: number;
  lineCost: number;
  section: string;
  costType: "labor" | "material" | "equipment" | "disposal" | "subcontractor" | "other";
  taxable: boolean;
}

interface EstimateDetail extends Estimate {
  lineItems: LineItem[];
}

interface PickerResult {
  id: string;
  name: string;
  code: string;
  unitOfMeasure: string;
  kind: "costItem" | "assembly" | "starterAssembly";
  description?: string | null;
  starterTemplate?: StarterCatalogTemplate;
}

interface AssemblyPreviewData {
  unitCost: number;
  componentCount: number;
  items: Array<{
    id: string;
    componentName: string;
    componentCode: string;
    componentUnitOfMeasure: string;
    quantityPerUnit: number;
    componentType: "cost_item" | "assembly";
  }>;
  total: number;
}

export function EstimateBuilder({ projectId, projectName, estimateId, simpleScope }: { projectId: string; projectName: string; estimateId: string; simpleScope?: string | null }) {
  const queryClient = useQueryClient();
  const estimateKey = ["estimate", estimateId];
  const [mobileStage, setMobileStage] = useState<MobileEstimateStage>("scope");
  const [scopeDraft, setScopeDraft] = useState(simpleScope ?? "");
  const [persistedScope, setPersistedScope] = useState(simpleScope ?? "");

  const saveScope = useMutation({
    mutationFn: () =>
      clientFetch(`/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({ simpleScope: scopeDraft.trim() }),
      }),
    onSuccess: () => setPersistedScope(scopeDraft.trim()),
  });

  const { data: estimate, isLoading, isError, error } = useQuery({
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
    const costAfterOverhead = estimate.costAfterOverhead ?? subtotalCost * (1 + estimate.overheadPct / 100);
    const preTaxTotalPrice = estimate.preTaxTotalPrice ?? estimate.totalPrice - (estimate.taxAmount ?? 0);
    const totalPrice = estimate.totalPrice;
    const grossProfit = preTaxTotalPrice - costAfterOverhead;
    const markupPct = costAfterOverhead > 0 ? (grossProfit / costAfterOverhead) * 100 : 0;
    const marginPct = preTaxTotalPrice > 0 ? (grossProfit / preTaxTotalPrice) * 100 : 0;

    return {
      subtotalCost,
      costAfterOverhead,
      preTaxTotalPrice,
      totalPrice,
      taxAmount: estimate.taxAmount ?? 0,
      grossProfit,
      markupPct,
      marginPct,
      lineItemCount: estimate.lineItems.length,
    };
  }, [estimate]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading estimate…</p>;
  if (isError) return <p className="text-sm text-destructive">Unable to load this estimate. {error instanceof Error ? error.message : "Check your session and try again."}</p>;
  if (!estimate || !runningTotals) return <p className="text-sm text-muted-foreground">Estimate not found.</p>;

  const isDraft = estimate.status === "draft";
  const pricingModeLabel = estimate.targetMarginPct != null ? "Target margin" : "Markup";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Estimate v${estimate.version}`}
        description="Shape the scope, price the work, and send a clear proposal from one focused workspace."
        breadcrumbs={[
          { label: projectName, href: `/projects/${projectId}` },
          { label: `Estimate v${estimate.version}` },
        ]}
        action={
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Link href={`/projects/${projectId}/estimates/compare`} className={buttonVariants({ variant: "outline" })}>
              Compare versions
            </Link>
            <Link href={`/projects/${projectId}/estimates/${estimateId}/assist`} className={buttonVariants({ variant: "outline" })}>
              Athena review
            </Link>
            {isDraft ? (
              <span className={buttonVariants({ variant: "outline" })} aria-disabled="true">
                Finalize to create proposal
              </span>
            ) : (
              <Link href={`/projects/${projectId}/proposals/new?estimateId=${estimateId}`} className={buttonVariants({ variant: "outline" })}>
                Create proposal
              </Link>
            )}
            <StatusBadge status={estimate.status} />
          </div>
        }
      />

      <div className="hidden grid-cols-2 gap-x-5 gap-y-3 border-y border-border/70 bg-muted/20 px-3 py-3 sm:grid-cols-4 sm:px-4 lg:grid" aria-label="Estimate summary">
        <SummaryValue label="Job cost" value={formatCurrency(runningTotals.subtotalCost)} />
        <SummaryValue label="Sell price" value={formatCurrency(runningTotals.preTaxTotalPrice)} />
        <SummaryValue label="Gross profit" value={formatCurrency(runningTotals.grossProfit)} tone={runningTotals.grossProfit >= 0 ? "positive" : "negative"} />
        <SummaryValue label="Margin" value={formatPercent(runningTotals.marginPct)} tone={runningTotals.marginPct >= 0 ? "positive" : "negative"} />
      </div>

      <MobileEstimateFlow
        projectId={projectId}
        projectName={projectName}
        simpleScope={scopeDraft}
        onScopeChange={(value) => {
          saveScope.reset();
          setScopeDraft(value);
        }}
        onSaveScope={async () => {
          try {
            await saveScope.mutateAsync();
            return true;
          } catch {
            return false;
          }
        }}
        scopeDirty={scopeDraft.trim() !== persistedScope.trim()}
        scopeSavePending={saveScope.isPending}
        scopeSaveSuccess={saveScope.isSuccess}
        scopeSaveError={saveScope.isError ? (saveScope.error instanceof Error ? saveScope.error.message : "Unable to save scope.") : null}
        estimate={estimate}
        runningTotals={runningTotals}
        estimateId={estimateId}
        isDraft={isDraft}
        mobileStage={mobileStage}
        onStageChange={setMobileStage}
        onUpdated={invalidate}
        onRemoveLineItem={(lineItemId) => removeLineItem.mutate(lineItemId)}
        removeLineItemPending={removeLineItem.isPending}
        onFinalize={() => finalize.mutate()}
        finalizePending={finalize.isPending}
      />

      <div className="hidden gap-5 lg:grid xl:grid-cols-[minmax(0,1.8fr)_minmax(300px,0.8fr)]">
        <div className="space-y-5">
          <Card className="rounded-none border-x-0 border-border/70 bg-transparent shadow-none">
            <CardHeader className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Line items</CardTitle>
                  <CardDescription>Use Costbook items where useful, or add a custom labor/material/disposal line for one-off scope.</CardDescription>
                </div>
                {isDraft && <Badge variant="outline">{estimate.lineItems.length} saved</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-0 sm:px-0">
              {isDraft && <LineItemPicker estimateId={estimateId} onAdded={invalidate} />}

              {estimate.lineItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
                  No line items yet. Add an assembly or cost item to start the estimate.
                </div>
              ) : (
                <ul className="divide-y divide-border/70">
                  {groupLineItems(estimate.lineItems).map(([section, sectionItems]) => (
                    <li key={section} className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{section}</div>
                      <ul className="space-y-0">
                        {sectionItems.map((li) => (
                          <EditableLineItem key={li.id} estimateId={estimateId} lineItem={li} isDraft={isDraft} onUpdated={invalidate} onRemove={() => removeLineItem.mutate(li.id)} removing={removeLineItem.isPending} />
                        ))}
                      </ul>
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

        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <ContextualAthenaPanel
            estimateId={estimateId}
            projectId={projectId}
            scopeOfWork={scopeDraft}
            isDraft={isDraft}
            headingId="desktop-contextual-athena-heading"
            onAdded={invalidate}
          />
          <PricingPanel estimateId={estimateId} estimate={estimate} hasTaxableLineItems={estimate.lineItems.some((lineItem) => lineItem.taxable)} pricingModeLabel={pricingModeLabel} isDraft={isDraft} onUpdated={invalidate} />

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

type MobileEstimateStage = "scope" | "items" | "price" | "review";

function MobileEstimateFlow({
  projectId,
  projectName,
  simpleScope,
  onScopeChange,
  onSaveScope,
  scopeDirty,
  scopeSavePending,
  scopeSaveSuccess,
  scopeSaveError,
  estimate,
  runningTotals,
  estimateId,
  isDraft,
  mobileStage,
  onStageChange,
  onUpdated,
  onRemoveLineItem,
  removeLineItemPending,
  onFinalize,
  finalizePending,
}: {
  projectId: string;
  projectName: string;
  simpleScope: string;
  onScopeChange: (value: string) => void;
  onSaveScope: () => Promise<boolean>;
  scopeDirty: boolean;
  scopeSavePending: boolean;
  scopeSaveSuccess: boolean;
  scopeSaveError: string | null;
  estimate: EstimateDetail;
  runningTotals: { totalPrice: number; marginPct: number; lineItemCount: number };
  estimateId: string;
  isDraft: boolean;
  mobileStage: MobileEstimateStage;
  onStageChange: (stage: MobileEstimateStage) => void;
  onUpdated: () => void;
  onRemoveLineItem: (lineItemId: string) => void;
  removeLineItemPending: boolean;
  onFinalize: () => void;
  finalizePending: boolean;
}) {
  const stages: Array<{ id: MobileEstimateStage; label: string }> = [
    { id: "scope", label: "Scope" },
    { id: "items", label: "Items" },
    { id: "price", label: "Price" },
    { id: "review", label: "Review" },
  ];
  const stageIndex = stages.findIndex((stage) => stage.id === mobileStage);

  const goToStage = async (stage: MobileEstimateStage) => {
    if (stage === mobileStage || scopeSavePending) return;
    if (mobileStage === "scope" && isDraft && scopeDirty) {
      const saved = await onSaveScope();
      if (!saved) return;
    }
    onStageChange(stage);
  };

  const advance = () => {
    const next = stages[stageIndex + 1];
    if (next) void goToStage(next.id);
  };

  return (
    <section className="space-y-4 lg:hidden" aria-label="Mobile estimate workflow">
      <div className="grid grid-cols-4 border-b border-border/70" role="tablist" aria-label="Estimate stages">
        {stages.map((stage, index) => (
          <button
            key={stage.id}
            type="button"
            role="tab"
            aria-selected={mobileStage === stage.id}
            onClick={() => void goToStage(stage.id)}
            disabled={scopeSavePending && mobileStage === "scope" && stage.id !== "scope"}
            className={cn(
              "min-h-11 border-b-2 px-1 text-xs font-semibold transition-colors",
              mobileStage === stage.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            )}
          >
            <span className="mr-1 text-[10px] tabular-nums">{index + 1}</span>
            {stage.label}
          </button>
        ))}
      </div>

      {mobileStage === "scope" ? (
        <div className="space-y-4">
          <div className="space-y-3 border-b border-border/70 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Plain-language scope</p>
                <p className="mt-1 text-sm text-muted-foreground">Edit the Project scope here; Athena reviews the same saved scope.</p>
              </div>
              {scopeSaveSuccess && !scopeSavePending ? <span className="text-xs font-medium text-success">Saved</span> : null}
            </div>
            <Textarea
              value={simpleScope}
              onChange={(event) => onScopeChange(event.target.value)}
              rows={5}
              maxLength={5000}
              disabled={!isDraft || scopeSavePending}
              aria-label="Estimate scope"
              placeholder="Describe what you’re building or fixing…"
            />
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={() => void onSaveScope()} disabled={!isDraft || scopeSavePending || !simpleScope.trim()}>
                {scopeSavePending ? "Saving scope…" : "Save scope"}
              </Button>
              {!isDraft ? <span className="text-xs text-muted-foreground">Finalized estimates keep their pricing snapshot; duplicate the estimate to revise it.</span> : null}
            </div>
            {scopeSaveError ? <p className="text-sm text-destructive" role="alert">{scopeSaveError}</p> : null}
          </div>
          <ContextualAthenaPanel
            estimateId={estimateId}
            projectId={projectId}
            scopeOfWork={simpleScope}
            isDraft={isDraft}
            headingId="mobile-contextual-athena-heading"
            onAdded={onUpdated}
          />
          <div className="text-sm text-muted-foreground">
            Athena suggestions are review-first. Nothing is added automatically; open Athena review for deeper scope analysis.
          </div>
          <MobileStageAction label={scopeSavePending ? "Saving scope…" : "Continue to items"} onClick={advance} disabled={scopeSavePending} />
        </div>
      ) : null}

      {mobileStage === "items" ? (
        <div className="space-y-4">
          {isDraft ? <LineItemPicker estimateId={estimateId} onAdded={onUpdated} /> : null}
          {estimate.lineItems.length === 0 ? (
            <p className="border-b border-border/70 py-4 text-sm text-muted-foreground">No line items yet.</p>
          ) : (
            <ul className="divide-y divide-border/70">
              {estimate.lineItems.map((lineItem) => (
                <EditableLineItem
                  key={lineItem.id}
                  estimateId={estimateId}
                  lineItem={lineItem}
                  isDraft={isDraft}
                  onUpdated={onUpdated}
                  onRemove={() => onRemoveLineItem(lineItem.id)}
                  removing={removeLineItemPending}
                />
              ))}
            </ul>
          )}
          <MobileStageAction label="Continue to price" onClick={advance} />
        </div>
      ) : null}

      {mobileStage === "price" ? (
        <div className="space-y-4">
          <PricingPanel
            estimateId={estimateId}
            estimate={estimate}
            hasTaxableLineItems={estimate.lineItems.some((lineItem) => lineItem.taxable)}
            pricingModeLabel={estimate.targetMarginPct != null ? "Target margin" : "Markup"}
            isDraft={isDraft}
            onUpdated={onUpdated}
          />
          <MobileStageAction label="Continue to review" onClick={advance} />
        </div>
      ) : null}

      {mobileStage === "review" ? (
        <div className="space-y-5 pb-24">
          <div className="border-b border-border/70 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Customer-facing review</p>
                <h2 className="mt-2 text-xl font-semibold text-foreground">{projectName}</h2>
              </div>
              <StatusBadge status={estimate.status} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{simpleScope?.trim() || "Estimate scope"}</p>
          </div>
          <div className="space-y-3">
            {estimate.lineItems.map((lineItem) => (
              <div key={lineItem.id} className="flex items-start justify-between gap-4 border-b border-border/60 pb-3 text-sm">
                <span className="min-w-0">{lineItem.description} <span className="text-muted-foreground">× {lineItem.quantity}</span></span>
                <span className="shrink-0 font-mono font-semibold">{formatCurrency(lineItem.lineCost)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border py-4">
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium">Estimate total</span>
              <span className="text-2xl font-semibold tabular-nums text-primary">{formatCurrency(runningTotals.totalPrice)}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{formatPercent(runningTotals.marginPct)} gross margin · {runningTotals.lineItemCount} line items</p>
          </div>
          {isDraft ? (
            <>
              <p className="text-sm text-muted-foreground">Finalizing locks this reviewed estimate version. The next step is creating the customer proposal.</p>
              <MobileStageAction label={finalizePending ? "Finalizing…" : "Finalize estimate"} onClick={onFinalize} disabled={finalizePending || estimate.lineItems.length === 0} />
            </>
          ) : (
            <Link href={`/projects/${estimate.projectId}/proposals/new?estimateId=${estimateId}`} className={buttonVariants({ variant: "default" }) + " flex min-h-11 w-full items-center justify-center"}>
              Create proposal
            </Link>
          )}
        </div>
      ) : null}
    </section>
  );
}

function MobileStageAction({ label, onClick, disabled = false }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 border-t border-border/70 bg-background/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
      <Button type="button" className="min-h-11 w-full" onClick={onClick} disabled={disabled}>
        {label}
      </Button>
    </div>
  );
}


function LineItemPicker({ estimateId, onAdded }: { estimateId: string; onAdded: () => void }) {
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selected, setSelected] = useState<PickerResult | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [quantity, setQuantity] = useState("1");
  const [section, setSection] = useState("Demolition");
  const [costType, setCostType] = useState<LineItem["costType"] | "">("");
  const [taxable, setTaxable] = useState(false);
  const [custom, setCustom] = useState({ description: "", unitOfMeasure: "EA", unitCost: "", quantity: "1", section: "Reconstruction / Finish", costType: "labor" as LineItem["costType"], taxable: false });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const { data: searchData, isError: searchFailed, error: searchError } = useQuery({
    queryKey: ["item-search", debouncedQuery],
    queryFn: async (): Promise<{ items: PickerResult[]; failedSources: string[] }> => {
      if (!debouncedQuery) return { items: [], failedSources: [] };
      const [costItemsResult, assembliesResult, starterCatalogResult] = await Promise.allSettled([
        clientFetch<{ id: string; name: string; code: string; unitOfMeasure: string }[]>(
          `/cost-database/cost-items/search?q=${encodeURIComponent(debouncedQuery)}`
        ),
        clientFetch<Array<{ id: string; name: string; code: string; unitOfMeasure: string; description?: string | null }>>(
          `/assemblies/search?q=${encodeURIComponent(debouncedQuery)}`
        ),
        clientFetch<{
          items: StarterCatalogTemplate[];
        }>("/assemblies/starter-catalog"),
      ]);
      const costItems = costItemsResult.status === "fulfilled" ? costItemsResult.value : [];
      const assemblies = assembliesResult.status === "fulfilled" ? assembliesResult.value : [];
      const normalizedQuery = debouncedQuery.trim().toLowerCase();
      const installedCodes = new Set(assemblies.map((assembly) => assembly.code));
      const starterAssemblies = starterCatalogResult.status === "fulfilled"
        ? starterCatalogResult.value.items
            .filter((template) => !installedCodes.has(template.code))
            .filter((template) =>
              [template.name, template.code, template.trade, template.description]
                .some((value) => value.toLowerCase().includes(normalizedQuery))
            )
            .slice(0, 12)
        : [];
      const items: PickerResult[] = [
        ...assemblies.map((assembly) => ({ ...assembly, kind: "assembly" as const })),
        ...starterAssemblies.map((template) => ({
          id: template.id,
          name: template.name,
          code: template.code,
          unitOfMeasure: template.unitOfMeasure,
          description: template.description,
          kind: "starterAssembly" as const,
          starterTemplate: template,
        })),
        ...costItems.map((costItem) => ({ ...costItem, kind: "costItem" as const })),
      ];
      if (
        items.length === 0 &&
        costItemsResult.status === "rejected" &&
        assembliesResult.status === "rejected" &&
        starterCatalogResult.status === "rejected"
      ) {
        throw new Error("Costbook search is unavailable. You can still add a custom line item.");
      }
      return {
        items,
        failedSources: [
          costItemsResult.status === "rejected" ? "cost items" : "",
          assembliesResult.status === "rejected" ? "assemblies" : "",
          starterCatalogResult.status === "rejected" ? "starter catalog" : "",
        ].filter(Boolean),
      };
    },
    enabled: debouncedQuery.length > 0,
    staleTime: 5 * 60_000,
  });

  const orderedResults = useMemo(() => {
    const items = searchData?.items ?? [];
    return [
      ...items.filter((result) => result.kind === "assembly"),
      ...items.filter((result) => result.kind === "starterAssembly"),
      ...items.filter((result) => result.kind === "costItem"),
    ];
  }, [searchData]);

  const activeResultIndex = orderedResults.length === 0 ? 0 : Math.min(activeIndex, orderedResults.length - 1);
  const activeResult = orderedResults[activeResultIndex] ?? null;
  const selectedAssemblyId = selected?.kind === "assembly" ? selected.id : null;

  const {
    data: assemblyPreview,
    isLoading: assemblyPreviewLoading,
    isError: assemblyPreviewFailed,
    error: assemblyPreviewError,
  } = useQuery({
    queryKey: ["assembly-preview", selectedAssemblyId],
    queryFn: async (): Promise<AssemblyPreviewData> => {
      if (!selectedAssemblyId) throw new Error("Select an installed assembly first.");
      const [cost, components] = await Promise.all([
        clientFetch<{ unitCost: number; componentCount: number }>(`/assemblies/${selectedAssemblyId}/unit-cost`),
        clientFetch<{
          items: AssemblyPreviewData["items"];
          total: number;
          nextCursor?: string | null;
        }>(`/assemblies/${selectedAssemblyId}/items?limit=6&sort=sortOrder&order=asc`),
      ]);
      return {
        unitCost: cost.unitCost,
        componentCount: cost.componentCount,
        items: components.items,
        total: components.total,
      };
    },
    enabled: Boolean(selectedAssemblyId),
    staleTime: 60_000,
  });

  // Real-time validity for inline feedback - errors show only once a field
  // has a value (never on the untouched "1" default), rather than only
  // surfacing on submit.
  const quantityInvalid = quantity !== "" && (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0);
  const customQuantityInvalid = custom.quantity !== "" && (!Number.isFinite(Number(custom.quantity)) || Number(custom.quantity) <= 0);
  const customUnitCostInvalid = custom.unitCost !== "" && (!Number.isFinite(Number(custom.unitCost)) || Number(custom.unitCost) < 0);

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
    if (target.kind === "starterAssembly") {
      setError("Setup required. Map this starter recipe to your active Costbook items before it can be priced or added.");
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Quantity must be a positive number");
      return;
    }
    addLineItem.mutate({ item: target, quantity: qty, section, costType: costType || undefined, taxable, sourceKey: `builder:${crypto.randomUUID()}` });
  };

  const addLineItem = useMutation({
    mutationFn: ({ item, quantity, section: itemSection, costType: itemCostType, taxable: itemTaxable, sourceKey }: { item: PickerResult; quantity: number; section: string; costType?: LineItem["costType"]; taxable: boolean; sourceKey: string }) => {
      if (item.kind === "starterAssembly") throw new Error("Starter assemblies must be mapped before they can be added.");
      return clientFetch(`/estimates/${estimateId}/line-items`, {
        method: "POST",
        body: JSON.stringify({
          [item.kind === "costItem" ? "costItemId" : "assemblyId"]: item.id,
          quantity,
          section: itemSection,
          ...(itemCostType ? { costType: itemCostType } : {}),
          taxable: itemTaxable,
          sourceKey,
        }),
      });
    },
    onSuccess: () => {
      setSelected(null);
      setQuery("");
      setQuantity("1");
      setSection("Demolition");
      setCostType("");
      setTaxable(false);
      setError(null);
      setActiveIndex(0);
      quantityInputRef.current?.blur();
      searchInputRef.current?.focus();
      onAdded();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to add line item"),
  });

  const customAdd = useMutation({
    mutationFn: (payload: { description: string; unitOfMeasure: string; quantity: number; unitCost: number; section: string; costType: LineItem["costType"]; taxable: boolean }) => clientFetch(`/estimates/${estimateId}/line-items`, { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      setCustom({ description: "", unitOfMeasure: "EA", unitCost: "", quantity: "1", section: "Reconstruction / Finish", costType: "labor", taxable: false });
      setError(null);
      onAdded();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to add custom line item"),
  });

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/10 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Label htmlFor="item-search" className="text-sm font-medium">
          Add line item
        </Label>
        <div className="text-xs text-muted-foreground">Search assemblies first, then cost items</div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_180px_auto] md:items-end">
        <div className="space-y-2">
          <Input
            ref={searchInputRef}
            id="item-search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={!selected && orderedResults.length > 0}
            aria-controls={!selected ? "item-search-results" : undefined}
            aria-activedescendant={!selected && activeResult ? `item-search-option-${activeResult.kind}-${activeResult.id}` : undefined}
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
          <Label htmlFor="costbook-section">Section</Label>
          <Input id="costbook-section" value={section} onChange={(e) => setSection(e.target.value)} />
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
            aria-invalid={quantityInvalid}
            aria-describedby={quantityInvalid ? "quantity-error" : undefined}
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
          {quantityInvalid ? (
            <p id="quantity-error" className="text-xs text-destructive">
              Quantity must be a positive number.
            </p>
          ) : null}
        </div>

        <Button
          type="button"
          onClick={() => commitLineItem(selected ?? activeResult)}
          disabled={addLineItem.isPending || (!selected && !activeResult) || (selected ?? activeResult)?.kind === "starterAssembly"}
        >
          {addLineItem.isPending ? "Adding…" : (selected ?? activeResult)?.kind === "starterAssembly" ? "Setup required" : "Add"}
        </Button>
      </div>

      <div className="grid gap-3 rounded-lg border border-border/70 bg-background/70 p-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <div className="sm:col-span-2 lg:col-span-2">
          <Label htmlFor="custom-description">Custom line item</Label>
          <Input id="custom-description" placeholder="e.g. debris handling" value={custom.description} onChange={(e) => setCustom({ ...custom, description: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="custom-quantity">Qty</Label>
          <Input
            id="custom-quantity"
            type="number"
            min="0"
            step="any"
            value={custom.quantity}
            aria-invalid={customQuantityInvalid}
            aria-describedby={customQuantityInvalid ? "custom-quantity-error" : undefined}
            onChange={(e) => setCustom({ ...custom, quantity: e.target.value })}
          />
          {customQuantityInvalid ? (
            <p id="custom-quantity-error" className="mt-1 text-xs text-destructive">
              Must be positive.
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="custom-unit-cost">Unit cost</Label>
          <Input
            id="custom-unit-cost"
            type="number"
            min="0"
            step="0.01"
            value={custom.unitCost}
            aria-invalid={customUnitCostInvalid}
            aria-describedby={customUnitCostInvalid ? "custom-unit-cost-error" : undefined}
            onChange={(e) => setCustom({ ...custom, unitCost: e.target.value })}
          />
          {customUnitCostInvalid ? (
            <p id="custom-unit-cost-error" className="mt-1 text-xs text-destructive">
              Can&apos;t be negative.
            </p>
          ) : null}
        </div>
        <Button type="button" variant="secondary" onClick={() => addCustomLineItem()} disabled={customAdd.isPending || customQuantityInvalid || customUnitCostInvalid}>
          {customAdd.isPending ? "Adding…" : "Add custom"}
        </Button>
        <div>
          <Label htmlFor="custom-unit">Unit</Label>
          <Input id="custom-unit" value={custom.unitOfMeasure} onChange={(e) => setCustom({ ...custom, unitOfMeasure: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="custom-section">Section</Label>
          <Input id="custom-section" value={custom.section} onChange={(e) => setCustom({ ...custom, section: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="custom-cost-type">Cost type</Label>
          <select id="custom-cost-type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={custom.costType} onChange={(e) => setCustom({ ...custom, costType: e.target.value as LineItem["costType"] })}>
            {costTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={custom.taxable} onChange={(e) => setCustom({ ...custom, taxable: e.target.checked })} /> Taxable</label>
      </div>

      <div className="grid gap-3 rounded-lg border border-border/70 bg-background/70 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <div>
          <Label htmlFor="costbook-cost-type">Costbook cost type</Label>
          <select id="costbook-cost-type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={costType} onChange={(e) => setCostType(e.target.value as LineItem["costType"] | "")}>
            <option value="">Auto-detect</option>
            {costTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={taxable} onChange={(e) => setTaxable(e.target.checked)} /> Costbook item is taxable</label>
        <p className="text-xs text-muted-foreground">These settings apply to the selected Costbook item.</p>
      </div>

      {!selected && orderedResults.length > 0 && (
        <div className="space-y-4">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Search results</div>
          <div id="item-search-results" role="listbox" aria-label="Costbook search results" className="max-h-72 space-y-4 overflow-auto pr-1">
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
              title="Starter assemblies"
              description="TradeOS starter recipes · setup required before estimating"
              results={orderedResults.filter((result) => result.kind === "starterAssembly")}
              baseIndex={orderedResults.filter((result) => result.kind === "assembly").length}
              activeIndex={activeResultIndex}
              onSelect={(result, index) => {
                setSelected(result);
                setActiveIndex(index);
                setQuery(result.name);
                setError(null);
              }}
            />
            <ResultGroup
              title="Cost items"
              description="Individual labor or material items"
              results={orderedResults.filter((result) => result.kind === "costItem")}
              baseIndex={
                orderedResults.filter((result) => result.kind === "assembly").length +
                orderedResults.filter((result) => result.kind === "starterAssembly").length
              }
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
          <p>{searchFailed ? searchError instanceof Error ? searchError.message : "Costbook search is unavailable." : "No matches yet. Try a broader assembly name or a cost item code."}</p>
          <p className="mt-2">You can add a custom line item below, or <Link href="/costbook/cost-items" className="font-medium text-foreground underline">add a Costbook item</Link> for reuse.</p>
        </div>
      )}

      {!selected && searchData?.failedSources?.length ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning" role="alert">
          Search unavailable for {searchData.failedSources.join(" and ")}. Add a custom line item or try again.
        </p>
      ) : null}

      {selected && (
        <div className="space-y-3 rounded-lg border border-border/70 bg-background px-3 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={selected.kind === "assembly" ? "default" : selected.kind === "starterAssembly" ? "outline" : "secondary"}>
              {selected.kind === "assembly" ? "Installed assembly" : selected.kind === "starterAssembly" ? "Starter assembly" : "Cost item"}
            </Badge>
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

          {selected.kind === "assembly" ? (
            <div className="grid gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="space-y-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Assembly preview</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Current Costbook recipe. Estimate Engine captures the pricing snapshot and assembly source when you explicitly add it.
                  </p>
                </div>
                {assemblyPreviewLoading ? <p className="text-sm text-muted-foreground">Resolving current assembly cost…</p> : null}
                {assemblyPreviewFailed ? (
                  <p className="text-sm text-warning" role="alert">
                    Current cost preview is unavailable. {assemblyPreviewError instanceof Error ? assemblyPreviewError.message : "Try again before relying on this price."}
                  </p>
                ) : null}
                {assemblyPreview ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <span><strong className="font-medium">{formatCurrency(assemblyPreview.unitCost)}</strong> / {selected.unitOfMeasure} current cost</span>
                      <span className="text-muted-foreground">{assemblyPreview.componentCount} resolved component{assemblyPreview.componentCount === 1 ? "" : "s"}</span>
                    </div>
                    <div className="text-sm">
                      Estimated job cost for {Number(quantity) > 0 ? Number(quantity) : 0} {selected.unitOfMeasure}:{" "}
                      <strong className="font-medium">
                        {formatCurrency(assemblyPreview.unitCost * (Number(quantity) > 0 ? Number(quantity) : 0))}
                      </strong>
                    </div>
                    {assemblyPreview.items.length > 0 ? (
                      <div className="grid gap-1 text-xs text-muted-foreground">
                        {assemblyPreview.items.map((item) => (
                          <div key={item.id} className="flex items-start justify-between gap-3">
                            <span>{item.componentName} · {item.componentCode}</span>
                            <span className="shrink-0 font-mono">{item.quantityPerUnit} {item.componentUnitOfMeasure}</span>
                          </div>
                        ))}
                        {assemblyPreview.total > assemblyPreview.items.length ? (
                          <div>{assemblyPreview.total - assemblyPreview.items.length} more component{assemblyPreview.total - assemblyPreview.items.length === 1 ? "" : "s"} in the recipe</div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Provenance: organization Costbook assembly + live component pricing. Supplier/date citations are shown only when the underlying Costbook data provides them; none are invented here.
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Quantity</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{quantity || "0"} {selected.unitOfMeasure}</p>
              </div>
            </div>
          ) : null}

          {selected.kind === "starterAssembly" && selected.starterTemplate ? (
            <StarterAssemblySetup
              key={selected.id}
              template={selected.starterTemplate}
              quantity={quantity}
              onInstalled={(assembly) => {
                setSelected({ ...assembly, kind: "assembly" });
                setQuery(assembly.name);
                setError(null);
                void queryClient.invalidateQueries({ queryKey: ["item-search"] });
              }}
            />
          ) : null}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );

  function addCustomLineItem() {
    const qty = Number(custom.quantity);
    const unitCost = Number(custom.unitCost);
    if (!custom.description.trim() || !custom.unitOfMeasure.trim() || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
      setError("Custom lines need a description, unit, positive quantity, and non-negative unit cost.");
      return;
    }
    customAdd.mutate({ description: custom.description.trim(), unitOfMeasure: custom.unitOfMeasure.trim(), quantity: qty, unitCost, section: custom.section.trim() || "General", costType: custom.costType, taxable: custom.taxable });
  }

}

function StarterAssemblySetup({
  template,
  quantity,
  onInstalled,
}: {
  template: StarterCatalogTemplate;
  quantity: string;
  onInstalled: (assembly: { id: string; name: string; code: string; unitOfMeasure: string; description?: string | null }) => void;
}) {
  const [mappings, setMappings] = useState<Record<string, CostItemCatalogRecord>>({});
  const [error, setError] = useState<string | null>(null);
  const mappedIds = template.components.map((component) => mappings[component.key]?.id ?? "");
  const mappingComplete = mappedIds.every(Boolean);
  const duplicateMapping = mappingComplete && new Set(mappedIds).size !== mappedIds.length;
  const incompatibleComponent = template.components.find((component) => {
    const item = mappings[component.key];
    return item && !assessCostItemMapping(component, item).compatible;
  });

  const preview = useQuery({
    queryKey: ["starter-assembly-cost-preview", template.id, ...mappedIds],
    queryFn: async () => {
      const resolved = await Promise.all(template.components.map(async (component) => {
        const item = mappings[component.key];
        if (!item) throw new Error(`Map ${component.label} before previewing cost.`);
        const result = await clientFetch<{ totalUnitCost: number }>(`/costbook/cost-items/${item.id}/unit-cost`);
        return { component, item, unitCost: result.totalUnitCost };
      }));
      const unitCost = resolved.reduce((total, row) => total + row.unitCost * row.component.quantityPerUnit, 0);
      return { unitCost, resolved };
    },
    enabled: mappingComplete && !duplicateMapping && !incompatibleComponent,
    staleTime: 60_000,
  });

  const install = useMutation({
    mutationFn: async () => {
      if (!mappingComplete) throw new Error("Map every recipe slot before installing the assembly.");
      if (duplicateMapping) throw new Error("Use a different Costbook item for each recipe slot.");
      if (incompatibleComponent) throw new Error(`${incompatibleComponent.label} is mapped to an incompatible Costbook item.`);
      return clientFetch<{ id: string; name: string; code: string; unitOfMeasure: string; description?: string | null }>(
        "/assemblies/starter-catalog/install",
        {
          method: "POST",
          body: JSON.stringify({
            templateId: template.id,
            componentMappings: template.components.map((component) => ({
              componentKey: component.key,
              costItemId: mappings[component.key].id,
            })),
          }),
        }
      );
    },
    onSuccess: (assembly) => {
      setError(null);
      onInstalled(assembly);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Starter assembly could not be installed."),
  });

  const outputQuantity = Number(quantity) > 0 ? Number(quantity) : 0;

  return (
    <div className="space-y-4 rounded-lg border border-warning/40 bg-warning/10 p-3">
      <div>
        <p className="font-medium text-foreground">Setup required before this assembly can be priced or added.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Map each starter recipe slot to an active, compatible Costbook item. TradeOS will not invent those mappings or a price.
        </p>
      </div>

      <div className="grid gap-3">
        {template.components.map((component) => {
          const usedIds = new Set(Object.entries(mappings).filter(([key]) => key !== component.key).map(([, item]) => item.id));
          return (
            <StarterComponentMappingPicker
              key={component.key}
              component={component}
              value={mappings[component.key]}
              unavailableIds={usedIds}
              disabled={install.isPending}
              onSelect={(item) => {
                setMappings((current) => {
                  const next = { ...current };
                  if (item) next[component.key] = item;
                  else delete next[component.key];
                  return next;
                });
                setError(null);
              }}
            />
          );
        })}
      </div>

      <div className="grid gap-3 rounded-lg border border-border/70 bg-background/75 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pre-install cost preview</p>
          {!mappingComplete ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Map {template.components.length - mappedIds.filter(Boolean).length} more component{template.components.length - mappedIds.filter(Boolean).length === 1 ? "" : "s"} to resolve current Costbook cost.
            </p>
          ) : duplicateMapping ? (
            <p className="mt-1 text-sm text-warning">Each recipe slot must use a different Costbook item.</p>
          ) : incompatibleComponent ? (
            <p className="mt-1 text-sm text-warning">{incompatibleComponent.label} needs a compatible unit and cost type.</p>
          ) : preview.isLoading ? (
            <p className="mt-1 text-sm text-muted-foreground">Resolving mapped Costbook costs…</p>
          ) : preview.isError ? (
            <p className="mt-1 text-sm text-warning" role="alert">
              Cost preview unavailable. {preview.error instanceof Error ? preview.error.message : "Try again."}
            </p>
          ) : preview.data ? (
            <div className="mt-2 grid gap-1 text-sm">
              <span><strong className="font-medium">{formatCurrency(preview.data.unitCost)}</strong> / {template.unitOfMeasure}</span>
              <span className="text-muted-foreground">
                {outputQuantity} {template.unitOfMeasure} job cost · {formatCurrency(preview.data.unitCost * outputQuantity)}
              </span>
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          onClick={() => install.mutate()}
          disabled={install.isPending || !mappingComplete || duplicateMapping || Boolean(incompatibleComponent)}
        >
          {install.isPending ? "Installing…" : "Install assembly"}
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        <p>Measured by {template.measurementBasis.toLowerCase()}. {template.wasteGuidance}</p>
        <p className="mt-1">
          Provenance: {template.review.source}, reviewed {template.review.reviewedOn}. {template.review.regionalBasis}
        </p>
        <p className="mt-1">Installation creates the tenant assembly only. Review its resolved cost, then use the separate Add action to write the estimate line.</p>
      </div>
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}

function StarterComponentMappingPicker({
  component,
  value,
  unavailableIds,
  disabled,
  onSelect,
}: {
  component: StarterCatalogComponent;
  value?: CostItemCatalogRecord;
  unavailableIds: Set<string>;
  disabled: boolean;
  onSelect: (item: CostItemCatalogRecord | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const resultsId = useId();

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const search = useQuery({
    queryKey: ["starter-cost-item-search", component.key, debouncedQuery],
    queryFn: () => clientFetch<CostItemCatalogRecord[]>(`/costbook/cost-items/search?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: open,
    staleTime: 60_000,
  });

  const displayValue = editing ? query : value ? `${value.code} · ${value.name}` : "";
  const assessment = value ? assessCostItemMapping(component, value) : null;

  return (
    <div className="grid gap-2 rounded-lg border border-border/70 bg-background/75 p-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:items-start">
      <div>
        <p className="text-sm font-medium text-foreground">{component.label} · {component.quantityPerUnit}</p>
        <p className="mt-1 text-xs text-muted-foreground">{component.help}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Compatible: {component.compatibleUnits.join(", ")} · {component.allowedCostItemKinds.join(", ")}
        </p>
      </div>
      <div className="relative">
        <Input
          role="combobox"
          aria-label={`Map ${component.label}`}
          aria-expanded={open}
          aria-controls={resultsId}
          autoComplete="off"
          placeholder="Search active Costbook items…"
          value={displayValue}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onChange={(event) => {
            setEditing(true);
            setQuery(event.target.value);
            if (value) onSelect(null);
            setOpen(true);
          }}
        />
        {open && !disabled ? (
          <div id={resultsId} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full min-w-[280px] overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg">
            {search.isLoading ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">Searching Costbook…</p>
            ) : search.isError ? (
              <p className="px-3 py-2 text-xs text-destructive" role="alert">Cost Items could not be loaded.</p>
            ) : (search.data ?? []).length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">No active Cost Items found.</p>
            ) : (
              (search.data ?? []).map((item) => {
                const itemAssessment = assessCostItemMapping(component, item);
                const unavailable = unavailableIds.has(item.id);
                const selectable = !unavailable && itemAssessment.compatible;
                const detail = unavailable
                  ? "Already mapped to another slot"
                  : itemAssessment.compatible
                    ? `${item.unitOfMeasure} · ${itemAssessment.kind}`
                    : itemAssessment.reasons.join(" · ");
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={value?.id === item.id}
                    disabled={!selectable}
                    className="grid w-full gap-0.5 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onSelect(item);
                      setEditing(false);
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    <span className="font-medium text-foreground">{item.code} · {item.name}</span>
                    <span className="text-xs text-muted-foreground">{detail}</span>
                  </button>
                );
              })
            )}
          </div>
        ) : null}
        {assessment && !assessment.compatible ? <p className="mt-1 text-xs text-warning">{assessment.reasons.join(" · ")}</p> : null}
      </div>
    </div>
  );
}

const costTypes: LineItem["costType"][] = ["labor", "material", "equipment", "disposal", "subcontractor", "other"];

function groupLineItems(items: LineItem[]) {
  const grouped = new Map<string, LineItem[]>();
  for (const item of items) grouped.set(item.section || "General", [...(grouped.get(item.section || "General") ?? []), item]);
  return Array.from(grouped.entries());
}

function EditableLineItem({ estimateId, lineItem, isDraft, onUpdated, onRemove, removing }: { estimateId: string; lineItem: LineItem; isDraft: boolean; onUpdated: () => void; onRemove: () => void; removing: boolean }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ description: lineItem.description, quantity: String(lineItem.quantity), unitCost: String(lineItem.unitCost), unitOfMeasure: lineItem.unitOfMeasure, section: lineItem.section, costType: lineItem.costType, taxable: lineItem.taxable });
  const [error, setError] = useState<string | null>(null);
  const update = useMutation({
    mutationFn: () => {
      const quantity = Number(form.quantity);
      const unitCost = Number(form.unitCost);
      if (!form.description.trim() || !form.unitOfMeasure.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
        throw new Error("Description and unit are required; quantity must be positive and unit cost cannot be negative.");
      }
      return clientFetch(`/estimates/${estimateId}/line-items/${lineItem.id}`, { method: "PATCH", body: JSON.stringify({ ...form, quantity, unitCost }) });
    },
    onSuccess: () => { setError(null); setEditing(false); onUpdated(); },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to update line item"),
  });
  return <li className="border-b border-border/70 px-0 py-4 last:border-b-0">
    {editing && isDraft ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} aria-label="Description" />
      <Input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} aria-label="Section" />
      <Input type="number" min="0" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} aria-label="Quantity" />
      <Input type="number" min="0" step="0.01" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} aria-label="Unit cost" />
      <Input value={form.unitOfMeasure} onChange={(e) => setForm({ ...form, unitOfMeasure: e.target.value })} aria-label="Unit" />
      <select className="flex h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.costType} onChange={(e) => setForm({ ...form, costType: e.target.value as LineItem["costType"] })}>{costTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.taxable} onChange={(e) => setForm({ ...form, taxable: e.target.checked })} /> Taxable</label>
      <div className="flex gap-2"><Button size="sm" onClick={() => update.mutate()} disabled={update.isPending}>{update.isPending ? "Saving…" : "Save"}</Button><Button size="sm" variant="ghost" onClick={() => { setError(null); setEditing(false); }}>Cancel</Button></div>
      {error && <p className="sm:col-span-2 lg:col-span-4 text-sm text-destructive">{error}</p>}
    </div> : <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1"><div className="font-medium">{lineItem.description}</div><div className="flex flex-wrap gap-2 text-sm text-muted-foreground"><span>{lineItem.quantity} {lineItem.unitOfMeasure} × {formatCurrency(lineItem.unitCost)}</span><Badge variant="outline">{lineItem.costType}</Badge><Badge variant="outline">{lineItem.assemblyId ? "Assembly source" : lineItem.costItemId ? "Costbook source" : "Custom item"}</Badge>{lineItem.taxable && <Badge variant="secondary">taxable</Badge>}</div></div>
      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end"><span className="text-base font-semibold">{formatCurrency(lineItem.lineCost)}</span>{isDraft && <div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button><Button variant="ghost" size="sm" onClick={onRemove} disabled={removing}>Remove</Button></div>}</div>
    </div>}
  </li>;
}

function PricingPanel({
  estimateId,
  estimate,
  hasTaxableLineItems,
  pricingModeLabel,
  isDraft,
  onUpdated,
}: {
  estimateId: string;
  estimate: Estimate;
  hasTaxableLineItems: boolean;
  pricingModeLabel: string;
  isDraft: boolean;
  onUpdated: () => void;
}) {
  const [mode, setMode] = useState<"markup" | "targetMargin">(estimate.targetMarginPct != null ? "targetMargin" : "markup");
  const [value, setValue] = useState(String(estimate.targetMarginPct ?? estimate.profitPct ?? 0));
  const [overhead, setOverhead] = useState(String(estimate.overheadPct ?? 0));
  const [tax, setTax] = useState(String(estimate.taxPct ?? 0));
  const [error, setError] = useState<string | null>(null);
  const grossProfit = (estimate.preTaxTotalPrice ?? estimate.totalPrice - (estimate.taxAmount ?? 0)) - (estimate.costAfterOverhead ?? estimate.subtotalCost * (1 + estimate.overheadPct / 100));
  const costAfterOverhead = estimate.costAfterOverhead ?? estimate.subtotalCost * (1 + estimate.overheadPct / 100);
  const preTaxTotalPrice = estimate.preTaxTotalPrice ?? estimate.totalPrice - (estimate.taxAmount ?? 0);
  const currentMarkupPct = costAfterOverhead > 0 ? (grossProfit / costAfterOverhead) * 100 : 0;
  const currentMarginPct = preTaxTotalPrice > 0 ? (grossProfit / preTaxTotalPrice) * 100 : 0;

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

  const updateSettings = useMutation({
    mutationFn: () => {
      const overheadPct = Number(overhead);
      const taxPct = Number(tax);
      if (!Number.isFinite(overheadPct) || overheadPct < 0 || !Number.isFinite(taxPct) || taxPct < 0 || taxPct > 100) throw new Error("Enter valid overhead and tax percentages");
      return clientFetch(`/estimates/${estimateId}`, { method: "PATCH", body: JSON.stringify({ overheadPct, taxPct }) });
    },
    onSuccess: () => { setError(null); onUpdated(); },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to update estimate settings"),
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
        <p className="text-xs text-muted-foreground">
          {mode === "markup"
            ? (() => {
                const pct = Number(value) || 20;
                const cost = 100;
                const price = cost * (1 + pct / 100);
                return `$${cost} cost at ${pct}% markup = $${price.toFixed(2)} price.`;
              })()
            : (() => {
                const pct = Math.min(Number(value) || 20, 99);
                const cost = 100;
                const price = cost / (1 - pct / 100);
                return `$${cost} cost at ${pct}% target margin = $${price.toFixed(2)} price.`;
              })()}
        </p>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="pricing-value">Percentage</Label>
            <Input id="pricing-value" type="number" min="0" step="any" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setPricingMode.mutate()} disabled={!isDraft || setPricingMode.isPending}>
              {setPricingMode.isPending ? "Applying…" : "Apply"}
            </Button>
            {setPricingMode.isSuccess && !setPricingMode.isPending ? (
              <span className="text-xs text-success">Saved</span>
            ) : null}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="overhead-value">Overhead %</Label><Input id="overhead-value" type="number" min="0" step="any" value={overhead} onChange={(e) => setOverhead(e.target.value)} disabled={!isDraft} /></div>
          <div className="space-y-2"><Label htmlFor="tax-value">Tax %</Label><Input id="tax-value" type="number" min="0" max="100" step="any" value={tax} onChange={(e) => setTax(e.target.value)} disabled={!isDraft} /></div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => updateSettings.mutate()} disabled={!isDraft || updateSettings.isPending}>
            {updateSettings.isPending ? "Saving settings…" : "Save overhead / tax"}
          </Button>
          {updateSettings.isSuccess && !updateSettings.isPending ? <span className="text-xs text-success">Saved</span> : null}
        </div>
        {Number(tax) > 0 && !hasTaxableLineItems ? (
          <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning" role="alert">
            A tax rate is set, but no estimate line is marked taxable. Tax will calculate to $0.00 until you mark the applicable line items as taxable.
          </p>
        ) : null}
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
          Tax is allocated across taxable scope using the same estimate-wide pricing basis. Finalized estimates are read-only; duplicate the version from the project history to revise it.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

function SummaryValue({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 truncate text-base font-semibold tabular-nums", tone === "positive" && "text-success", tone === "negative" && "text-destructive")}>{value}</div>
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
              id={`item-search-option-${result.kind}-${result.id}`}
              role="option"
              aria-selected={isActive}
              type="button"
              className={cn(
                "flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-2 text-left outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50",
                isActive ? "border-primary bg-primary/5 shadow-(--elev-1)" : "border-border/70 bg-background hover:border-primary/40 hover:bg-muted/50"
              )}
              onClick={() => onSelect(result, index)}
            >
              <div className="space-y-1">
                <div className="font-medium">{result.name}</div>
                <div className="text-xs text-muted-foreground">
                  {result.code} · {result.unitOfMeasure}
                </div>
              </div>
              <Badge variant={result.kind === "assembly" ? "default" : result.kind === "starterAssembly" ? "outline" : "secondary"} className="shrink-0">
                {result.kind === "assembly" ? "Assembly" : result.kind === "starterAssembly" ? "Setup required" : "Cost item"}
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
