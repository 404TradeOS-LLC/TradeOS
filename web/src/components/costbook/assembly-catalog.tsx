"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { clientFetch } from "@/lib/clientApi";
import type { CostbookAssembly } from "@/lib/costbook-api";
import type { CostItemCatalogRecord } from "@/components/costbook/cost-item-catalog-actions";
import {
  assessCostItemMapping,
  buildStarterCatalogFacets,
  collectPagedCatalogItems,
  DEFAULT_STARTER_CATALOG_FILTERS,
  filterStarterCatalogTemplates,
  isStarterCatalogInstalled,
  mergeReuseMappingSuggestions,
  REUSE_SOURCE_PAGE_LIMIT,
  type MappingReuseResult,
  type StarterCatalogFilters,
  type StarterCatalogInstallation,
  type StarterCatalogComponent,
  type StarterCatalogCoverage,
  type StarterCatalogTemplate,
} from "@/components/costbook/assembly-catalog-model";

type AssemblyItem = {
  id: string;
  assemblyId: string;
  costItemId: string | null;
  childAssemblyId: string | null;
  quantityPerUnit: number;
  sortOrder: number;
  componentType: "cost_item" | "assembly";
  componentCode: string;
  componentName: string;
  componentUnitOfMeasure: string;
};

type AssemblyCost = { unitCost: number; componentCount: number };
type AssemblyItemsPage = { items: AssemblyItem[]; total: number; nextCursor: string | null };
type AssemblyForm = { code: string; name: string; unitOfMeasure: string; description: string; isTemplate: boolean };
type CostItemUnitCost = { totalUnitCost: number };
type CostPreview = { unitCost: number; loading: boolean; error: string | null };
const emptyAssembly: AssemblyForm = { code: "", name: "", unitOfMeasure: "", description: "", isTemplate: false };

