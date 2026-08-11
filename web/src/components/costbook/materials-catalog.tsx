"use client";

import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
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
}: {
  initialMaterials: CostbookMaterial[];
  canWrite: boolean;
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
        return next.sort((a, b) => a.name.localeCompare(b.name) || (a.sku ?? "").localeCompare(b.sku ?? ""));
      });
      setEditingId(null);
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Material could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      {canWrite ? (
        <section className="rounded-lg border border-border/70 bg-surface p-4" aria-label={editingMaterial ? "Edit material" : "Create material"}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">{editingMaterial ? "Edit Material" : "Create Material"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Manage basic organization-scoped material catalog records.</p>
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
      ) : (
        <div className="rounded-lg border border-border/70 bg-surface p-4 text-sm text-muted-foreground">
          You have read-only Costbook access. Material create and edit controls are hidden for this role.
        </div>
      )}

      {materials.length === 0 ? (
        <EmptyState
          title="No materials yet"
          description={canWrite ? "Add the first material to start building this organization's Costbook catalog." : "Materials will appear here after a Costbook writer creates them."}
        />
      ) : (
        <section className="overflow-hidden rounded-lg border border-border/70 bg-surface" aria-label="Materials catalog">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Material</th>
                  <th scope="col" className="px-4 py-3 font-medium">SKU</th>
                  <th scope="col" className="px-4 py-3 font-medium">Unit</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Unit Cost</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Waste</th>
                  <th scope="col" className="px-4 py-3 font-medium">Supplier</th>
                  {canWrite ? <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {materials.map((material) => (
                  <tr key={material.id}>
                    <td className="px-4 py-3 font-medium text-foreground">{material.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{material.sku ?? "Unassigned"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{material.unitOfMeasure}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatCurrency(material.unitCost)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{material.wasteFactorPct}%</td>
                    <td className="px-4 py-3 text-muted-foreground">{material.supplierName ?? "None"}</td>
                    {canWrite ? (
                      <td className="px-4 py-3 text-right">
                        <Button type="button" variant="outline" size="sm" onClick={() => startEdit(material)}>
                          <Pencil className="size-4" aria-hidden="true" />
                          Edit
                        </Button>
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
                  <div>
                    <h2 className="text-base font-semibold text-foreground">{material.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{material.sku ?? "Unassigned SKU"}</p>
                  </div>
                  <div className="text-right font-mono text-sm font-semibold tabular-nums">{formatCurrency(material.unitCost)}</div>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <Metric label="Unit" value={material.unitOfMeasure} />
                  <Metric label="Waste" value={`${material.wasteFactorPct}%`} />
                  <Metric label="Supplier" value={material.supplierName ?? "None"} />
                  <Metric label="Updated" value={formatDate(material.updatedAt)} />
                </dl>
                {canWrite ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => startEdit(material)}>
                    <Pencil className="size-4" aria-hidden="true" />
                    Edit
                  </Button>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-foreground">{value}</dd>
    </div>
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
