"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { clientFetch } from "@/lib/clientApi";
import type { CostbookAssembly } from "@/lib/costbook-api";
import type { CostItemCatalogRecord } from "@/components/costbook/cost-item-catalog-actions";

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
type StarterCatalogComponent = { key: string; label: string; quantityPerUnit: number; help: string };
type StarterCatalogTemplate = {
  id: string;
  code: string;
  name: string;
  description: string;
  unitOfMeasure: string;
  csiDivision: string;
  csiTitle: string;
  nahbGroup: string;
  trade: string;
  measurementBasis: string;
  wasteGuidance: string;
  components: StarterCatalogComponent[];
};
type CostItemUnitCost = { unitCost: number };
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
  const [items, setItems] = useState<AssemblyItem[]>([]);
  const [itemsNextCursor, setItemsNextCursor] = useState<string | null>(null);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [unitCost, setUnitCost] = useState<number | null>(null);
  const [form, setForm] = useState<AssemblyForm>(emptyAssembly);
  const [componentType, setComponentType] = useState<"cost_item" | "assembly">("cost_item");
  const [componentId, setComponentId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [saving, setSaving] = useState(false);
  const [loadingItems, setLoadingItems] = useState(Boolean(initialSelectedId));
  const [error, setError] = useState<string | null>(null);
  const selected = assemblies.find((item) => item.id === selectedId) ?? null;
  const childOptions = useMemo(() => availableChildAssemblies.filter((item) => item.id !== selectedId), [availableChildAssemblies, selectedId]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    if (!selectedId) return;
    let active = true;
    Promise.all([
      clientFetch<AssemblyItemsPage>(`/costbook/assemblies/${selectedId}/items?limit=100`),
      clientFetch<AssemblyCost>(`/costbook/assemblies/${selectedId}/unit-cost`),
    ])
      .then(([rows, cost]) => {
        if (!active) return;
        setItems(rows.items);
        setItemsNextCursor(rows.nextCursor);
        setItemsTotal(rows.total);
        setUnitCost(cost.unitCost);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Assembly details could not be loaded.");
      })
      .finally(() => {
        if (active) setLoadingItems(false);
      });
    return () => { active = false; };
  }, [selectedId]);

  function selectAssembly(id: string) {
    selectedIdRef.current = id;
    setSelectedId(id);
    setItems([]);
    setItemsNextCursor(null);
    setItemsTotal(0);
    setUnitCost(null);
    setLoadingItems(Boolean(id));
    setError(null);
  }

  async function loadMoreComponents() {
    if (!selectedId || !itemsNextCursor) return;
    const requestAssemblyId = selectedId;
    const requestCursor = itemsNextCursor;
    setLoadingItems(true);
    setError(null);
    try {
      const next = await clientFetch<AssemblyItemsPage>(`/costbook/assemblies/${requestAssemblyId}/items?limit=100&cursor=${encodeURIComponent(requestCursor)}`);
      if (selectedIdRef.current !== requestAssemblyId) return;
      setItems((current) => [...current, ...next.items.filter((item) => !current.some((existing) => existing.id === item.id))]);
      setItemsNextCursor(next.nextCursor);
    } catch (err) {
      if (selectedIdRef.current === requestAssemblyId) {
        setError(err instanceof Error ? err.message : "More assembly components could not be loaded.");
      }
    } finally {
      if (selectedIdRef.current === requestAssemblyId) setLoadingItems(false);
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

  async function deactivateSelected() {
    if (!selected || !window.confirm(`Deactivate ${selected.name}? Existing estimate history will be preserved.`)) return;
    setSaving(true);
    setError(null);
    try {
      await clientFetch<void>(`/costbook/assemblies/${selected.id}`, { method: "DELETE" });
      const remaining = assemblies.filter((item) => item.id !== selected.id);
      setAssemblies(remaining);
      setAvailableChildAssemblies((current) => current.filter((item) => item.id !== selected.id));
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
      setItems((current) => [...current, created].sort((a, b) => a.sortOrder - b.sortOrder || a.componentName.localeCompare(b.componentName)));
      setItemsTotal((current) => current + 1);
      setComponentId("");
      setQuantity("1");
      try {
        const cost = await clientFetch<AssemblyCost>(`/costbook/assemblies/${requestAssemblyId}/unit-cost`);
        if (selectedIdRef.current === requestAssemblyId) setUnitCost(cost.unitCost);
      } catch {
        if (selectedIdRef.current === requestAssemblyId) {
          setUnitCost(null);
          setError("Component was added, but the current unit cost could not be refreshed. Refresh the assembly to retry the calculation.");
        }
      }
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
      setItems((current) => current.filter((item) => item.id !== id));
      setItemsTotal((current) => Math.max(0, current - 1));
      try {
        const cost = await clientFetch<AssemblyCost>(`/costbook/assemblies/${requestAssemblyId}/unit-cost`);
        if (selectedIdRef.current === requestAssemblyId) setUnitCost(cost.unitCost);
      } catch {
        if (selectedIdRef.current === requestAssemblyId) {
          setUnitCost(null);
          setError("Component was removed, but the current unit cost could not be refreshed. Refresh the assembly to retry the calculation.");
        }
      }
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
      installedCodes={new Set(availableChildAssemblies.map((assembly) => assembly.code))}
      saving={saving}
      onSaving={setSaving}
      onError={setError}
      onInstalled={(created) => {
        setAssemblies((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
        setAvailableChildAssemblies((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
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
      {error ? <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
      {!selected ? <EmptyState title="Choose an assembly" description="Select an assembly to review its composition." /> : <>
        <div className="grid gap-4 rounded-lg border border-border/70 bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="font-mono text-xs text-muted-foreground">{selected.code}</p><h1 className="text-xl font-semibold text-foreground">{selected.name}</h1><p className="mt-1 text-sm text-muted-foreground">{selected.description || "No description"} · {selected.unitOfMeasure}</p><p className="mt-2 text-sm font-medium text-foreground">Current unit cost: {unitCost === null ? "—" : money(unitCost)}</p></div>
            {canManage ? <Button type="button" variant="outline" size="sm" onClick={deactivateSelected} disabled={saving}><Trash2 className="size-4" aria-hidden="true" />Deactivate</Button> : null}
          </div>
          {canWrite ? <AssemblyEditForm key={selected.id} assembly={selected} saving={saving} onSaving={setSaving} onError={setError} onUpdated={updateAssemblyInList} /> : null}
        </div>

        {canWrite ? <form onSubmit={addComponent} className="grid gap-3 rounded-lg border border-border/70 bg-card p-4 md:grid-cols-[160px_1fr_120px_auto] md:items-end">
          <label className="grid gap-1.5 text-sm font-medium"><span>Type</span><select className="h-9 rounded-md border border-input bg-background px-3" value={componentType} onChange={(event) => { setComponentType(event.target.value as "cost_item" | "assembly"); setComponentId(""); }} disabled={saving}><option value="cost_item">Cost item</option><option value="assembly">Assembly</option></select></label>
          <label className="grid gap-1.5 text-sm font-medium"><span>Component</span><select className="h-9 rounded-md border border-input bg-background px-3" value={componentId} onChange={(event) => setComponentId(event.target.value)} required disabled={saving}><option value="">Select</option>{(componentType === "cost_item" ? costItems : childOptions).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm font-medium"><span>Qty / unit</span><Input type="number" min="0.0001" step="0.0001" value={quantity} onChange={(event) => setQuantity(event.target.value)} required disabled={saving} /></label>
          <Button type="submit" disabled={saving || !componentId}><Plus className="size-4" aria-hidden="true" />Add</Button>
        </form> : null}

        {loadingItems && items.length === 0 ? <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-card p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Loading components…</div> : items.length === 0 ? <EmptyState title="No components yet" description={canWrite ? "Add active CostItems or child Assemblies to build this composition." : "This assembly does not have any components."} /> : <div className="overflow-hidden rounded-lg border border-border/70 bg-card"><div className="border-b border-border/70 px-4 py-3 text-sm text-muted-foreground">Showing {items.length} of {itemsTotal} components</div><div className="divide-y divide-border/70">{items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 p-4"><div><p className="font-medium text-foreground">{item.componentName}</p><p className="font-mono text-xs text-muted-foreground">{item.componentCode} · {item.componentType === "cost_item" ? "Cost item" : "Assembly"} · {item.quantityPerUnit} {item.componentUnitOfMeasure}</p></div>{canWrite ? <Button type="button" variant="ghost" size="sm" onClick={() => removeComponent(item.id)} disabled={saving}><Trash2 className="size-4" aria-hidden="true" />Remove</Button> : null}</div>)}</div>{itemsNextCursor ? <div className="border-t border-border/70 p-3"><Button type="button" variant="outline" size="sm" onClick={loadMoreComponents} disabled={loadingItems}>{loadingItems ? "Loading" : "Load more components"}</Button></div> : null}</div>}
      </>}
    </section>
    </div>
  </div>;
}

function StarterAssemblyCatalog({ costItems, canWrite, installedCodes, saving, onSaving, onError, onInstalled }: {
  costItems: CostItemCatalogRecord[];
  canWrite: boolean;
  installedCodes: Set<string>;
  saving: boolean;
  onSaving: (value: boolean) => void;
  onError: (value: string | null) => void;
  onInstalled: (assembly: CostbookAssembly) => void;
}) {
  const [templates, setTemplates] = useState<StarterCatalogTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [nahbGroup, setNahbGroup] = useState("all");
  const [previewQuantity, setPreviewQuantity] = useState("1");
  const [costPreview, setCostPreview] = useState<Record<string, CostPreview>>({});
  const [loading, setLoading] = useState(true);
  const selected = templates.find((template) => template.id === selectedTemplateId) ?? null;
  const groups = useMemo(() => [...new Set(templates.map((template) => template.nahbGroup))], [templates]);
  const filtered = useMemo(() => templates.filter((template) => {
    const text = `${template.name} ${template.code} ${template.trade} ${template.csiTitle} ${template.nahbGroup}`.toLowerCase();
    return (nahbGroup === "all" || template.nahbGroup === nahbGroup) && text.includes(query.trim().toLowerCase());
  }), [templates, query, nahbGroup]);

  const mappedCount = selected ? selected.components.filter((component) => mappings[component.key]).length : 0;
  const mappingComplete = Boolean(selected && mappedCount === selected.components.length);
  const previewLoading = Boolean(selected && mappingComplete && selected.components.some((component) => costPreview[mappings[component.key]]?.loading));
  const previewError = selected && mappingComplete
    ? selected.components.map((component) => costPreview[mappings[component.key]]?.error).find(Boolean) ?? null
    : null;
  const previewUnitCost = selected && mappingComplete && !previewLoading && !previewError
    ? selected.components.reduce((total, component) => total + (costPreview[mappings[component.key]]?.unitCost ?? 0) * component.quantityPerUnit, 0)
    : null;
  const previewOutputQuantity = Math.max(0, Number(previewQuantity) || 0);
  const previewJobCost = previewUnitCost === null ? null : previewUnitCost * previewOutputQuantity;

  useEffect(() => {
    if (!selected) return;
    const mappedIds = [...new Set(selected.components.map((component) => mappings[component.key]).filter(Boolean))];
    if (mappedIds.length === 0) {
      setCostPreview({});
      return;
    }
    let active = true;
    setCostPreview((current) => Object.fromEntries(mappedIds.map((id) => [id, current[id] ?? { unitCost: 0, loading: true, error: null }])));
    Promise.all(mappedIds.map(async (id) => {
      try {
        const result = await clientFetch<CostItemUnitCost>(`/costbook/cost-items/${id}/unit-cost`);
        return [id, { unitCost: result.unitCost, loading: false, error: null }] as const;
      } catch (err) {
        return [id, { unitCost: 0, loading: false, error: err instanceof Error ? err.message : "Cost unavailable" }] as const;
      }
    })).then((entries) => {
      if (active) setCostPreview(Object.fromEntries(entries));
    });
    return () => { active = false; };
  }, [selected, mappings]);

  useEffect(() => {
    let active = true;
    clientFetch<{ items: StarterCatalogTemplate[] }>("/costbook/assemblies/starter-catalog")
      .then((result) => {
        if (!active) return;
        setTemplates(result.items);
        setSelectedTemplateId(result.items[0]?.id ?? "");
      })
      .catch((err) => { if (active) onError(err instanceof Error ? err.message : "Starter assembly catalog could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [onError]);

  async function install() {
    if (!selected) return;
    const componentMappings = selected.components.map((component) => ({
      componentKey: component.key,
      costItemId: mappings[component.key],
    }));
    if (componentMappings.some((mapping) => !mapping.costItemId)) {
      onError("Map every component to an active Cost Item before installing the assembly.");
      return;
    }
    onSaving(true);
    onError(null);
    try {
      const created = await clientFetch<CostbookAssembly>("/costbook/assemblies/starter-catalog/install", {
        method: "POST",
        body: JSON.stringify({ templateId: selected.id, componentMappings }),
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
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="rounded-full border border-border bg-background px-2.5 py-1">{templates.length} starters</span><span className="rounded-full border border-border bg-background px-2.5 py-1">No embedded prices</span></div>
    </div>
    {loading ? <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Loading starter catalog…</div> : <div className="grid lg:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.6fr)]">
      <div className="border-b border-border/70 lg:border-b-0 lg:border-r">
        <div className="grid gap-2 border-b border-border/70 p-3 sm:grid-cols-2 lg:grid-cols-1">
          <Input aria-label="Search starter assemblies" placeholder="Search assemblies, trades, or CSI…" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select aria-label="Filter by NAHB group" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={nahbGroup} onChange={(event) => setNahbGroup(event.target.value)}><option value="all">All residential groups</option>{groups.map((group) => <option key={group} value={group}>{group}</option>)}</select>
        </div>
        <div className="max-h-[420px] overflow-y-auto divide-y divide-border/70">{filtered.map((template) => {
          const installed = installedCodes.has(template.code);
          return <button key={template.id} type="button" onClick={() => { setSelectedTemplateId(template.id); setMappings({}); }} className={`w-full px-4 py-3 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 ${selectedTemplateId === template.id ? "bg-primary/10" : "hover:bg-muted/50"}`}>
            <span className="flex items-start justify-between gap-3"><span className="font-medium text-foreground">{template.name}</span>{installed ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Installed" /> : null}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{template.nahbGroup} · CSI {template.csiDivision} · {template.unitOfMeasure}</span>
          </button>;
        })}{filtered.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No starter assemblies match those filters.</p> : null}</div>
      </div>
      {!selected ? <EmptyState title="Choose a starter assembly" description="Select a recipe to review its measurement basis and component mapping." /> : <div className="grid content-start gap-5 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
          <div><p className="font-mono text-xs text-primary">{selected.code} · CSI {selected.csiDivision} {selected.csiTitle}</p><h3 className="mt-1 text-xl font-semibold text-foreground">{selected.name}</h3><p className="mt-2 text-sm text-muted-foreground">Measured by {selected.measurementBasis.toLowerCase()}. {selected.wasteGuidance}</p></div>
          <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">NAHB · {selected.nahbGroup}</span>
        </div>
        <div className="grid gap-3"><div><h4 className="font-medium text-foreground">Map the recipe</h4><p className="text-sm text-muted-foreground">Each slot must point to an active Cost Item. Quantities are per 1 {selected.unitOfMeasure} of assembly output.</p></div>
          {selected.components.map((component) => <label key={component.key} className="grid gap-2 rounded-lg border border-border/70 bg-background/70 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.9fr)] sm:items-center"><span><span className="block text-sm font-medium text-foreground">{component.label} · {component.quantityPerUnit}</span><span className="mt-0.5 block text-xs text-muted-foreground">{component.help}</span></span><select className="h-9 min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={mappings[component.key] ?? ""} onChange={(event) => setMappings((current) => ({ ...current, [component.key]: event.target.value }))} disabled={!canWrite || saving}><option value="">Select a Cost Item</option>{costItems.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>)}
        </div>
        <div className="grid gap-3 rounded-lg border border-primary/25 bg-primary/5 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Pre-install cost preview</p><p className="mt-1 text-sm text-muted-foreground">{mappingComplete ? "Read-only estimate from the mapped Cost Items. Installation still requires review of local production assumptions." : `Map ${selected.components.length - mappedCount} more component${selected.components.length - mappedCount === 1 ? "" : "s"} to preview cost.`}</p></div>
          <label className="grid gap-1 text-sm font-medium"><span>Output quantity</span><Input type="number" min="0.0001" step="0.0001" value={previewQuantity} onChange={(event) => setPreviewQuantity(event.target.value)} disabled={!mappingComplete || saving} /></label>
          <div className="min-w-36 text-right"><p className="text-xs text-muted-foreground">{previewLoading ? "Loading cost" : previewUnitCost === null ? "Unit cost" : `Per 1 ${selected.unitOfMeasure}`}</p><p className="text-lg font-semibold text-foreground">{previewLoading ? "…" : previewUnitCost === null ? "—" : money(previewUnitCost)}</p><p className="text-xs text-muted-foreground">{previewError ? "Cost unavailable" : previewJobCost === null ? "Complete mapping first" : `Job cost · ${money(previewJobCost)}`}</p></div>
        </div>
        <div className="flex flex-col gap-2 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Review production rates, waste, code, permits, and local conditions before using the installed assembly in an estimate.</p><Button type="button" onClick={install} disabled={!canWrite || saving || installedCodes.has(selected.code) || costItems.length === 0}>{installedCodes.has(selected.code) ? "Installed" : saving ? "Installing" : "Install assembly"}</Button></div>
      </div>}
    </div>}
  </section>;
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSaving(true);
    onError(null);
    try {
      const updated = await clientFetch<CostbookAssembly>(`/costbook/assemblies/${assembly.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...edit, description: edit.description.trim() || null }),
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
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.isTemplate} onChange={(event) => setEdit({ ...edit, isTemplate: event.target.checked })} disabled={saving} />Reusable template</label>
    <div className="md:text-right"><Button type="submit" size="sm" disabled={saving}>{saving ? "Saving" : "Save changes"}</Button></div>
  </form>;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