export function AssemblyCatalog({ initialAssemblies, childAssemblies, costItems, canWrite, canManage }: {
  initialAssemblies: CostbookAssembly[];
  childAssemblies: CostbookAssembly[];
  costItems: CostItemCatalogRecord[];
  canWrite: boolean;
  canManage: boolean;
}) {
  const initialSelectedId = initialAssemblies.find((item) => item.isActive)?.id ?? "";
  const [assemblies, setAssemblies] = useState(initialAssemblies.filter((item) => item.isActive));
  const [availableChildAssemblies, setAvailableChildAssemblies] = useState(childAssemblies.filter((item) => item.isActive));
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const selectedIdRef = useRef(initialSelectedId);
  const queryClient = useQueryClient();
  // Selected-assembly detail reads ride TanStack Query (Fluid plan 2.3):
  // the first items page and the unit cost are cached 60 s so re-selecting
  // an assembly, or navigating away and back, does not re-fire both reads.
  // The items query never refetches on mount: "Load more" appends pages
  // into the cached page-1 payload via setQueryData, and a background
  // refetch would replace those appended pages with page 1 alone.
  // Mutations update the cache directly (see below) instead of
  // invalidating it, for the same reason.
  const itemsQuery = useQuery({
    queryKey: ["assembly-items", selectedId],
    queryFn: () => clientFetch<AssemblyItemsPage>(`/costbook/assemblies/${selectedId}/items?limit=100`),
    enabled: Boolean(selectedId),
    staleTime: 60_000,
    refetchOnMount: false,
  });
  const unitCostQuery = useQuery({
    queryKey: ["assembly-unit-cost", selectedId],
    queryFn: () => clientFetch<AssemblyCost>(`/costbook/assemblies/${selectedId}/unit-cost`),
    enabled: Boolean(selectedId),
    staleTime: 60_000,
  });
  const items = itemsQuery.data?.items ?? [];
  const itemsNextCursor = itemsQuery.data?.nextCursor ?? null;
  const itemsTotal = itemsQuery.data?.total ?? 0;
  const unitCost = unitCostQuery.data?.unitCost ?? null;
  const loadingItems = itemsQuery.isPending || unitCostQuery.isPending;
  const [loadingMore, setLoadingMore] = useState(false);
  // Query failures surface as the same detail-load error the old effect
  // used to set; mutation errors keep using the error state below.
  const detailsError = itemsQuery.isError || unitCostQuery.isError
    ? "Assembly details could not be loaded."
    : null;
  const [form, setForm] = useState<AssemblyForm>(emptyAssembly);
  const [componentType, setComponentType] = useState<"cost_item" | "assembly">("cost_item");
  const [componentId, setComponentId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // DEV-17 S9 repair: the starter catalog's reuse-source list is fetched
  // inside StarterAssemblyCatalog; bumping this key after an install or a
  // deactivation makes it refetch instead of showing a stale list until
  // the page reloads.
  const [reuseRefreshKey, setReuseRefreshKey] = useState(0);
  const selected = assemblies.find((item) => item.id === selectedId) ?? null;
  const childOptions = useMemo(() => availableChildAssemblies.filter((item) => item.id !== selectedId), [availableChildAssemblies, selectedId]);

  function selectAssembly(id: string) {
    selectedIdRef.current = id;
    setSelectedId(id);
    setError(null);
    // A "Load more" request for the previous assembly may still be in
    // flight: its completion guard skips clearing the flag once the
    // selection has moved, so reset it here — otherwise the pagination
    // button stays disabled for the newly selected assembly.
    setLoadingMore(false);
  }

  async function loadMoreComponents() {
    if (!selectedId || !itemsNextCursor) return;
    const requestAssemblyId = selectedId;
    const requestCursor = itemsNextCursor;
    setLoadingMore(true);
    setError(null);
    try {
      const next = await clientFetch<AssemblyItemsPage>(`/costbook/assemblies/${requestAssemblyId}/items?limit=100&cursor=${encodeURIComponent(requestCursor)}`);
      if (selectedIdRef.current !== requestAssemblyId) return;
      // Append the page into the cached page-1 payload so a later
      // remount reuses the merged list instead of refetching.
      queryClient.setQueryData<AssemblyItemsPage>(["assembly-items", requestAssemblyId], (current) =>
        current
          ? { ...current, items: [...current.items, ...next.items.filter((item) => !current.items.some((existing) => existing.id === item.id))], nextCursor: next.nextCursor }
          : current,
      );
    } catch (err) {
      if (selectedIdRef.current === requestAssemblyId) {
        setError(err instanceof Error ? err.message : "More assembly components could not be loaded.");
      }
    } finally {
      if (selectedIdRef.current === requestAssemblyId) setLoadingMore(false);
    }
  }

  async function createAssembly(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await clientFetch<CostbookAssembly>("/costbook/assemblies", {
        method: "POST",
        body: JSON.stringify({ ...form, description: form.description.trim() || undefined }),
      });
      setAssemblies((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setAvailableChildAssemblies((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      selectAssembly(created.id);
      setForm(emptyAssembly);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assembly could not be created.");
    } finally {
      setSaving(false);
    }
  }

  function updateAssemblyInList(updated: CostbookAssembly) {
    setAssemblies((current) => current.map((item) => item.id === updated.id ? updated : item).sort((a, b) => a.name.localeCompare(b.name)));
    setAvailableChildAssemblies((current) => current.map((item) => item.id === updated.id ? updated : item).sort((a, b) => a.name.localeCompare(b.name)));
  }

  // DEV-17 S10: saving pricing overrides changes the resolved unit cost on
  // the backend, so the displayed cost must be refetched after an edit save.
  // The proxy serves GET /costbook/assemblies/{id}/unit-cost with
  // `private, max-age=60`, and a TanStack invalidation cannot clear the
  // browser HTTP cache — the refetch would return the pre-save cost for
  // up to 60 s. Fetch with `cache: "no-store"` and write the result into
  // the query cache directly (the pattern refreshEstimateQuery in the
  // estimate builder uses for the same reason). A failed refresh leaves
  // the last known cost visible instead of clearing it.
  async function refreshSelectedUnitCost(requestAssemblyId: string) {
    await queryClient.cancelQueries({ queryKey: ["assembly-unit-cost", requestAssemblyId], exact: true });
    const fresh = await clientFetch<AssemblyCost>(`/costbook/assemblies/${requestAssemblyId}/unit-cost`, { cache: "no-store" });
    queryClient.setQueryData(["assembly-unit-cost", requestAssemblyId], fresh);
  }

  function handleAssemblyUpdated(updated: CostbookAssembly) {
    updateAssemblyInList(updated);
    void refreshSelectedUnitCost(updated.id).catch(() => undefined);
  }

  async function deactivateSelected() {
    if (!selected || !window.confirm(`Deactivate ${selected.name}? Existing estimate history will be preserved.`)) return;
    setSaving(true);
    setError(null);
    try {
      await clientFetch<void>(`/costbook/assemblies/${selected.id}`, { method: "DELETE" });
      const remaining = assemblies.filter((item) => item.id !== selected.id);
      setAssemblies(remaining);
      setAvailableChildAssemblies((current) => current.filter((item) => item.id !== selected.id));
      setReuseRefreshKey((current) => current + 1);
      selectAssembly(remaining[0]?.id ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assembly could not be deactivated.");
    } finally {
      setSaving(false);
    }
  }

  async function addComponent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId || !componentId) return;
    const requestAssemblyId = selectedId;
    setSaving(true);
    setError(null);
    try {
      const created = await clientFetch<AssemblyItem>(`/costbook/assemblies/${requestAssemblyId}/items`, {
        method: "POST",
        body: JSON.stringify({
          ...(componentType === "cost_item" ? { costItemId: componentId } : { childAssemblyId: componentId }),
          quantityPerUnit: Number(quantity),
        }),
      });
      if (selectedIdRef.current !== requestAssemblyId) return;
      // Insert the created row into the cached page (or refetch the page
      // when nothing is cached yet — e.g. the add landed before the first
      // page loaded) and invalidate the unit cost so it refetches.
      if (queryClient.getQueryData<AssemblyItemsPage>(["assembly-items", requestAssemblyId])) {
        queryClient.setQueryData<AssemblyItemsPage>(["assembly-items", requestAssemblyId], (current) =>
          current
            ? { ...current, items: [...current.items, created].sort((a, b) => a.sortOrder - b.sortOrder || a.componentName.localeCompare(b.componentName)), total: current.total + 1 }
            : current,
        );
      } else {
        void queryClient.invalidateQueries({ queryKey: ["assembly-items", requestAssemblyId] });
      }
      setComponentId("");
      setQuantity("1");
      void refreshSelectedUnitCost(requestAssemblyId).catch(() => undefined);
    } catch (err) {
      if (selectedIdRef.current === requestAssemblyId) setError(err instanceof Error ? err.message : "Assembly component could not be added.");
    } finally {
      setSaving(false);
    }
  }

  async function removeComponent(id: string) {
    if (!selectedId) return;
    const requestAssemblyId = selectedId;
    setSaving(true);
    setError(null);
    try {
      await clientFetch<void>(`/costbook/assemblies/${requestAssemblyId}/items/${id}`, { method: "DELETE" });
      if (selectedIdRef.current !== requestAssemblyId) return;
      // Remove the row from the cached page (or refetch the page when
      // nothing is cached yet) and invalidate the unit cost.
      if (queryClient.getQueryData<AssemblyItemsPage>(["assembly-items", requestAssemblyId])) {
        queryClient.setQueryData<AssemblyItemsPage>(["assembly-items", requestAssemblyId], (current) =>
          current
            ? { ...current, items: current.items.filter((item) => item.id !== id), total: Math.max(0, current.total - 1) }
            : current,
        );
      } else {
        void queryClient.invalidateQueries({ queryKey: ["assembly-items", requestAssemblyId] });
      }
      void refreshSelectedUnitCost(requestAssemblyId).catch(() => undefined);
    } catch (err) {
      if (selectedIdRef.current === requestAssemblyId) setError(err instanceof Error ? err.message : "Assembly component could not be removed.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="grid gap-6">
    <StarterAssemblyCatalog
      costItems={costItems}
      canWrite={canWrite}
      installedCodes={new Set(availableChildAssemblies.map((assembly) => assembly.code.trim().toUpperCase()))}
      reuseRefreshKey={reuseRefreshKey}
      saving={saving}
      onSaving={setSaving}
      onError={setError}
      onInstalled={(created) => {
        setAssemblies((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
        setAvailableChildAssemblies((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
        setReuseRefreshKey((current) => current + 1);
        selectAssembly(created.id);
      }}
    />
    <div className="grid gap-6 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,2fr)]">
    <aside className="grid content-start gap-4">
      {canWrite ? <form onSubmit={createAssembly} className="grid gap-3 rounded-lg border border-border/70 bg-card p-4">
        <div><h2 className="font-semibold text-foreground">New Assembly</h2><p className="mt-1 text-sm text-muted-foreground">Create a reusable Costbook composition.</p></div>
        <Input placeholder="Code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required disabled={saving} />
        <Input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required disabled={saving} />
        <Input placeholder="Unit (EA, SF...)" value={form.unitOfMeasure} onChange={(event) => setForm({ ...form, unitOfMeasure: event.target.value })} required disabled={saving} />
        <Input placeholder="Description (optional)" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} disabled={saving} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isTemplate} onChange={(event) => setForm({ ...form, isTemplate: event.target.checked })} disabled={saving} />Reusable template</label>
        <Button type="submit" disabled={saving}><Plus className="size-4" aria-hidden="true" />{saving ? "Saving" : "Create Assembly"}</Button>
      </form> : <div className="rounded-lg border border-border/70 bg-card p-4 text-sm text-muted-foreground">{canManage ? "You can manage assembly lifecycle, but create and edit controls are hidden for this role." : "Read-only Costbook access. Assembly mutations are hidden."}</div>}

      <div className="overflow-hidden rounded-lg border border-border/70 bg-card">
        <div className="border-b border-border/70 px-4 py-3"><h2 className="font-semibold">Assemblies</h2></div>
        {assemblies.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No active assemblies.</div> : <div className="divide-y divide-border/70">{assemblies.map((assembly) => <button key={assembly.id} type="button" onClick={() => selectAssembly(assembly.id)} className={`w-full px-4 py-3 text-left text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 ${assembly.id === selectedId ? "bg-muted" : "hover:bg-muted/50"}`}><span className="block font-medium text-foreground">{assembly.name}</span><span className="font-mono text-xs text-muted-foreground">{assembly.code} · {assembly.unitOfMeasure}{assembly.isTemplate ? " · Template" : ""}</span></button>)}</div>}
      </div>
    </aside>

    <section className="grid content-start gap-4">
      {error ?? detailsError ? <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error ?? detailsError}</p> : null}
      {!selected ? <EmptyState title="Choose an assembly" description="Select an assembly to review its composition." /> : <>
        <div className="grid gap-4 rounded-lg border border-border/70 bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="font-mono text-xs text-muted-foreground">{selected.code}</p><h1 className="text-xl font-semibold text-foreground">{selected.name}</h1><p className="mt-1 text-sm text-muted-foreground">{selected.description || "No description"} · {selected.unitOfMeasure}</p><p className="mt-2 text-sm font-medium text-foreground">Current unit cost: {unitCost === null ? "—" : money(unitCost)}</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={"/costbook/assemblies/" + selected.id}
                className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Open detail
              </Link>
              {canManage ? <Button type="button" variant="outline" size="sm" onClick={deactivateSelected} disabled={saving}><Trash2 className="size-4" aria-hidden="true" />Deactivate</Button> : null}
            </div>
          </div>
          {canWrite ? <AssemblyEditForm key={selected.id} assembly={selected} saving={saving} onSaving={setSaving} onError={setError} onUpdated={handleAssemblyUpdated} /> : null}
        </div>

        {canWrite ? <form onSubmit={addComponent} className="grid gap-3 rounded-lg border border-border/70 bg-card p-4 md:grid-cols-[160px_1fr_120px_auto] md:items-end">
          <label className="grid gap-1.5 text-sm font-medium"><span>Type</span><select className="h-9 rounded-md border border-input bg-background px-3" value={componentType} onChange={(event) => { setComponentType(event.target.value as "cost_item" | "assembly"); setComponentId(""); }} disabled={saving}><option value="cost_item">Cost item</option><option value="assembly">Assembly</option></select></label>
          <div className="grid gap-1.5 text-sm font-medium"><span>Component</span>{componentType === "cost_item" ? <CostItemSearchPicker initialOptions={costItems} valueId={componentId} onSelect={(item) => setComponentId(item?.id ?? "")} disabled={saving} /> : <select className="h-9 rounded-md border border-input bg-background px-3" value={componentId} onChange={(event) => setComponentId(event.target.value)} required disabled={saving}><option value="">Select</option>{childOptions.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select>}</div>
          <label className="grid gap-1.5 text-sm font-medium"><span>Qty / unit</span><Input type="number" min="0.0001" step="0.0001" value={quantity} onChange={(event) => setQuantity(event.target.value)} required disabled={saving} /></label>
          <Button type="submit" disabled={saving || !componentId}><Plus className="size-4" aria-hidden="true" />Add</Button>
        </form> : null}

        {loadingItems && items.length === 0 ? <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-card p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Loading components…</div> : items.length === 0 ? <EmptyState title="No components yet" description={canWrite ? "Add active CostItems or child Assemblies to build this composition." : "This assembly does not have any components."} /> : <div className="overflow-hidden rounded-lg border border-border/70 bg-card"><div className="border-b border-border/70 px-4 py-3 text-sm text-muted-foreground">Showing {items.length} of {itemsTotal} components</div><div className="divide-y divide-border/70">{items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 p-4"><div><p className="font-medium text-foreground">{item.componentName}</p><p className="font-mono text-xs text-muted-foreground">{item.componentCode} · {item.componentType === "cost_item" ? "Cost item" : "Assembly"} · {item.quantityPerUnit} {item.componentUnitOfMeasure}</p></div>{canWrite ? <Button type="button" variant="ghost" size="sm" onClick={() => removeComponent(item.id)} disabled={saving}><Trash2 className="size-4" aria-hidden="true" />Remove</Button> : null}</div>)}</div>{itemsNextCursor ? <div className="border-t border-border/70 p-3"><Button type="button" variant="outline" size="sm" onClick={loadMoreComponents} disabled={loadingMore}>{loadingMore ? "Loading" : "Load more components"}</Button></div> : null}</div>}
      </>}
    </section>
    </div>
  </div>;
}

function StarterAssemblyCatalog({ costItems, canWrite, installedCodes, reuseRefreshKey, saving, onSaving, onError, onInstalled }: {
  costItems: CostItemCatalogRecord[];
  canWrite: boolean;
  installedCodes: Set<string>;
  reuseRefreshKey: number;
  saving: boolean;
  onSaving: (value: boolean) => void;
  onError: (value: string | null) => void;
  onInstalled: (assembly: CostbookAssembly) => void;
}) {
  // Starter-catalog reads ride TanStack Query (Fluid plan 2.3) with the
  // builder's 5-minute staleTime: the template list, the reuse-source
  // list, and the per-item unit-cost preview are cached across mounts
  // instead of refetching on every mount. The preview key is distinct
  // from the builder's ["starter-assembly-cost-preview", ...] key because
  // the payload shape differs (a per-item record here, a resolved total
  // there) — sharing the key would serve one component's shape to the
  // other.
  const starterCatalogQuery = useQuery({
    queryKey: ["starter-catalog"],
    queryFn: () =>
      clientFetch<{ catalogVersion: string; coverage: StarterCatalogCoverage[]; items: StarterCatalogTemplate[] }>("/costbook/assemblies/starter-catalog"),
    staleTime: 5 * 60_000,
  });
  const templates = useMemo(() => starterCatalogQuery.data?.items ?? [], [starterCatalogQuery.data]);
  const catalogVersion = starterCatalogQuery.data?.catalogVersion ?? "";
  const coverage = useMemo(() => starterCatalogQuery.data?.coverage ?? [], [starterCatalogQuery.data]);
  const loading = starterCatalogQuery.isPending;
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  // Select the first recipe once the catalog first loads, as the old
  // fetch effect did. The ref keeps a later explicit clear (filter reset
  // or template change) from re-selecting it.
  const initialSelectionAppliedRef = useRef(false);
  useEffect(() => {
    if (initialSelectionAppliedRef.current || !starterCatalogQuery.data) return;
    initialSelectionAppliedRef.current = true;
    setSelectedTemplateId(starterCatalogQuery.data.items[0]?.id ?? "");
  }, [starterCatalogQuery.data]);
  useEffect(() => {
    if (starterCatalogQuery.isError) onError("Starter assembly catalog could not be loaded.");
  }, [starterCatalogQuery.isError, onError]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [mappingItems, setMappingItems] = useState<Record<string, CostItemCatalogRecord>>({});
  const [filters, setFilters] = useState<StarterCatalogFilters>({ ...DEFAULT_STARTER_CATALOG_FILTERS });
  const [previewQuantity, setPreviewQuantity] = useState("1");
  // DEV-17 S10 install overrides: blank = recipe/mapped-item defaults.
  const [wasteOverridePct, setWasteOverridePct] = useState("");
  const [productionRateFactor, setProductionRateFactor] = useState("");
  // DEV-17 S9: reuse a previous install's mapping for this template.
  // A reuse suggestion belongs to one template: every site that changes
  // the selection (template button, updateFilter, resetFilters) clears
  // the reuse source choice, note, and error alongside the mappings.
  // DEV-17 S9 repair: follow every page cursor so the selector sees all
  // active template assemblies, not just the first 100. Refreshed on mount
  // and whenever the parent reports an install or deactivation
  // (reuseRefreshKey), so a newly installed recipe is reusable in the
  // same session and a deactivated source drops out.
  const reuseSourcesQuery = useQuery({
    queryKey: ["starter-reuse-sources", reuseRefreshKey],
    queryFn: () =>
      collectPagedCatalogItems<CostbookAssembly>((cursor) =>
        clientFetch<{ items: CostbookAssembly[]; total: number; nextCursor: string | null }>(
          `/costbook/assemblies?isTemplate=true&active=true&limit=${REUSE_SOURCE_PAGE_LIMIT}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        ),
      ),
    staleTime: 5 * 60_000,
  });
  const reuseSources = reuseSourcesQuery.data ?? [];
  const [reuseSourceId, setReuseSourceId] = useState("");
  const [reuseNote, setReuseNote] = useState<string | null>(null);
  const [reuseError, setReuseError] = useState<string | null>(null);
  const [reuseLoading, setReuseLoading] = useState(false);
  // DEV-17 S9 repair: these refs mirror the latest committed mapping state
  // so a reuse response merges against the state at apply time, not the
  // copies captured when the request started. The sequence number
  // invalidates responses from a superseded selection — every handler that
  // changes the selection bumps it (see invalidateReuseRequest).
  const mappingsRef = useRef(mappings);
  const mappingItemsRef = useRef(mappingItems);
  const reuseRequestSeqRef = useRef(0);
  useEffect(() => { mappingsRef.current = mappings; }, [mappings]);
  useEffect(() => { mappingItemsRef.current = mappingItems; }, [mappingItems]);

  function invalidateReuseRequest() {
    reuseRequestSeqRef.current += 1;
    // The superseded request's finally block deliberately skips clearing
    // reuseLoading (it only clears when its own sequence is current), so
    // invalidation must clear it here — otherwise the reuse selector and
    // Apply button stay disabled until reload.
    setReuseLoading(false);
  }
  const facets = useMemo(() => buildStarterCatalogFacets(templates), [templates]);
  const filtered = filterStarterCatalogTemplates(templates, filters, installedCodes);
  // A filtered-out template is never allowed to retain visible mapping inputs.
  const selected = filtered.find((template) => template.id === selectedTemplateId) ?? null;
  const hasActiveFilters = (Object.keys(DEFAULT_STARTER_CATALOG_FILTERS) as (keyof StarterCatalogFilters)[])
    .some((key) => filters[key] !== DEFAULT_STARTER_CATALOG_FILTERS[key]);

  function updateFilter<K extends keyof StarterCatalogFilters>(key: K, value: StarterCatalogFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    invalidateReuseRequest();
    setSelectedTemplateId("");
    setMappings({});
    setMappingItems({});
    setWasteOverridePct("");
    setProductionRateFactor("");
    setReuseSourceId("");
    setReuseNote(null);
    setReuseError(null);
  }

  function resetFilters() {
    setFilters({ ...DEFAULT_STARTER_CATALOG_FILTERS });
    invalidateReuseRequest();
    setSelectedTemplateId("");
    setMappings({});
    setMappingItems({});
    setWasteOverridePct("");
    setProductionRateFactor("");
    setReuseSourceId("");
    setReuseNote(null);
    setReuseError(null);
  }

  const mappedCount = selected ? selected.components.filter((component) => mappings[component.key]).length : 0;
  const mappingComplete = Boolean(selected && mappedCount === selected.components.length);
  const mappedIds = selected ? [...new Set(selected.components.map((component) => mappings[component.key]).filter(Boolean))] : [];
  const costPreviewQuery = useQuery({
    queryKey: ["assembly-catalog-cost-preview", selected?.id ?? "", ...mappedIds],
    queryFn: async () => {
      const entries = await Promise.all(mappedIds.map(async (id) => {
        try {
          const result = await clientFetch<CostItemUnitCost>(`/costbook/cost-items/${id}/unit-cost`);
          return [id, { unitCost: result.totalUnitCost, loading: false, error: null }] as const;
        } catch (err) {
          return [id, { unitCost: 0, loading: false, error: err instanceof Error ? err.message : "Cost unavailable" }] as const;
        }
      }));
      return Object.fromEntries(entries) as Record<string, CostPreview>;
    },
    enabled: Boolean(selected) && mappedIds.length > 0,
    staleTime: 60_000,
  });
  const costPreview = costPreviewQuery.data ?? {};
  const previewError = selected && mappingComplete
    ? costPreviewQuery.isError
      ? "Cost preview could not be loaded."
      : selected.components.map((component) => costPreview[mappings[component.key]]?.error).find(Boolean) ?? null
    : null;
  const previewReady = Boolean(selected && mappingComplete && selected.components.every((component) => costPreview[mappings[component.key]] && !costPreview[mappings[component.key]].loading && !costPreview[mappings[component.key]].error));
  const previewLoading = Boolean(selected && mappingComplete && !previewReady && !previewError);
  const previewUnitCost = selected && previewReady && !previewError
    ? selected.components.reduce((total, component) => total + (costPreview[mappings[component.key]]?.unitCost ?? 0) * component.quantityPerUnit, 0)
    : null;
  const previewOutputQuantity = Math.max(0, Number(previewQuantity) || 0);
  const previewJobCost = previewUnitCost === null ? null : previewUnitCost * previewOutputQuantity;

  async function applyReuseMapping() {
    if (!selected || !reuseSourceId) return;
    const requestSource = reuseSources.find((assembly) => assembly.id === reuseSourceId);
    const requestSeq = ++reuseRequestSeqRef.current;
    setReuseLoading(true);
    setReuseError(null);
    try {
      const result = await clientFetch<MappingReuseResult>(`/costbook/assemblies/starter-catalog/${selected.id}/mapping-suggestions?sourceAssemblyId=${encodeURIComponent(reuseSourceId)}`);
      // A response for an earlier selection must not touch the current
      // state: the estimator may have picked another recipe or changed
      // filters while this request was in flight (those handlers bump the
      // sequence, invalidating this response).
      if (reuseRequestSeqRef.current !== requestSeq) return;
      // Merge against the CURRENT mappings (refs hold the latest committed
      // state), so a slot mapped by hand during the request is preserved
      // and a suggestion colliding with a retained manual mapping is
      // skipped instead of assigning the same Cost Item twice.
      const merged = mergeReuseMappingSuggestions(mappingsRef.current, mappingItemsRef.current, result.suggestions);
      setMappings(merged.mappings);
      setMappingItems(merged.items);
      setReuseNote(merged.stillMissing.length
        ? `Applied ${merged.applied} of ${result.suggestions.length} slots from ${requestSource?.name ?? "the source assembly"}; ${merged.stillMissing.length} still need${merged.stillMissing.length === 1 ? "s" : ""} mapping: ${merged.stillMissing.join(", ")}.`
        : `Applied ${merged.applied} of ${result.suggestions.length} slots from ${requestSource?.name ?? "the source assembly"}.`);
    } catch (err) {
      if (reuseRequestSeqRef.current !== requestSeq) return;
      setReuseError(err instanceof Error ? err.message : "Mapping suggestions could not be loaded.");
    } finally {
      if (reuseRequestSeqRef.current === requestSeq) setReuseLoading(false);
    }
  }

  async function install() {
    if (!selected) return;
    if (selected.blockingReasons?.length) {
      onError(`Research evidence must be repaired before installation: ${selected.blockingReasons.join("; ")}`);
      return;
    }
    const componentMappings = selected.components.map((component) => ({
      componentKey: component.key,
      costItemId: mappings[component.key],
    }));
    if (componentMappings.some((mapping) => !mapping.costItemId)) {
      onError("Map every component to an active Cost Item before installing the assembly.");
      return;
    }
    if (new Set(componentMappings.map((mapping) => mapping.costItemId)).size !== componentMappings.length) {
      onError("Use a different Cost Item for each recipe slot so every quantity remains explicit.");
      return;
    }
    const incompatible = selected.components.find((component) => {
      const item = mappingItems[component.key];
      return item && !assessCostItemMapping(component, item).compatible;
    });
    if (incompatible) {
      onError(`${incompatible.label} is mapped to an incompatible Cost Item. Choose a matching unit and cost type.`);
      return;
    }
    // DEV-17 S10: blank means "recipe defaults" (no override). Out-of-range
    // values are rejected here; the API validates them again.
    const parsedWaste = wasteOverridePct.trim() === "" ? undefined : Number(wasteOverridePct);
    const parsedFactor = productionRateFactor.trim() === "" ? undefined : Number(productionRateFactor);
    if (parsedWaste !== undefined && (!Number.isFinite(parsedWaste) || parsedWaste < 0 || parsedWaste > 100)) {
      onError("Waste override must be between 0 and 100 percent.");
      return;
    }
    if (parsedFactor !== undefined && (!Number.isFinite(parsedFactor) || parsedFactor <= 0 || parsedFactor > 10)) {
      onError("Production factor must be greater than 0 and at most 10.");
      return;
    }
    onSaving(true);
    onError(null);
    try {
      const created = await clientFetch<CostbookAssembly>("/costbook/assemblies/starter-catalog/install", {
        method: "POST",
        body: JSON.stringify({
          templateId: selected.id,
          expectedRecipeVersion: selected.version,
          componentMappings,
          ...(parsedWaste !== undefined ? { wasteOverridePct: parsedWaste } : {}),
          ...(parsedFactor !== undefined ? { productionRateFactor: parsedFactor } : {}),
        }),
      });
      onInstalled(created);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Starter assembly could not be installed.");
    } finally {
      onSaving(false);
    }
  }

  return <section className="overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
    <div className="grid gap-4 border-b border-border/70 p-4 sm:p-5 lg:grid-cols-[1fr_auto] lg:items-end">
      <div className="flex gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><BookOpen className="size-5" aria-hidden="true" /></div>
        <div><h2 className="text-lg font-semibold text-foreground">Residential Assembly Catalog</h2><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Browse by familiar NAHB work group with CSI MasterFormat classification underneath. Map every recipe slot to your own Costbook before installation, so pricing stays organization-specific and reviewable.</p></div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="rounded-full border border-border bg-background px-2.5 py-1">{templates.length} recipes</span><span className="rounded-full border border-border bg-background px-2.5 py-1">{coverage.length} work categories</span>{catalogVersion ? <span className="rounded-full border border-border bg-background px-2.5 py-1">Catalog {catalogVersion}</span> : null}<span className="rounded-full border border-border bg-background px-2.5 py-1">No embedded prices</span></div>
    </div>
    {loading ? <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Loading starter catalog…</div> : <div className="grid lg:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.6fr)]">
      <div className="border-b border-border/70 lg:border-b-0 lg:border-r">
        <div className="grid gap-2 border-b border-border/70 p-3 sm:grid-cols-2 lg:grid-cols-1">
          <Input aria-label="Search starter assemblies" placeholder="Search assemblies, trades, or CSI…" value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} />
          <select aria-label="Filter by NAHB group" className="h-9 min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={filters.nahbGroup} onChange={(event) => updateFilter("nahbGroup", event.target.value)}>
            <option value="all">All residential groups</option>
            {facets.nahbGroups.map((group) => <option key={group} value={group}>{group}</option>)}
          </select>
          <select aria-label="Filter by NAHB build phase" className="h-9 min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={filters.nahbPhase} onChange={(event) => updateFilter("nahbPhase", event.target.value)}>
            <option value="all">All build phases</option>
            {facets.nahbPhases.map((phase) => <option key={phase} value={phase}>NAHB {phase}</option>)}
          </select>
          <select aria-label="Filter by CSI division" className="h-9 min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={filters.csiDivision} onChange={(event) => updateFilter("csiDivision", event.target.value)}>
            <option value="all">All CSI divisions</option>
            {facets.csiDivisions.map((division) => <option key={division} value={division}>CSI {division}</option>)}
          </select>
          <select aria-label="Filter by trade" className="h-9 min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={filters.trade} onChange={(event) => updateFilter("trade", event.target.value)}>
            <option value="all">All trades</option>
            {facets.trades.map((trade) => <option key={trade} value={trade}>{trade}</option>)}
          </select>
          <select aria-label="Filter by assembly unit" className="h-9 min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={filters.unit} onChange={(event) => updateFilter("unit", event.target.value)}>
            <option value="all">All output units</option>
            {facets.units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
          </select>
          <select aria-label="Filter by installation status" className="h-9 min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={filters.installation} onChange={(event) => updateFilter("installation", event.target.value as StarterCatalogInstallation)}>
            <option value="all">All installation statuses</option>
            <option value="available">Not installed</option>
            <option value="installed">Installed</option>
          </select>
          <div className="flex items-center justify-between gap-2 sm:col-span-2 lg:col-span-1">
            <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{filtered.length} of {templates.length} recipes</p>
            {hasActiveFilters ? <Button type="button" size="sm" variant="ghost" onClick={resetFilters}>Clear filters</Button> : null}
          </div>
        </div>
        <div className="max-h-[420px] overflow-y-auto divide-y divide-border/70">{filtered.map((template) => {
          const installed = isStarterCatalogInstalled(template, installedCodes);
          return <button key={template.id} type="button" aria-label={`Review assembly ${template.name}`} onClick={() => { invalidateReuseRequest(); setSelectedTemplateId(template.id); setMappings({}); setMappingItems({}); setWasteOverridePct(""); setProductionRateFactor(""); setReuseSourceId(""); setReuseNote(null); setReuseError(null); }} className={`w-full px-4 py-3 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 ${selectedTemplateId === template.id ? "bg-primary/10" : "hover:bg-muted/50"}`}>
            <span className="flex items-start justify-between gap-3"><span className="font-medium text-foreground">{template.name}</span>{installed ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Installed" /> : null}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{template.nahbPhase ? `NAHB ${template.nahbPhase} · ` : ""}{template.nahbGroup} · CSI {template.csiDivision} · {template.unitOfMeasure}{template.blockingReasons?.length ? " · Evidence pending" : ""}</span>
          </button>;
        })}{filtered.length === 0 ? <div className="grid gap-2 p-4"><p className="text-sm text-muted-foreground">No starter assemblies match those filters.</p><Button type="button" variant="outline" size="sm" onClick={resetFilters}>Clear filters</Button></div> : null}</div>
      </div>
      {!selected ? <EmptyState title="Choose a starter assembly" description="Select a recipe to review its measurement basis and component mapping." /> : <div className="grid content-start gap-5 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
          <div><p className="font-mono text-xs text-primary">{selected.code} · CSI {selected.csiDivision} {selected.csiTitle}</p><h3 className="mt-1 text-xl font-semibold text-foreground">{selected.name}</h3><p className="mt-2 text-sm text-muted-foreground">Measured by {selected.measurementBasis.toLowerCase()}. {selected.wasteGuidance}</p></div>
          <div className="grid justify-items-end gap-1"><span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">NAHB {selected.nahbPhase ?? ""} · {selected.nahbGroup}</span>{selected.evidenceRefs?.length ? <span className="text-xs text-muted-foreground">{selected.evidenceRefs.length} referenced sources · research review required</span> : null}</div>
        </div>
        {selected.blockingReasons?.length ? <p role="alert" className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">Research evidence pending: {selected.blockingReasons.join("; ")}. This recipe can be inspected but not installed until its source references are repaired.</p> : null}
        {reuseSources.length > 0 ? <div className="grid gap-2 rounded-lg border border-border/70 bg-background/70 p-3">
          <div><h4 className="font-medium text-foreground">Reuse mapping from an installed assembly</h4><p className="text-sm text-muted-foreground">Apply a related install&apos;s Cost Items to the slots they fit. Slots you already mapped by hand are left alone; anything left unmapped still needs a manual choice.</p></div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select aria-label="Reuse mapping from installed assembly" className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm" value={reuseSourceId} onChange={(event) => { setReuseSourceId(event.target.value); setReuseNote(null); setReuseError(null); }} disabled={!canWrite || saving || reuseLoading}>
              <option value="">Choose an installed assembly…</option>
              {reuseSources.map((assembly) => <option key={assembly.id} value={assembly.id}>{assembly.code} · {assembly.name}</option>)}
            </select>
            <Button type="button" variant="outline" size="sm" onClick={applyReuseMapping} disabled={!canWrite || saving || reuseLoading || !reuseSourceId}>Apply compatible mappings</Button>
          </div>
          {reuseNote ? <p role="status" className="text-sm text-muted-foreground">{reuseNote}</p> : null}
          {reuseError ? <p role="alert" className="text-sm text-destructive">{reuseError}</p> : null}
        </div> : null}
        <div className="grid gap-3"><div><h4 className="font-medium text-foreground">Map the recipe</h4><p className="text-sm text-muted-foreground">Each slot must point to an active Cost Item. Quantities are per 1 {selected.unitOfMeasure} of assembly output.</p></div>
          {selected.components.map((component) => {
            const unavailableIds = new Set(Object.entries(mappings).filter(([key]) => key !== component.key).map(([, id]) => id));
            return <div key={`${selected.id}:${component.key}`} className="grid gap-2 rounded-lg border border-border/70 bg-background/70 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.9fr)] sm:items-center"><span><span className="block text-sm font-medium text-foreground">{component.label} · {component.quantityPerUnit}</span><span className="mt-0.5 block text-xs text-muted-foreground">{component.help}</span><span className="mt-1 block text-[11px] text-muted-foreground">Compatible: {component.compatibleUnits.join(", ")} · {component.allowedCostItemKinds.join(", ")}</span></span><CostItemSearchPicker initialOptions={costItems} valueId={mappings[component.key] ?? ""} valueItem={mappingItems[component.key]} component={component} unavailableIds={unavailableIds} onSelect={(item) => { setMappings((current) => ({ ...current, [component.key]: item?.id ?? "" })); setMappingItems((current) => { const next = { ...current }; if (item) next[component.key] = item; else delete next[component.key]; return next; }); }} disabled={!canWrite || saving} /></div>;
          })}
        </div>
        <div className="grid gap-3 rounded-lg border border-primary/25 bg-primary/5 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Pre-install cost preview</p><p className="mt-1 text-sm text-muted-foreground">{mappingComplete ? "Read-only estimate from the mapped Cost Items. Installation still requires review of local production assumptions." : `Map ${selected.components.length - mappedCount} more component${selected.components.length - mappedCount === 1 ? "" : "s"} to preview cost.`}</p></div>
          <label className="grid gap-1 text-sm font-medium"><span>Output quantity</span><Input type="number" min="0.0001" step="0.0001" value={previewQuantity} onChange={(event) => setPreviewQuantity(event.target.value)} disabled={!mappingComplete || saving} /></label>
          <div className="min-w-36 text-right"><p className="text-xs text-muted-foreground">{previewLoading ? "Loading cost" : previewUnitCost === null ? "Unit cost" : `Per 1 ${selected.unitOfMeasure}`}</p><p className="text-lg font-semibold text-foreground">{previewLoading ? "…" : previewUnitCost === null ? "—" : money(previewUnitCost)}</p><p className="text-xs text-muted-foreground">{previewError ? "Cost unavailable" : previewJobCost === null ? "Complete mapping first" : `Job cost · ${money(previewJobCost)}`}</p></div>
          <div className="grid gap-3 sm:col-span-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium"><span>Waste override (%) — optional</span><Input type="number" min="0" max="100" step="0.5" value={wasteOverridePct} onChange={(event) => setWasteOverridePct(event.target.value)} disabled={!mappingComplete || saving} placeholder="Recipe default" /></label>
            <label className="grid gap-1 text-sm font-medium"><span>Production factor — optional</span><Input type="number" min="0.1" max="10" step="0.1" value={productionRateFactor} onChange={(event) => setProductionRateFactor(event.target.value)} disabled={!mappingComplete || saving} placeholder="1.0 = recipe default" /></label>
            <p className="text-xs text-muted-foreground sm:col-span-2">Preview above uses the waste and production rate of each mapped item. The waste override replaces the waste % of each mapped material for this install; the production factor multiplies the production rate of each mapped item (0.8 = a crew producing at 80% of the assumed rate). Both apply when the assembly is installed, and stay recorded on it — blank means the recipe defaults.</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Review production rates, waste, code, permits, and local conditions before using the installed assembly in an estimate.</p><Button type="button" onClick={install} disabled={!canWrite || saving || Boolean(selected.blockingReasons?.length) || !mappingComplete || !previewReady || isStarterCatalogInstalled(selected, installedCodes)}>{isStarterCatalogInstalled(selected, installedCodes) ? "Installed" : saving ? "Installing" : "Install assembly"}</Button></div>
      </div>}
    </div>}
  </section>;
}

export function CostItemSearchPicker({ initialOptions, valueId, valueItem, component, unavailableIds = new Set<string>(), onSelect, disabled }: {
  initialOptions: CostItemCatalogRecord[];
  valueId: string;
  valueItem?: CostItemCatalogRecord;
  component?: StarterCatalogComponent;
  unavailableIds?: Set<string>;
  onSelect: (item: CostItemCatalogRecord | null) => void;
  disabled: boolean;
}) {
  const selected = valueItem ?? initialOptions.find((item) => item.id === valueId);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const resultsId = useId();
  const displayValue = editing ? query : selected ? `${selected.code} · ${selected.name}` : "";

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  // Cost-item search rides TanStack Query (Fluid plan 2.3) with the
  // builder's 5-minute staleTime: reopening the picker — or opening a
  // second picker for the same query — reuses the cached results instead
  // of refetching on every mount. The key carries the picker kind so it
  // never collides with the builder's ["item-search", catalogKind, ...]
  // results, which have a different payload shape.
  const search = useQuery({
    queryKey: ["item-search", "cost-item-picker", debouncedQuery],
    queryFn: () => clientFetch<CostItemCatalogRecord[]>(`/costbook/cost-items/search?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const loading = search.isFetching;
  const searchError = search.isError;
  const options = search.isError ? [] : (search.data ?? initialOptions);

  return <div className="relative min-w-0">
    <Search className="pointer-events-none absolute left-3 top-2.5 z-10 size-4 text-muted-foreground" aria-hidden="true" />
    <Input role="combobox" aria-label="Search Cost Items" aria-expanded={open} aria-controls={resultsId} autoComplete="off" className="pl-9" placeholder="Search code or name…" value={displayValue} disabled={disabled} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 150)} onChange={(event) => { setEditing(true); setQuery(event.target.value); if (valueId) onSelect(null); setOpen(true); }} />
    {open && !disabled ? <div id={resultsId} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full min-w-[280px] overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg">
      {loading ? <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" aria-hidden="true" />Searching…</div> : searchError ? <p role="alert" className="px-3 py-2 text-xs text-destructive">Cost Items could not be loaded. Try searching again.</p> : options.length === 0 ? <p className="px-3 py-2 text-xs text-muted-foreground">No active Cost Items found.</p> : options.map((item) => {
        const assessment = component ? assessCostItemMapping(component, item) : null;
        const unavailable = unavailableIds.has(item.id);
        const selectable = !unavailable && (assessment?.compatible ?? true);
        const detail = unavailable ? "Already mapped to another slot" : assessment && !assessment.compatible ? assessment.reasons.join(" · ") : `${item.unitOfMeasure}${assessment ? ` · ${assessment.kind}` : ""}`;
        return <button key={item.id} role="option" aria-selected={item.id === valueId} type="button" disabled={!selectable} className="grid w-full gap-0.5 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" onMouseDown={(event) => event.preventDefault()} onClick={() => { onSelect(item); setQuery(""); setEditing(false); setOpen(false); }}><span className="font-medium text-foreground">{item.code} · {item.name}</span><span className="text-xs text-muted-foreground">{detail}</span></button>;
      })}
    </div> : null}
  </div>;
}

function AssemblyEditForm({ assembly, saving, onSaving, onError, onUpdated }: {
  assembly: CostbookAssembly;
  saving: boolean;
  onSaving: (value: boolean) => void;
  onError: (value: string | null) => void;
  onUpdated: (value: CostbookAssembly) => void;
}) {
  const [edit, setEdit] = useState<AssemblyForm>({
    code: assembly.code,
    name: assembly.name,
    unitOfMeasure: assembly.unitOfMeasure,
    description: assembly.description ?? "",
    isTemplate: assembly.isTemplate,
  });
  // DEV-17 S10: strings so blank can mean "clear the override" (null).
  const [editWasteOverridePct, setEditWasteOverridePct] = useState(assembly.wasteOverridePct == null ? "" : String(assembly.wasteOverridePct));
  const [editProductionRateFactor, setEditProductionRateFactor] = useState(assembly.productionRateFactor == null ? "" : String(assembly.productionRateFactor));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedWaste = editWasteOverridePct.trim() === "" ? null : Number(editWasteOverridePct);
    const parsedFactor = editProductionRateFactor.trim() === "" ? null : Number(editProductionRateFactor);
    if (parsedWaste !== null && (!Number.isFinite(parsedWaste) || parsedWaste < 0 || parsedWaste > 100)) {
      onError("Waste override must be between 0 and 100 percent.");
      return;
    }
    if (parsedFactor !== null && (!Number.isFinite(parsedFactor) || parsedFactor <= 0 || parsedFactor > 10)) {
      onError("Production factor must be greater than 0 and at most 10.");
      return;
    }
    onSaving(true);
    onError(null);
    try {
      const updated = await clientFetch<CostbookAssembly>(`/costbook/assemblies/${assembly.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...edit, description: edit.description.trim() || null, wasteOverridePct: parsedWaste, productionRateFactor: parsedFactor }),
      });
      onUpdated(updated);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Assembly could not be updated.");
    } finally {
      onSaving(false);
    }
  }

  return <form onSubmit={submit} className="grid gap-3 border-t border-border/70 pt-4 md:grid-cols-2">
    <Input aria-label="Assembly code" value={edit.code} onChange={(event) => setEdit({ ...edit, code: event.target.value })} required disabled={saving} />
    <Input aria-label="Assembly name" value={edit.name} onChange={(event) => setEdit({ ...edit, name: event.target.value })} required disabled={saving} />
    <Input aria-label="Assembly unit" value={edit.unitOfMeasure} onChange={(event) => setEdit({ ...edit, unitOfMeasure: event.target.value })} required disabled={saving} />
    <Input aria-label="Assembly description" value={edit.description} onChange={(event) => setEdit({ ...edit, description: event.target.value })} disabled={saving} />
    <label className="grid gap-1 text-sm font-medium"><span>Waste override (%)</span><Input aria-label="Waste override percent" type="number" min="0" max="100" step="any" value={editWasteOverridePct} onChange={(event) => setEditWasteOverridePct(event.target.value)} disabled={saving} placeholder="Recipe default" /></label>
    <label className="grid gap-1 text-sm font-medium"><span>Production factor</span><Input aria-label="Production factor" type="number" min="0" max="10" step="any" value={editProductionRateFactor} onChange={(event) => setEditProductionRateFactor(event.target.value)} disabled={saving} placeholder="1.0 = recipe default" /></label>
    <p className="text-xs text-muted-foreground md:col-span-2">Blank clears the override back to the recipe defaults. Waste replaces the waste % of each mapped material; production factor multiplies the production rate of each mapped item.</p>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.isTemplate} onChange={(event) => setEdit({ ...edit, isTemplate: event.target.checked })} disabled={saving} />Reusable template</label>
    <div className="md:text-right"><Button type="submit" size="sm" disabled={saving}>{saving ? "Saving" : "Save changes"}</Button></div>
  </form>;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
