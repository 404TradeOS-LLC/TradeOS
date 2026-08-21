import type { Metadata } from "next";
import { Layers } from "lucide-react";
import { HierarchyCatalog } from "@/components/costbook/hierarchy-catalog";
import { CatalogQueryControls } from "@/components/costbook/catalog-query-controls";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ApiClientError,
  getCostbookWorkspace,
  listCostbookCategories,
  listCostbookDivisions,
  listCostbookSubcategories,
  type CostbookCategory,
  type CostbookDivision,
  type CostbookSubcategory,
  type CostbookWorkspaceSummary,
} from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export const metadata: Metadata = {
  title: "Divisions | TradeOS",
  description: "Manage the organization-scoped Costbook Division / Category / Subcategory hierarchy with authenticated TradeOS permissions.",
};

function toErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  return "Unable to load the Costbook hierarchy from the backend.";
}

type HierarchyQuery = { q?: string; sort?: string; order?: "asc" | "desc"; active?: string; divisionCursor?: string; categoryCursor?: string; subcategoryCursor?: string };

export default async function CostbookDivisionsPage({ searchParams }: { searchParams: Promise<HierarchyQuery> }) {
  const token = await getSessionToken();
  const query = await searchParams;
  let workspace: CostbookWorkspaceSummary | null = null;
  let divisions: CostbookDivision[] = [];
  let categories: CostbookCategory[] = [];
  let subcategories: CostbookSubcategory[] = [];
  let divisionPage = { total: 0, nextCursor: null as string | null };
  let categoryPage = { total: 0, nextCursor: null as string | null };
  let subcategoryPage = { total: 0, nextCursor: null as string | null };
  let loadError: string | null = null;

  if (!token) {
    loadError = "You need to be signed in to view the Costbook hierarchy.";
  } else {
    try {
      const [loadedWorkspace, loadedDivisions, loadedCategories, loadedSubcategories] = await Promise.all([
        getCostbookWorkspace(token),
        listCostbookDivisions(token, { limit: 100, cursor: query.divisionCursor, q: query.q, sort: query.sort, order: query.order, active: query.active === undefined ? undefined : query.active === "true" }),
        listCostbookCategories(token, { limit: 100, cursor: query.categoryCursor, q: query.q, sort: query.sort, order: query.order, active: query.active === undefined ? undefined : query.active === "true" }),
        listCostbookSubcategories(token, { limit: 100, cursor: query.subcategoryCursor, q: query.q, sort: query.sort, order: query.order, active: query.active === undefined ? undefined : query.active === "true" }),
      ]);
      workspace = loadedWorkspace;
      divisions = loadedDivisions.items;
      categories = loadedCategories.items;
      subcategories = loadedSubcategories.items;
      divisionPage = { total: loadedDivisions.total, nextCursor: loadedDivisions.nextCursor };
      categoryPage = { total: loadedCategories.total, nextCursor: loadedCategories.nextCursor };
      subcategoryPage = { total: loadedSubcategories.total, nextCursor: loadedSubcategories.nextCursor };
    } catch (error) {
      loadError = toErrorMessage(error);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Divisions"
        description="Division, Category, and Subcategory hierarchy for the Costbook catalog."
        backHref="/costbook"
        backLabel="Costbook"
      />

      {loadError ? (
        <EmptyState title="Couldn't load the Costbook hierarchy" description={loadError} />
      ) : workspace ? (
        <>
          <section className="grid gap-4 sm:grid-cols-3" aria-label="Hierarchy summary">
            <div className="rounded-lg border border-border/70 bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Divisions in result</p>
                  <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-foreground">{divisionPage.total}</p>
                </div>
                <Layers className="size-5 text-muted-foreground" aria-hidden="true" />
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-surface p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Write Access</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{workspace.permissions.canWrite ? "Enabled" : "Read Only"}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-surface p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Scope</p>
              <p className="mt-2 truncate text-sm font-medium text-foreground">{workspace.organizationId}</p>
            </div>
          </section>

          <div className="grid gap-3">
            <CatalogQueryControls pathname="/costbook/divisions" query={{ q: query.q, sort: query.sort, order: query.order, active: query.active }} total={divisionPage.total} shown={divisions.length} nextCursor={divisionPage.nextCursor} cursorParam="divisionCursor" sortOptions={[{ value: "name", label: "Name" }, { value: "code", label: "Code" }, { value: "sortOrder", label: "Display order" }]} filters={[{ name: "active", label: "Status", value: query.active, options: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }] }]} />
            <CatalogQueryControls pathname="/costbook/divisions" query={{ q: query.q, sort: query.sort, order: query.order, active: query.active }} total={categoryPage.total} shown={categories.length} nextCursor={categoryPage.nextCursor} cursorParam="categoryCursor" sortOptions={[{ value: "name", label: "Name" }, { value: "code", label: "Code" }, { value: "sortOrder", label: "Display order" }]} />
            <CatalogQueryControls pathname="/costbook/divisions" query={{ q: query.q, sort: query.sort, order: query.order, active: query.active }} total={subcategoryPage.total} shown={subcategories.length} nextCursor={subcategoryPage.nextCursor} cursorParam="subcategoryCursor" sortOptions={[{ value: "name", label: "Name" }, { value: "code", label: "Code" }, { value: "sortOrder", label: "Display order" }]} />
          </div>
          <HierarchyCatalog
            initialDivisions={divisions}
            initialCategories={categories}
            initialSubcategories={subcategories}
            canWrite={workspace.permissions.canWrite}
            canManage={workspace.permissions.canManage}
          />
        </>
      ) : null}
    </div>
  );
}
