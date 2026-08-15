"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
type AssemblyForm = { code: string; name: string; unitOfMeasure: string; description: string; isTemplate: boolean };
const emptyAssembly: AssemblyForm = { code: "", name: "", unitOfMeasure: "", description: "", isTemplate: false };

export function AssemblyCatalog({ initialAssemblies, costItems, canWrite, canManage }: {
  initialAssemblies: CostbookAssembly[];
  costItems: CostItemCatalogRecord[];
  canWrite: boolean;
  canManage: boolean;
}) {
  const initialSelectedId = initialAssemblies.find((item) => item.isActive)?.id ?? "";
  const [assemblies, setAssemblies] = useState(initialAssemblies.filter((item) => item.isActive));
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [items, setItems] = useState<AssemblyItem[]>([]);
  const [unitCost, setUnitCost] = useState<number | null>(null);
  const [form, setForm] = useState<AssemblyForm>(emptyAssembly);
  const [componentType, setComponentType] = useState<"cost_item" | "assembly">("cost_item");
  const [componentId, setComponentId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [saving, setSaving] = useState(false);
  const [loadingItems, setLoadingItems] = useState(Boolean(initialSelectedId));
  const [error, setError] = useState<string | null>(null);
  const selected = assemblies.find((item) => item.id === selectedId) ?? null;
  const childOptions = useMemo(() => assemblies.filter((item) => item.id !== selectedId), [assemblies, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    Promise.all([
      clientFetch<AssemblyItem[]>(`/costbook/assemblies/${selectedId}/items`),
      clientFetch<AssemblyCost>(`/costbook/assemblies/${selectedId}/unit-cost`),
    ])
      .then(([rows, cost]) => {
        if (!active) return;
        setItems(rows);
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
    setSelectedId(id);
    setItems([]);
    setUnitCost(null);
    setLoadingItems(true);
    setError(null);
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
  }

  async function deactivateSelected() {
    if (!selected || !window.confirm(`Deactivate ${selected.name}? Existing estimate history will be preserved.`)) return;
    setSaving(true);
    setError(null);
    try {
      await clientFetch<void>(`/costbook/assemblies/${selected.id}`, { method: "DELETE" });
      const remaining = assemblies.filter((item) => item.id !== selected.id);
      setAssemblies(remaining);
      const nextId = remaining[0]?.id ?? "";
      setSelectedId(nextId);
      setItems([]);
      setUnitCost(null);
      setLoadingItems(Boolean(nextId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assembly could not be deactivated.");
    } finally {
      setSaving(false);
    }
  }

  async function addComponent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId || !componentId) return;
    setSaving(true);
    setError(null);
    try {
      const created = await clientFetch<AssemblyItem>(`/costbook/assemblies/${selectedId}/items`, {
        method: "POST",
        body: JSON.stringify({
          ...(componentType === "cost_item" ? { costItemId: componentId } : { childAssemblyId: componentId }),
          quantityPerUnit: Number(quantity),
        }),
      });
      setItems((current) => [...current, created].sort((a, b) => a.sortOrder - b.sortOrder || a.componentName.localeCompare(b.componentName)));
      const cost = await clientFetch<AssemblyCost>(`/costbook/assemblies/${selectedId}/unit-cost`);
      setUnitCost(cost.unitCost);
      setComponentId("");
      setQuantity("1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assembly component could not be added.");
    } finally {
      setSaving(false);
    }
  }

  async function removeComponent(id: string) {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      await clientFetch<void>(`/costbook/assemblies/${selectedId}/items/${id}`, { method: "DELETE" });
      setItems((current) => current.filter((item) => item.id !== id));
      const cost = await clientFetch<AssemblyCost>(`/costbook/assemblies/${selectedId}/unit-cost`);
      setUnitCost(cost.unitCost);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assembly component could not be removed.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="grid gap-6 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,2fr)]">
    <aside className="grid content-start gap-4">
      {canWrite ? <form onSubmit={createAssembly} className="grid gap-3 rounded-lg border border-border/70 bg-surface p-4">
        <div><h2 className="font-semibold text-foreground">New Assembly</h2><p className="mt-1 text-sm text-muted-foreground">Create a reusable Costbook composition.</p></div>
        <Input placeholder="Code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required disabled={saving} />
        <Input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required disabled={saving} />
        <Input placeholder="Unit (EA, SF...)" value={form.unitOfMeasure} onChange={(event) => setForm({ ...form, unitOfMeasure: event.target.value })} required disabled={saving} />
        <Input placeholder="Description (optional)" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} disabled={saving} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isTemplate} onChange={(event) => setForm({ ...form, isTemplate: event.target.checked })} disabled={saving} />Reusable template</label>
        <Button type="submit" disabled={saving}><Plus className="size-4" aria-hidden="true" />{saving ? "Saving" : "Create Assembly"}</Button>
      </form> : <div className="rounded-lg border border-border/70 bg-surface p-4 text-sm text-muted-foreground">{canManage ? "You can manage assembly lifecycle, but create and edit controls are hidden for this role." : "Read-only Costbook access. Assembly mutations are hidden."}</div>}

      <div className="overflow-hidden rounded-lg border border-border/70 bg-surface">
        <div className="border-b border-border/70 px-4 py-3"><h2 className="font-semibold">Assemblies</h2></div>
        {assemblies.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No active assemblies.</div> : <div className="divide-y divide-border/70">{assemblies.map((assembly) => <button key={assembly.id} type="button" onClick={() => selectAssembly(assembly.id)} className={`w-full px-4 py-3 text-left text-sm ${assembly.id === selectedId ? "bg-muted" : "hover:bg-muted/50"}`}><span className="block font-medium text-foreground">{assembly.name}</span><span className="font-mono text-xs text-muted-foreground">{assembly.code} · {assembly.unitOfMeasure}{assembly.isTemplate ? " · Template" : ""}</span></button>)}</div>}
      </div>
    </aside>

    <section className="grid content-start gap-4">
      {error ? <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
      {!selected ? <EmptyState title="Choose an assembly" description="Select an assembly to review its composition." /> : <>
        <div className="grid gap-4 rounded-lg border border-border/70 bg-surface p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="font-mono text-xs text-muted-foreground">{selected.code}</p><h1 className="text-xl font-semibold text-foreground">{selected.name}</h1><p className="mt-1 text-sm text-muted-foreground">{selected.description || "No description"} · {selected.unitOfMeasure}</p><p className="mt-2 text-sm font-medium text-foreground">Current unit cost: {unitCost === null ? "—" : money(unitCost)}</p></div>
            {canManage ? <Button type="button" variant="outline" size="sm" onClick={deactivateSelected} disabled={saving}><Trash2 className="size-4" aria-hidden="true" />Deactivate</Button> : null}
          </div>
          {canWrite ? <AssemblyEditForm key={selected.id} assembly={selected} saving={saving} onSaving={setSaving} onError={setError} onUpdated={updateAssemblyInList} /> : null}
        </div>

        {canWrite ? <form onSubmit={addComponent} className="grid gap-3 rounded-lg border border-border/70 bg-surface p-4 md:grid-cols-[160px_1fr_120px_auto] md:items-end">
          <label className="grid gap-1.5 text-sm font-medium"><span>Type</span><select className="h-9 rounded-md border border-input bg-background px-3" value={componentType} onChange={(event) => { setComponentType(event.target.value as "cost_item" | "assembly"); setComponentId(""); }} disabled={saving}><option value="cost_item">Cost item</option><option value="assembly">Assembly</option></select></label>
          <label className="grid gap-1.5 text-sm font-medium"><span>Component</span><select className="h-9 rounded-md border border-input bg-background px-3" value={componentId} onChange={(event) => setComponentId(event.target.value)} required disabled={saving}><option value="">Select</option>{(componentType === "cost_item" ? costItems : childOptions).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm font-medium"><span>Qty / unit</span><Input type="number" min="0.0001" step="0.0001" value={quantity} onChange={(event) => setQuantity(event.target.value)} required disabled={saving} /></label>
          <Button type="submit" disabled={saving || !componentId}><Plus className="size-4" aria-hidden="true" />Add</Button>
        </form> : null}

        {loadingItems ? <div className="rounded-lg border border-border/70 bg-surface p-6 text-sm text-muted-foreground">Loading components…</div> : items.length === 0 ? <EmptyState title="No components yet" description={canWrite ? "Add active CostItems or child Assemblies to build this composition." : "This assembly does not have any components."} /> : <div className="overflow-hidden rounded-lg border border-border/70 bg-surface"><div className="divide-y divide-border/70">{items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 p-4"><div><p className="font-medium text-foreground">{item.componentName}</p><p className="font-mono text-xs text-muted-foreground">{item.componentCode} · {item.componentType === "cost_item" ? "Cost item" : "Assembly"} · {item.quantityPerUnit} {item.componentUnitOfMeasure}</p></div>{canWrite ? <Button type="button" variant="ghost" size="sm" onClick={() => removeComponent(item.id)} disabled={saving}><Trash2 className="size-4" aria-hidden="true" />Remove</Button> : null}</div>)}</div></div>}
      </>}
    </section>
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
