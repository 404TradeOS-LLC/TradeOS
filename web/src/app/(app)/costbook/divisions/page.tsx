import type { Metadata } from "next";
import { Layers } from "lucide-react";
import { HierarchyCatalog } from "@/components/costbook/hierarchy-catalog";
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

export default async function CostbookDivisionsPage() {
  const token = await getSessionToken();
  let workspace: CostbookWorkspaceSummary | null = null;
  let divisions: CostbookDivision[] = [];
  let categories: CostbookCategory[] = [];
  let subcategories: CostbookSubcategory[] = [];
  let loadError: string | null = null;

  if (!token) {
    loadError = "You need to be signed in to view the Costbook hierarchy.";
  } else {
    try {
      [workspace, divisions, categories, subcategories] = await Promise.all([
        getCostbookWorkspace(token),
        listCostbookDivisions(token),
        listCostbookCategories(token),
        listCostbookSubcategories(token),
      ]);
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
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Divisions</p>
                  <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-foreground">{divisions.filter((division) => division.isActive).length}</p>
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
