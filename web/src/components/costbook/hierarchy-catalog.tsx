"use client";

import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import { Ban, ChevronDown, ChevronRight, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { clientFetch } from "@/lib/clientApi";
import type { CostbookCategory, CostbookDivision, CostbookSubcategory } from "@/lib/api";

type HierarchyFormState = {
  code: string;
  name: string;
};

const emptyForm: HierarchyFormState = { code: "", name: "" };

export function HierarchyCatalog({
  initialDivisions,
  initialCategories,
  initialSubcategories,
  canWrite,
  canManage,
}: {
  initialDivisions: CostbookDivision[];
  initialCategories: CostbookCategory[];
  initialSubcategories: CostbookSubcategory[];
  canWrite: boolean;
  canManage: boolean;
}) {
  const [divisions, setDivisions] = useState(initialDivisions);
  const [categories, setCategories] = useState(initialCategories);
  const [subcategories, setSubcategories] = useState(initialSubcategories);

  const [expandedDivisions, setExpandedDivisions] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const [creatingDivision, setCreatingDivision] = useState(false);
  const [creatingCategoryFor, setCreatingCategoryFor] = useState<string | null>(null);
  const [creatingSubcategoryFor, setCreatingSubcategoryFor] = useState<string | null>(null);

  const [editingDivisionId, setEditingDivisionId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingSubcategoryId, setEditingSubcategoryId] = useState<string | null>(null);

  const [form, setForm] = useState<HierarchyFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoriesByDivision = useMemo(() => groupBy(categories, (category) => category.divisionId), [categories]);
  const subcategoriesByCategory = useMemo(() => groupBy(subcategories, (subcategory) => subcategory.categoryId), [subcategories]);

  function toggleDivision(id: string) {
    setExpandedDivisions((current) => toggleSet(current, id));
  }

  function toggleCategory(id: string) {
    setExpandedCategories((current) => toggleSet(current, id));
  }

  function resetInlineState() {
    setCreatingDivision(false);
    setCreatingCategoryFor(null);
    setCreatingSubcategoryFor(null);
    setEditingDivisionId(null);
    setEditingCategoryId(null);
    setEditingSubcategoryId(null);
    setForm(emptyForm);
    setError(null);
  }

  async function handleCreateDivision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await clientFetch<CostbookDivision>("/costbook/divisions", {
        method: "POST",
        body: JSON.stringify({ code: form.code.trim(), name: form.name.trim() }),
      });
      setDivisions((current) => sortHierarchy([...current, created]));
      resetInlineState();
    } catch (err) {
      setError(errorMessage(err, "Division could not be created."));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateDivision(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await clientFetch<CostbookDivision>(`/costbook/divisions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ code: form.code.trim(), name: form.name.trim() }),
      });
      setDivisions((current) => sortHierarchy(current.map((row) => (row.id === id ? updated : row))));
      resetInlineState();
    } catch (err) {
      setError(errorMessage(err, "Division could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivateDivision(id: string) {
    setSaving(true);
    setError(null);
    try {
      await clientFetch<void>(`/costbook/divisions/${id}`, { method: "DELETE" });
      setDivisions((current) => sortHierarchy(current.map((row) => (row.id === id ? { ...row, isActive: false } : row))));
    } catch (err) {
      setError(errorMessage(err, "Division could not be deactivated."));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateCategory(event: FormEvent<HTMLFormElement>, divisionId: string) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await clientFetch<CostbookCategory>("/costbook/categories", {
        method: "POST",
        body: JSON.stringify({ divisionId, code: form.code.trim(), name: form.name.trim() }),
      });
      setCategories((current) => sortHierarchy([...current, created]));
      resetInlineState();
      setExpandedDivisions((current) => new Set(current).add(divisionId));
    } catch (err) {
      setError(errorMessage(err, "Category could not be created."));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateCategory(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await clientFetch<CostbookCategory>(`/costbook/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ code: form.code.trim(), name: form.name.trim() }),
      });
      setCategories((current) => sortHierarchy(current.map((row) => (row.id === id ? updated : row))));
      resetInlineState();
    } catch (err) {
      setError(errorMessage(err, "Category could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivateCategory(id: string) {
    setSaving(true);
    setError(null);
    try {
      await clientFetch<void>(`/costbook/categories/${id}`, { method: "DELETE" });
      setCategories((current) => sortHierarchy(current.map((row) => (row.id === id ? { ...row, isActive: false } : row))));
    } catch (err) {
      setError(errorMessage(err, "Category could not be deactivated."));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateSubcategory(event: FormEvent<HTMLFormElement>, categoryId: string) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await clientFetch<CostbookSubcategory>("/costbook/subcategories", {
        method: "POST",
        body: JSON.stringify({ categoryId, code: form.code.trim(), name: form.name.trim() }),
      });
      setSubcategories((current) => sortHierarchy([...current, created]));
      resetInlineState();
      setExpandedCategories((current) => new Set(current).add(categoryId));
    } catch (err) {
      setError(errorMessage(err, "Subcategory could not be created."));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateSubcategory(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await clientFetch<CostbookSubcategory>(`/costbook/subcategories/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ code: form.code.trim(), name: form.name.trim() }),
      });
      setSubcategories((current) => sortHierarchy(current.map((row) => (row.id === id ? updated : row))));
      resetInlineState();
    } catch (err) {
      setError(errorMessage(err, "Subcategory could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivateSubcategory(id: string) {
    setSaving(true);
    setError(null);
    try {
      await clientFetch<void>(`/costbook/subcategories/${id}`, { method: "DELETE" });
      setSubcategories((current) => sortHierarchy(current.map((row) => (row.id === id ? { ...row, isActive: false } : row))));
    } catch (err) {
      setError(errorMessage(err, "Subcategory could not be deactivated."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
      ) : null}

      {canWrite ? (
        <div>
          {creatingDivision ? (
            <HierarchyForm
              title="Create Division"
              form={form}
              setForm={setForm}
              saving={saving}
              error={null}
              onCancel={resetInlineState}
              onSubmit={handleCreateDivision}
              submitLabel="Add Division"
            />
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => { resetInlineState(); setCreatingDivision(true); }}>
              <Plus className="size-4" aria-hidden="true" />
              Add Division
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border/70 bg-surface p-4 text-sm text-muted-foreground">
          You have read-only Costbook access. Hierarchy create and edit controls are hidden for this role.
        </div>
      )}

      {divisions.length === 0 ? (
        <EmptyState
          title="No divisions yet"
          description="Add divisions to organize the Costbook catalog into trade groupings."
        />
      ) : (
        <section className="grid gap-3" aria-label="Division hierarchy">
          {divisions.map((division) => {
            const divisionCategories = categoriesByDivision.get(division.id) ?? [];
            const isExpanded = expandedDivisions.has(division.id);

            return (
              <div key={division.id} className="overflow-hidden rounded-lg border border-border/70 bg-surface">
                {editingDivisionId === division.id ? (
                  <div className="p-4">
                    <HierarchyForm
                      title="Edit Division"
                      form={form}
                      setForm={setForm}
                      saving={saving}
                      error={null}
                      onCancel={resetInlineState}
                      onSubmit={(event) => handleUpdateDivision(event, division.id)}
                      submitLabel="Save Division"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 p-4">
                    <button
                      type="button"
                      onClick={() => toggleDivision(division.id)}
                      className="flex flex-1 items-center gap-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-semibold text-foreground">{division.name}</h2>
                          <StatusPill active={division.isActive} />
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">{division.code} · {divisionCategories.length} {divisionCategories.length === 1 ? "category" : "categories"}</p>
                      </div>
                    </button>
                    {canWrite ? (
                      <div className="flex shrink-0 gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => startEditDivision(division)}>
                          <Pencil className="size-4" aria-hidden="true" />
                          Edit
                        </Button>
                        {canManage && division.isActive ? (
                          <Button type="button" variant="outline" size="sm" onClick={() => handleDeactivateDivision(division.id)} disabled={saving}>
                            <Ban className="size-4" aria-hidden="true" />
                            Deactivate
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}

                {isExpanded ? (
                  <div className="border-t border-border/70 bg-muted/10 p-4 pl-8">
                    {canWrite ? (
                      creatingCategoryFor === division.id ? (
                        <HierarchyForm
                          title="Create Category"
                          form={form}
                          setForm={setForm}
                          saving={saving}
                          error={null}
                          onCancel={resetInlineState}
                          onSubmit={(event) => handleCreateCategory(event, division.id)}
                          submitLabel="Add Category"
                        />
                      ) : (
                        <Button type="button" variant="outline" size="sm" onClick={() => { resetInlineState(); setCreatingCategoryFor(division.id); }}>
                          <Plus className="size-4" aria-hidden="true" />
                          Add Category
                        </Button>
                      )
                    ) : null}

                    {divisionCategories.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">No categories yet for this division.</p>
                    ) : (
                      <div className="mt-3 grid gap-2">
                        {divisionCategories.map((category) => {
                          const categorySubcategories = subcategoriesByCategory.get(category.id) ?? [];
                          const categoryExpanded = expandedCategories.has(category.id);

                          return (
                            <div key={category.id} className="overflow-hidden rounded-md border border-border/60 bg-surface">
                              {editingCategoryId === category.id ? (
                                <div className="p-3">
                                  <HierarchyForm
                                    title="Edit Category"
                                    form={form}
                                    setForm={setForm}
                                    saving={saving}
                                    error={null}
                                    onCancel={resetInlineState}
                                    onSubmit={(event) => handleUpdateCategory(event, category.id)}
                                    submitLabel="Save Category"
                                  />
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-3 p-3">
                                  <button
                                    type="button"
                                    onClick={() => toggleCategory(category.id)}
                                    className="flex flex-1 items-center gap-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                                    aria-expanded={categoryExpanded}
                                  >
                                    {categoryExpanded ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-semibold text-foreground">{category.name}</h3>
                                        <StatusPill active={category.isActive} />
                                      </div>
                                      <p className="mt-0.5 text-xs text-muted-foreground">{category.code} · {categorySubcategories.length} {categorySubcategories.length === 1 ? "subcategory" : "subcategories"}</p>
                                    </div>
                                  </button>
                                  {canWrite ? (
                                    <div className="flex shrink-0 gap-2">
                                      <Button type="button" variant="outline" size="sm" onClick={() => startEditCategory(category)}>
                                        <Pencil className="size-4" aria-hidden="true" />
                                        Edit
                                      </Button>
                                      {canManage && category.isActive ? (
                                        <Button type="button" variant="outline" size="sm" onClick={() => handleDeactivateCategory(category.id)} disabled={saving}>
                                          <Ban className="size-4" aria-hidden="true" />
                                          Deactivate
                                        </Button>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              )}

                              {categoryExpanded ? (
                                <div className="border-t border-border/60 bg-muted/10 p-3 pl-8">
                                  {canWrite ? (
                                    creatingSubcategoryFor === category.id ? (
                                      <HierarchyForm
                                        title="Create Subcategory"
                                        form={form}
                                        setForm={setForm}
                                        saving={saving}
                                        error={null}
                                        onCancel={resetInlineState}
                                        onSubmit={(event) => handleCreateSubcategory(event, category.id)}
                                        submitLabel="Add Subcategory"
                                      />
                                    ) : (
                                      <Button type="button" variant="outline" size="sm" onClick={() => { resetInlineState(); setCreatingSubcategoryFor(category.id); }}>
                                        <Plus className="size-4" aria-hidden="true" />
                                        Add Subcategory
                                      </Button>
                                    )
                                  ) : null}

                                  {categorySubcategories.length === 0 ? (
                                    <p className="mt-3 text-sm text-muted-foreground">No subcategories yet for this category.</p>
                                  ) : (
                                    <ul className="mt-3 grid gap-2">
                                      {categorySubcategories.map((subcategory) => (
                                        <li key={subcategory.id} className="rounded-md border border-border/60 bg-surface p-3">
                                          {editingSubcategoryId === subcategory.id ? (
                                            <HierarchyForm
                                              title="Edit Subcategory"
                                              form={form}
                                              setForm={setForm}
                                              saving={saving}
                                              error={null}
                                              onCancel={resetInlineState}
                                              onSubmit={(event) => handleUpdateSubcategory(event, subcategory.id)}
                                              submitLabel="Save Subcategory"
                                            />
                                          ) : (
                                            <div className="flex items-center justify-between gap-3">
                                              <div>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-sm font-medium text-foreground">{subcategory.name}</span>
                                                  <StatusPill active={subcategory.isActive} />
                                                </div>
                                                <p className="mt-0.5 text-xs text-muted-foreground">{subcategory.code}</p>
                                              </div>
                                              {canWrite ? (
                                                <div className="flex shrink-0 gap-2">
                                                  <Button type="button" variant="outline" size="sm" onClick={() => startEditSubcategory(subcategory)}>
                                                    <Pencil className="size-4" aria-hidden="true" />
                                                    Edit
                                                  </Button>
                                                  {canManage && subcategory.isActive ? (
                                                    <Button type="button" variant="outline" size="sm" onClick={() => handleDeactivateSubcategory(subcategory.id)} disabled={saving}>
                                                      <Ban className="size-4" aria-hidden="true" />
                                                      Deactivate
                                                    </Button>
                                                  ) : null}
                                                </div>
                                              ) : null}
                                            </div>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );

  function startEditDivision(division: CostbookDivision) {
    resetInlineState();
    setEditingDivisionId(division.id);
    setForm({ code: division.code, name: division.name });
  }

  function startEditCategory(category: CostbookCategory) {
    resetInlineState();
    setEditingCategoryId(category.id);
    setForm({ code: category.code, name: category.name });
    setExpandedDivisions((current) => new Set(current).add(category.divisionId));
  }

  function startEditSubcategory(subcategory: CostbookSubcategory) {
    resetInlineState();
    setEditingSubcategoryId(subcategory.id);
    setForm({ code: subcategory.code, name: subcategory.name });
    setExpandedCategories((current) => new Set(current).add(subcategory.categoryId));
  }
}

function HierarchyForm({
  title,
  form,
  setForm,
  saving,
  error,
  onCancel,
  onSubmit,
  submitLabel,
}: {
  title: string;
  form: HierarchyFormState;
  setForm: (form: HierarchyFormState) => void;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
}) {
  return (
    <section className="rounded-lg border border-border/70 bg-surface p-4" aria-label={title}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          <X className="size-4" aria-hidden="true" />
          Cancel
        </Button>
      </div>
      <form onSubmit={onSubmit} className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="Code">
          <Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="ELEC" required />
        </Field>
        <Field label="Name" className="sm:col-span-1">
          <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Electrical" required />
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Saving" : submitLabel}
          </Button>
        </div>
      </form>
      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
    </section>
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

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-border/70 bg-muted text-muted-foreground"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function toggleSet(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const groupKey = key(item);
    const group = map.get(groupKey);
    if (group) {
      group.push(item);
    } else {
      map.set(groupKey, [item]);
    }
  }
  return map;
}

function sortHierarchy<T extends { isActive: boolean; sortOrder: number; name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  });
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
