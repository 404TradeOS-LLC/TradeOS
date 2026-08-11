"use client";

import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import { Ban, Check, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { clientFetch } from "@/lib/clientApi";
import type { CostbookLaborRate, CostbookLaborRateInput } from "@/lib/api";

type LaborRateFormState = {
  role: string;
  description: string;
  hourlyCost: string;
  billRate: string;
};

const emptyForm: LaborRateFormState = {
  role: "",
  description: "",
  hourlyCost: "",
  billRate: "",
};

export function LaborRatesCatalog({
  initialLaborRates,
  canWrite,
  canManage,
}: {
  initialLaborRates: CostbookLaborRate[];
  canWrite: boolean;
  canManage: boolean;
}) {
  const [laborRates, setLaborRates] = useState(initialLaborRates);
  const [form, setForm] = useState<LaborRateFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editingRate = useMemo(
    () => laborRates.find((laborRate) => laborRate.id === editingId) ?? null,
    [editingId, laborRates]
  );

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  function startEdit(laborRate: CostbookLaborRate) {
    setEditingId(laborRate.id);
    setForm({
      role: laborRate.role,
      description: laborRate.description ?? "",
      hourlyCost: String(laborRate.hourlyCost),
      billRate: String(laborRate.billRate),
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
        ? await clientFetch<CostbookLaborRate>(`/costbook/labor-rates/${editingId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await clientFetch<CostbookLaborRate>("/costbook/labor-rates", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      setLaborRates((current) => {
        const next = editingId
          ? current.map((laborRate) => (laborRate.id === saved.id ? saved : laborRate))
          : [...current, saved];
        return sortLaborRates(next);
      });
      setEditingId(null);
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Labor rate could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string) {
    setSaving(true);
    setError(null);

    try {
      await clientFetch<void>(`/costbook/labor-rates/${id}`, { method: "DELETE" });
      setLaborRates((current) => sortLaborRates(current.map((laborRate) => (
        laborRate.id === id
          ? { ...laborRate, active: false, updatedAt: new Date().toISOString() }
          : laborRate
      ))));
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Labor rate could not be deactivated.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      {canWrite ? (
        <section className="rounded-lg border border-border/70 bg-surface p-4" aria-label={editingRate ? "Edit labor rate" : "Create labor rate"}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">{editingRate ? "Edit Labor Rate" : "Create Labor Rate"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Manage basic organization-scoped labor-rate records for future estimating workflows.</p>
            </div>
            {editingRate ? (
              <Button type="button" variant="outline" size="sm" onClick={startCreate}>
                <X className="size-4" aria-hidden="true" />
                Cancel
              </Button>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="mt-4 grid gap-3 md:grid-cols-4">
            <Field label="Role" className="md:col-span-2">
              <Input
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value })}
                placeholder="Lead Carpenter"
                required
              />
            </Field>
            <Field label="Hourly Cost">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.hourlyCost}
                onChange={(event) => setForm({ ...form, hourlyCost: event.target.value })}
                placeholder="45.00"
                required
              />
            </Field>
            <Field label="Bill Rate">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.billRate}
                onChange={(event) => setForm({ ...form, billRate: event.target.value })}
                placeholder="85.00"
                required
              />
            </Field>
            <Field label="Description" className="md:col-span-3">
              <Input
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Finish trim and punch-list labor"
              />
            </Field>
            <div className="flex items-end md:col-span-1">
              <Button type="submit" disabled={saving} className="w-full">
                {editingRate ? <Check className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
                {saving ? "Saving" : editingRate ? "Save Labor Rate" : "Add Labor Rate"}
              </Button>
            </div>
          </form>
          {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
        </section>
      ) : (
        <div className="rounded-lg border border-border/70 bg-surface p-4 text-sm text-muted-foreground">
          You have read-only Costbook access. Labor-rate create and edit controls are hidden for this role.
        </div>
      )}

      {laborRates.length === 0 ? (
        <EmptyState
          title="No labor rates yet"
          description="Add labor rates to prepare Costbook for estimating workflows."
        />
      ) : (
        <section className="overflow-hidden rounded-lg border border-border/70 bg-surface" aria-label="Labor rates catalog">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Role</th>
                  <th scope="col" className="px-4 py-3 font-medium">Description</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Hourly Cost</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Bill Rate</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  {(canWrite || canManage) ? <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {laborRates.map((laborRate) => (
                  <tr key={laborRate.id}>
                    <td className="px-4 py-3 font-medium text-foreground">{laborRate.role}</td>
                    <td className="px-4 py-3 text-muted-foreground">{laborRate.description ?? "No description"}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatCurrency(laborRate.hourlyCost)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatCurrency(laborRate.billRate)}</td>
                    <td className="px-4 py-3">
                      <StatusPill active={laborRate.active} />
                    </td>
                    {(canWrite || canManage) ? (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {canWrite ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => startEdit(laborRate)}>
                              <Pencil className="size-4" aria-hidden="true" />
                              Edit
                            </Button>
                          ) : null}
                          {canManage && laborRate.active ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => handleDeactivate(laborRate.id)} disabled={saving}>
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
            {laborRates.map((laborRate) => (
              <article key={laborRate.id} className="grid gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">{laborRate.role}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{laborRate.description ?? "No description"}</p>
                  </div>
                  <StatusPill active={laborRate.active} />
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <Metric label="Hourly Cost" value={formatCurrency(laborRate.hourlyCost)} />
                  <Metric label="Bill Rate" value={formatCurrency(laborRate.billRate)} />
                  <Metric label="Updated" value={formatDate(laborRate.updatedAt)} />
                  <Metric label="Scope" value={laborRate.organizationId} />
                </dl>
                <div className="flex gap-2">
                  {canWrite ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => startEdit(laborRate)}>
                      <Pencil className="size-4" aria-hidden="true" />
                      Edit
                    </Button>
                  ) : null}
                  {canManage && laborRate.active ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => handleDeactivate(laborRate.id)} disabled={saving}>
                      <Ban className="size-4" aria-hidden="true" />
                      Deactivate
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
      <dd className="mt-1 break-words text-foreground">{value}</dd>
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-border/70 bg-muted text-muted-foreground"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function toPayload(form: LaborRateFormState): CostbookLaborRateInput {
  return {
    role: form.role.trim(),
    description: form.description.trim() || null,
    hourlyCost: Number(form.hourlyCost),
    billRate: Number(form.billRate),
  };
}

function sortLaborRates(laborRates: CostbookLaborRate[]) {
  return [...laborRates].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.role.localeCompare(b.role) || a.createdAt.localeCompare(b.createdAt);
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
