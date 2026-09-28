"use client";

import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import { Ban, Check, Pencil, Plus, X } from "lucide-react";
import { PricingProvenance } from "@/components/costbook/pricing-provenance";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { clientFetch } from "@/lib/clientApi";
import type { CostbookMaterial, CostbookMaterialInput } from "@/lib/api";

type MaterialFormState = {
  sku: string;
  name: string;
  unitOfMeasure: string;
  unitCost: string;
  wasteFactorPct: string;
};

const emptyForm: MaterialFormState = {
  sku: "",
  name: "",
  unitOfMeasure: "",
  unitCost: "",
  wasteFactorPct: "0",
};

export function MaterialsCatalog({
  initialMaterials,
  canWrite,
  canManage,
  activeFilter,
}: {
  initialMaterials: CostbookMaterial[];
  canWrite: boolean;
  canManage: boolean;
  activeFilter?: boolean;
}) {
  const [materials, setMaterials] = useState(initialMaterials);
  const [form, setForm] = useState<MaterialFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editingMaterial = useMemo(
    () => materials.find((material) => material.id === editingId) ?? null,
    [editingId, materials]
  );

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  function startEdit(material: CostbookMaterial) {
    setEditingId(material.id);
    setForm({
      sku: material.sku ?? "",
      name: material.name,
      unitOfMeasure: material.unitOfMeasure,
      unitCost: String(material.unitCost),
      wasteFactorPct: String(material.wasteFactorPct),
    });
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload = toPayload(form);
    try {
      const saved = editingId
        ? await clientFetch<CostbookMaterial>(`/costbook/materials/${editingId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await clientFetch<CostbookMaterial>("/costbook/materials", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      setMaterials((current) => {
        const next = editingId
          ? current.map((material) => (material.id === saved.id ? saved : material))
          : [...current, saved];
        return sortMaterials(next);
      });
      setEditingId(null);
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Material could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string) {
    setSaving(true);
    setError(null);
    try {
      await clientFetch<void>(`/costbook/materials/${id}`, { method: "DELETE" });
      setMaterials((current) =>
        activeFilter === true
          ? current.filter((material) => material.id !== id)
          : sortMaterials(current.map((material) => (material.id === id ? { ...material, isActive: false } : material)))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Material could not be deactivated.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5">
      {canWrite ? (
        <details className="rounded-xl border border-border/70 bg-card" open={Boolean(editingMaterial)}>
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground">
            {editingMaterial ? "Edit material" : "+ Add material"}
          </summary>
          <section className="border-t border-border/70 p-4" aria-label={editingMaterial ? "Edit material" : "Create material"}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">{editingMaterial ? "Edit Material" : "Create Material"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Store the organization price record. Supplier/date evidence is shown separately when the backend has it.
                </p>
              </div>
              {editingMaterial ? (
                <Button type="button" variant="outline" size="sm" onClick={startCreate}>
                  <X className="size-4" aria-hidden="true" />
                  Cancel
                </Button>
              ) : null}
            </div>

            <form onSubmit={handleSubmit} className="mt-4 grid gap-3 md:grid-cols-5">
              <Field label="SKU">
                <Input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} placeholder="CONC-4000" />
              </Field>
              <Field label="Name" className="md:col-span-2">
                <Input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Ready Mix Concrete"
                  required
                />
              </Field>
              <Field label="Unit">
                <Input
                  value={form.unitOfMeasure}
                  onChange={(event) => setForm({ ...form, unitOfMeasure: event.target.value })}
                  placeholder="CY"
                  required
                />
              </Field>
              <Field label="Unit Cost">
                <Input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={form.unitCost}
                  onChange={(event) => setForm({ ...form, unitCost: event.target.value })}
                  placeholder="150.00"
                  required
                />
              </Field>
              <Field label="Waste Factor" className="md:col-span-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.wasteFactorPct}
                  onChange={(event) => setForm({ ...form, wasteFactorPct: event.target.value })}
                />
              </Field>
              <div className="flex items-end md:col-span-3">
                <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                  {editingMaterial ? <Check className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
                  {saving ? "Saving" : editingMaterial ? "Save Material" : "Add Material"}
                </Button>
              </div>
            </form>
            {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
          </section>
        </details>
      ) : (
        <div className="rounded-lg border border-border/70 bg-card p-4 text-sm text-muted-foreground">
          You have read-only Costbook access. Material create and edit controls are hidden for this role.
        </div>
      )}

      {materials.length === 0 ? (
        <EmptyState
          title="No materials yet"
          description={canWrite ? "Add the first material to start building this organization's Costbook catalog." : "Materials will appear here after a Costbook writer creates them."}
        />
      ) : (
        <section className="overflow-hidden rounded-xl border border-border/70 bg-card" aria-label="Materials catalog">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="sticky top-16 z-10 border-b border-border bg-card text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Material</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Current price</th>
                  <th scope="col" className="px-4 py-3 font-medium">Source + date</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  {canWrite ? <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {materials.map((material) => (
                  <tr key={material.id} className="align-top transition-colors hover:bg-muted/30">
                    <td className="px-4 py-4">
                      <p className="font-medium text-foreground">{material.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {material.unitOfMeasure} · SKU {material.sku ?? "unassigned"} · {material.wasteFactorPct}% waste
                      </p>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className="font-mono font-semibold tabular-nums text-foreground">{formatCurrency(material.unitCost)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">/ {material.unitOfMeasure}</p>
                    </td>
                    <td className="px-4 py-4">
                      <PricingProvenance
                        mode="catalog"
                        supplierName={material.supplierName}
                        lastPriceUpdate={material.lastPriceUpdate}
                        compact
                      />
                    </td>
                    <td className="px-4 py-4"><StatusPill active={material.isActive} /></td>
                    {canWrite ? (
                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => startEdit(material)}>
                            <Pencil className="size-4" aria-hidden="true" />
                            Edit
                          </Button>
                          {canManage && material.isActive ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => handleDeactivate(material.id)} disabled={saving}>
                              <Ban className="size-4" aria-hidden="true" />
                              Deactivate
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid divide-y divide-border/70 md:hidden">
            {materials.map((material) => (
              <article key={material.id} className="grid gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-foreground">{material.name}</h2>
                      <StatusPill active={material.isActive} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {material.unitOfMeasure} · SKU {material.sku ?? "unassigned"} · {material.wasteFactorPct}% waste
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-base font-semibold tabular-nums text-foreground">{formatCurrency(material.unitCost)}</div>
                    <div className="text-xs text-muted-foreground">/ {material.unitOfMeasure}</div>
                  </div>
                </div>

                <PricingProvenance
                  mode="catalog"
                  supplierName={material.supplierName}
                  lastPriceUpdate={material.lastPriceUpdate}
                  compact
                />

                {canWrite ? (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => startEdit(material)}>
                      <Pencil className="size-4" aria-hidden="true" />
                      Edit
                    </Button>
                    {canManage && material.isActive ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => handleDeactivate(material.id)} disabled={saving}>
                        <Ban className="size-4" aria-hidden="true" />
                        Deactivate
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={className}>
      <span className="mb-1 block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

function toPayload(form: MaterialFormState): CostbookMaterialInput {
  return {
    sku: form.sku.trim() || null,
    name: form.name.trim(),
    unitOfMeasure: form.unitOfMeasure.trim(),
    unitCost: Number(form.unitCost),
    wasteFactorPct: Number(form.wasteFactorPct || 0),
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function sortMaterials(materials: CostbookMaterial[]): CostbookMaterial[] {
  return [...materials].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.name.localeCompare(b.name) || (a.sku ?? "").localeCompare(b.sku ?? "");
  });
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${active ? "border-success/30 bg-success/10 text-success" : "border-border/70 bg-muted text-muted-foreground"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}
