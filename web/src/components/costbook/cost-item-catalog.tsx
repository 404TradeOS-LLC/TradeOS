"use client";

import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createCostItemCatalogRecord,
  deactivateCostItemCatalogRecord,
  updateCostItemCatalogRecord,
  type CostItemCatalogRecord,
} from "@/components/costbook/cost-item-catalog-actions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { clientFetch } from "@/lib/clientApi";

type Option = { id: string; label: string };
type CostItemFormState = {
  subcategoryId: string;
  code: string;
  name: string;
  unitOfMeasure: string;
  productionRate: string;
  laborRateId: string;
  materialId: string;
  equipmentId: string;
};

const emptyForm: CostItemFormState = {
  subcategoryId: "",
  code: "",
  name: "",
  unitOfMeasure: "",
  productionRate: "",
  laborRateId: "",
  materialId: "",
  equipmentId: "",
};

export function CostItemCatalog({
  initialCostItems,
  subcategories,
  laborRates,
  materials,
  equipment,
  canWrite,
  canManage,
}: {
  initialCostItems: CostItemCatalogRecord[];
  subcategories: Option[];
  laborRates: Option[];
  materials: Option[];
  equipment: Option[];
  canWrite: boolean;
  canManage: boolean;
}) {
  const [costItems, setCostItems] = useState(initialCostItems);
  const [form, setForm] = useState<CostItemFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editingItem = useMemo(() => costItems.find((item) => item.id === editingId) ?? null, [costItems, editingId]);
  const optionLabels = useMemo(() => new Map([
    ...subcategories.map((item) => [item.id, item.label] as const),
    ...laborRates.map((item) => [item.id, item.label] as const),
    ...materials.map((item) => [item.id, item.label] as const),
    ...equipment.map((item) => [item.id, item.label] as const),
  ]), [subcategories, laborRates, materials, equipment]);

  function startCreate() {
    if (saving) return;
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  function startEdit(item: CostItemCatalogRecord) {
    if (saving) return;
    setEditingId(item.id);
    setForm({
      subcategoryId: item.subcategoryId,
      code: item.code,
      name: item.name,
      unitOfMeasure: item.unitOfMeasure,
      productionRate: item.productionRate == null ? "" : String(item.productionRate),
      laborRateId: item.laborRateId ?? "",
      materialId: item.materialId ?? "",
      equipmentId: item.equipmentId ?? "",
    });
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const sharedPayload = {
      code: form.code.trim(),
      name: form.name.trim(),
      unitOfMeasure: form.unitOfMeasure.trim(),
      ...(form.productionRate ? { productionRate: Number(form.productionRate) } : {}),
      ...(form.laborRateId ? { laborRateId: form.laborRateId } : {}),
      ...(form.materialId ? { materialId: form.materialId } : {}),
      ...(form.equipmentId ? { equipmentId: form.equipmentId } : {}),
    };

    try {
      const saved = editingId
        ? await updateCostItemCatalogRecord(clientFetch, editingId, sharedPayload)
        : await createCostItemCatalogRecord(clientFetch, { ...sharedPayload, subcategoryId: form.subcategoryId });
      setCostItems((current) => sortCostItems(editingId
        ? current.map((item) => (item.id === saved.id ? saved : item))
        : [...current, saved]));
      setEditingId(null);
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cost item could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!window.confirm("Deactivate this cost item? Existing estimate history will be preserved.")) return;
    setSaving(true);
    setError(null);
    try {
      await deactivateCostItemCatalogRecord(clientFetch, id);
      setCostItems((current) => current.filter((item) => item.id !== id));
      if (editingId === id) startCreate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cost item could not be deactivated.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      {canWrite ? (
        <section className="rounded-lg border border-border/70 bg-surface p-4" aria-label={editingItem ? "Edit cost item" : "Create cost item"}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">{editingItem ? "Edit Cost Item" : "Create Cost Item"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Build reusable estimating items from the organization&apos;s existing hierarchy and catalogs.</p>
            </div>
            {editingItem ? (
              <Button type="button" variant="outline" size="sm" onClick={startCreate} disabled={saving}>
                <X className="size-4" aria-hidden="true" /> Cancel
              </Button>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Field label="Subcategory" className="lg:col-span-2">
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                value={form.subcategoryId}
                onChange={(event) => setForm({ ...form, subcategoryId: event.target.value })}
                required
                disabled={saving || Boolean(editingItem)}
              >
                <option value="">Select subcategory</option>
                {subcategories.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="Code"><Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required disabled={saving} /></Field>
            <Field label="Unit"><Input value={form.unitOfMeasure} onChange={(event) => setForm({ ...form, unitOfMeasure: event.target.value })} placeholder="EA" required disabled={saving} /></Field>
            <Field label="Name" className="lg:col-span-2"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required disabled={saving} /></Field>
            <Field label="Production Rate"><Input type="number" min="0.0001" step="0.0001" value={form.productionRate} onChange={(event) => setForm({ ...form, productionRate: event.target.value })} disabled={saving} /></Field>
            <div className="hidden lg:block" />
            <SelectField label="Labor Rate" value={form.laborRateId} options={laborRates} onChange={(value) => setForm({ ...form, laborRateId: value })} disabled={saving} />
            <SelectField label="Material" value={form.materialId} options={materials} onChange={(value) => setForm({ ...form, materialId: value })} disabled={saving} />
            <SelectField label="Equipment" value={form.equipmentId} options={equipment} onChange={(value) => setForm({ ...form, equipmentId: value })} disabled={saving} />
            <div className="flex items-end">
              <Button type="submit" disabled={saving || (!editingItem && !form.subcategoryId)} className="w-full">
                {editingItem ? <Check className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
                {saving ? "Saving" : editingItem ? "Save Cost Item" : "Add Cost Item"}
              </Button>
            </div>
          </form>
          {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
        </section>
      ) : (
        <div className="rounded-lg border border-border/70 bg-surface p-4 text-sm text-muted-foreground">
          You have read-only Costbook access. Cost-item create and edit controls are hidden for this role.
        </div>
      )}

      {costItems.length === 0 ? (
        <EmptyState title="No active cost items yet" description="Add a cost item to connect your hierarchy and estimating catalogs." />
      ) : (
        <section className="overflow-hidden rounded-lg border border-border/70 bg-surface" aria-label="Cost item catalog">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <tr><th className="px-4 py-3">Code</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Subcategory</th><th className="px-4 py-3">Unit</th><th className="px-4 py-3">Catalog Links</th>{canWrite || canManage ? <th className="px-4 py-3 text-right">Actions</th> : null}</tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {costItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-mono text-xs">{item.code}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{optionLabels.get(item.subcategoryId) ?? "Unknown"}</td>
                    <td className="px-4 py-3">{item.unitOfMeasure}</td>
                    <td className="px-4 py-3 text-muted-foreground">{countLinks(item)} linked</td>
                    {canWrite || canManage ? (
                      <td className="px-4 py-3"><div className="flex justify-end gap-2">
                        {canWrite ? <Button type="button" variant="outline" size="sm" onClick={() => startEdit(item)} disabled={saving}><Pencil className="size-4" aria-hidden="true" /> Edit</Button> : null}
                        {canManage ? <Button type="button" variant="outline" size="sm" onClick={() => handleDeactivate(item.id)} disabled={saving}><Trash2 className="size-4" aria-hidden="true" /> Deactivate</Button> : null}
                      </div></td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid divide-y divide-border/70 md:hidden">
            {costItems.map((item) => (
              <article key={item.id} className="grid gap-3 p-4">
                <div><p className="font-mono text-xs text-muted-foreground">{item.code}</p><h2 className="font-semibold text-foreground">{item.name}</h2><p className="mt-1 text-sm text-muted-foreground">{optionLabels.get(item.subcategoryId) ?? "Unknown subcategory"} · {item.unitOfMeasure} · {countLinks(item)} linked</p></div>
                {canWrite || canManage ? <div className="flex gap-2">{canWrite ? <Button type="button" variant="outline" size="sm" onClick={() => startEdit(item)} disabled={saving}>Edit</Button> : null}{canManage ? <Button type="button" variant="outline" size="sm" onClick={() => handleDeactivate(item.id)} disabled={saving}>Deactivate</Button> : null}</div> : null}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`grid gap-1.5 text-sm font-medium text-foreground ${className}`}><span>{label}</span>{children}</label>;
}

function SelectField({ label, value, options, onChange, disabled }: { label: string; value: string; options: Option[]; onChange: (value: string) => void; disabled: boolean }) {
  return <Field label={label}><select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}><option value="">None</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></Field>;
}

function countLinks(item: CostItemCatalogRecord) {
  return [item.laborRateId, item.materialId, item.equipmentId].filter(Boolean).length;
}

function sortCostItems(items: CostItemCatalogRecord[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code));
}
