"use client";

import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createEquipmentCatalogRecord,
  deleteEquipmentCatalogRecord,
  getEquipmentCatalogCapabilities,
  updateEquipmentCatalogRecord,
  type EquipmentCatalogPayload,
  type EquipmentCatalogRecord,
} from "@/components/costbook/equipment-catalog-actions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { clientFetch } from "@/lib/clientApi";

type EquipmentFormState = {
  name: string;
  ownershipCostPerHour: string;
  operatingCostPerHour: string;
  dailyRate: string;
};

const emptyForm: EquipmentFormState = {
  name: "",
  ownershipCostPerHour: "",
  operatingCostPerHour: "",
  dailyRate: "",
};

/** Renders permission-aware Costbook equipment CRUD without allowing edit changes during pending mutations. */
export function EquipmentCatalog({
  initialEquipment,
  canWrite,
  canManage,
}: {
  initialEquipment: EquipmentCatalogRecord[];
  canWrite: boolean;
  canManage: boolean;
}) {
  const [equipment, setEquipment] = useState(initialEquipment);
  const [form, setForm] = useState<EquipmentFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const capabilities = getEquipmentCatalogCapabilities(canWrite, canManage);

  const editingEquipment = useMemo(
    () => equipment.find((item) => item.id === editingId) ?? null,
    [editingId, equipment]
  );

  /** Returns the form to create mode unless a save or delete currently owns the form state. */
  function startCreate() {
    if (saving) return;
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  /** Populates the form from one equipment record unless a mutation is already pending. */
  function startEdit(item: EquipmentCatalogRecord) {
    if (saving) return;
    setEditingId(item.id);
    setForm({
      name: item.name,
      ownershipCostPerHour: String(item.ownershipCostPerHour),
      operatingCostPerHour: String(item.operatingCostPerHour),
      dailyRate: item.dailyRate == null ? "" : String(item.dailyRate),
    });
    setError(null);
  }

  /** Creates or updates one equipment record while the form and edit transitions are locked. */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload = toPayload(form);
    try {
      const saved = editingId
        ? await updateEquipmentCatalogRecord(clientFetch, editingId, payload)
        : await createEquipmentCatalogRecord(clientFetch, payload);

      setEquipment((current) => {
        const next = editingId
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [...current, saved];
        return sortEquipment(next);
      });
      setEditingId(null);
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Equipment could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  /** Permanently deletes one equipment record while other form transitions remain locked. */
  async function handleDelete(id: string) {
    if (!window.confirm("Permanently delete this equipment record?")) return;

    setSaving(true);
    setError(null);

    try {
      await deleteEquipmentCatalogRecord(clientFetch, id);
      setEquipment((current) => current.filter((item) => item.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Equipment could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      {capabilities.canCreate ? (
        <section className="rounded-lg border border-border/70 bg-card p-4" aria-label={editingEquipment ? "Edit equipment" : "Create equipment"}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">{editingEquipment ? "Edit Equipment" : "Create Equipment"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Manage basic organization-scoped equipment catalog records for future estimating workflows.</p>
            </div>
            {editingEquipment ? (
              <Button type="button" variant="outline" size="sm" onClick={startCreate} disabled={saving}>
                <X className="size-4" aria-hidden="true" />
                Cancel
              </Button>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="mt-4 grid gap-3 md:grid-cols-4">
            <Field label="Name" className="md:col-span-2">
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Scissor Lift"
                required
                disabled={saving}
              />
            </Field>
            <Field label="Ownership Cost">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.ownershipCostPerHour}
                onChange={(event) => setForm({ ...form, ownershipCostPerHour: event.target.value })}
                placeholder="28.50"
                required
                disabled={saving}
              />
            </Field>
            <Field label="Operating Cost">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.operatingCostPerHour}
                onChange={(event) => setForm({ ...form, operatingCostPerHour: event.target.value })}
                placeholder="11.25"
                required
                disabled={saving}
              />
            </Field>
            <Field label="Daily Rate" className="md:col-span-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.dailyRate}
                onChange={(event) => setForm({ ...form, dailyRate: event.target.value })}
                placeholder="325.00"
                disabled={saving}
              />
            </Field>
            <div className="flex items-end md:col-span-2">
              <Button type="submit" disabled={saving} className="w-full">
                {editingEquipment ? <Check className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
                {saving ? "Saving" : editingEquipment ? "Save Equipment" : "Add Equipment"}
              </Button>
            </div>
          </form>
          {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
        </section>
      ) : (
        <div className="rounded-lg border border-border/70 bg-card p-4 text-sm text-muted-foreground">
          You have read-only Costbook access. Equipment create and edit controls are hidden for this role.
        </div>
      )}

      {equipment.length === 0 ? (
        <EmptyState
          title="No equipment yet"
          description="Add equipment to prepare Costbook for estimating workflows."
        />
      ) : (
        <section className="overflow-hidden rounded-lg border border-border/70 bg-card" aria-label="Equipment catalog">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Name</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Ownership</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Operating</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Hourly</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Daily</th>
                  {capabilities.showActions ? <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {equipment.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatCurrency(item.ownershipCostPerHour)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatCurrency(item.operatingCostPerHour)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatCurrency(item.hourlyCost)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{item.dailyRate == null ? "Not set" : formatCurrency(item.dailyRate)}</td>
                    {capabilities.showActions ? (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {capabilities.canEdit ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => startEdit(item)} disabled={saving}>
                              <Pencil className="size-4" aria-hidden="true" />
                              Edit
                            </Button>
                          ) : null}
                          {capabilities.canDelete ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => handleDelete(item.id)} disabled={saving}>
                              <Trash2 className="size-4" aria-hidden="true" />
                              Delete
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
            {equipment.map((item) => (
              <article key={item.id} className="grid gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">{item.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Hourly total {formatCurrency(item.hourlyCost)}</p>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <Metric label="Ownership" value={formatCurrency(item.ownershipCostPerHour)} />
                  <Metric label="Operating" value={formatCurrency(item.operatingCostPerHour)} />
                  <Metric label="Daily" value={item.dailyRate == null ? "Not set" : formatCurrency(item.dailyRate)} />
                  <Metric label="Updated" value={formatDate(item.updatedAt)} />
                </dl>
                <div className="flex gap-2">
                  {capabilities.canEdit ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => startEdit(item)} disabled={saving}>
                      <Pencil className="size-4" aria-hidden="true" />
                      Edit
                    </Button>
                  ) : null}
                  {capabilities.canDelete ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => handleDelete(item.id)} disabled={saving}>
                      <Trash2 className="size-4" aria-hidden="true" />
                      Delete
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Renders a labeled equipment form field. */
function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={className}>
      <span className="mb-1 block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

/** Renders a compact equipment metric pair for the mobile catalog view. */
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-foreground">{value}</dd>
    </div>
  );
}

/** Converts string form fields into the equipment API mutation payload. */
function toPayload(form: EquipmentFormState): EquipmentCatalogPayload {
  return {
    name: form.name.trim(),
    ownershipCostPerHour: Number(form.ownershipCostPerHour),
    operatingCostPerHour: Number(form.operatingCostPerHour),
    dailyRate: form.dailyRate.trim() ? Number(form.dailyRate) : null,
  };
}

/** Returns equipment records in stable name/creation order. */
function sortEquipment(items: EquipmentCatalogRecord[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name) || a.createdAt.localeCompare(b.createdAt));
}

/** Formats equipment money values in US dollars. */
function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

/** Formats equipment update timestamps for compact display. */
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
