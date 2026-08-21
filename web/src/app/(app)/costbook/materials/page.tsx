import type { Metadata } from "next";
import { Package } from "lucide-react";
import { MaterialsCatalog } from "@/components/costbook/materials-catalog";
import { CatalogQueryControls } from "@/components/costbook/catalog-query-controls";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ApiClientError, getCostbookWorkspace, listCostbookMaterials, type CostbookMaterial, type CostbookWorkspaceSummary } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export const metadata: Metadata = {
  title: "Materials Catalog | TradeOS",
  description: "Manage organization-scoped Costbook material items with authenticated TradeOS permissions.",
};

function toErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  return "Unable to load Costbook materials from the backend.";
}

type MaterialsQuery = { limit?: string; cursor?: string; q?: string; sort?: string; order?: "asc" | "desc"; supplierId?: string };

export default async function CostbookMaterialsPage({ searchParams }: { searchParams: Promise<MaterialsQuery> }) {
  const token = await getSessionToken();
  const query = await searchParams;
  let workspace: CostbookWorkspaceSummary | null = null;
  let materials: CostbookMaterial[] = [];
  let page = { total: 0, nextCursor: null as string | null };
  let loadError: string | null = null;

  if (!token) {
    loadError = "You need to be signed in to view Costbook materials.";
  } else {
    try {
      const [loadedWorkspace, loadedPage] = await Promise.all([
        getCostbookWorkspace(token),
        listCostbookMaterials(token, { limit: query.limit ? Number(query.limit) : undefined, cursor: query.cursor, q: query.q, sort: query.sort, order: query.order }),
      ]);
      workspace = loadedWorkspace;
      materials = loadedPage.items;
      page = { total: loadedPage.total, nextCursor: loadedPage.nextCursor };
    } catch (error) {
      loadError = toErrorMessage(error);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Materials"
        description="Organization-scoped material catalog records for Costbook."
        backHref="/costbook"
        backLabel="Costbook"
      />

      {loadError ? (
        <EmptyState title="Couldn't load materials" description={loadError} />
      ) : workspace ? (
        <>
          <section className="grid gap-4 sm:grid-cols-3" aria-label="Materials summary">
            <div className="rounded-lg border border-border/70 bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Materials in result</p>
              <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-foreground">{page.total}</p>
                </div>
                <Package className="size-5 text-muted-foreground" aria-hidden="true" />
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

          <CatalogQueryControls pathname="/costbook/materials" query={query} total={page.total} shown={materials.length} nextCursor={page.nextCursor} sortOptions={[{ value: "name", label: "Name" }, { value: "createdAt", label: "Created" }, { value: "updatedAt", label: "Updated" }]} />
          <MaterialsCatalog initialMaterials={materials} canWrite={workspace.permissions.canWrite} />
        </>
      ) : null}
    </div>
  );
}
