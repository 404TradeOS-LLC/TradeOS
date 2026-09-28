import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { MaterialsCatalog } from "@/components/costbook/materials-catalog";
import { CatalogQueryControls } from "@/components/costbook/catalog-query-controls";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ApiClientError,
  getCostbookWorkspace,
  listCostbookMaterials,
  type CostbookMaterial,
  type CostbookWorkspaceSummary,
} from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export const metadata: Metadata = {
  title: "Materials Catalog | TradeOS",
  description: "Search organization-scoped Material prices with supplier and price-update evidence.",
};

function toErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  return "Unable to load Costbook materials from the backend.";
}

type MaterialsQuery = {
  limit?: string;
  cursor?: string;
  q?: string;
  sort?: string;
  order?: "asc" | "desc";
  supplierId?: string;
  active?: string;
};

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
      const active = query.active === "true" ? true : query.active === "false" ? false : undefined;
      const [loadedWorkspace, loadedPage] = await Promise.all([
        getCostbookWorkspace(token),
        listCostbookMaterials(token, {
          limit: query.limit ? Number(query.limit) : undefined,
          cursor: query.cursor,
          q: query.q,
          sort: query.sort,
          order: query.order,
          supplierId: query.supplierId,
          active,
        }),
      ]);
      workspace = loadedWorkspace;
      materials = loadedPage.items;
      page = { total: loadedPage.total, nextCursor: loadedPage.nextCursor };
    } catch (error) {
      loadError = toErrorMessage(error);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Materials"
        description="Stored Material prices with supplier and last price-update facts. Missing evidence remains visibly missing."
        backHref="/costbook"
        backLabel="Costbook"
        action={
          workspace?.permissions.canManage ? (
            <Link href="/costbook/price-history" className={buttonVariants({ variant: "outline" })}>
              <History className="size-4" aria-hidden="true" />
              Price History
            </Link>
          ) : undefined
        }
      />

      {loadError ? (
        <EmptyState title="Couldn't load materials" description={loadError} />
      ) : workspace ? (
        <>
          <CatalogQueryControls
            pathname="/costbook/materials"
            query={query}
            total={page.total}
            shown={materials.length}
            nextCursor={page.nextCursor}
            sortOptions={[
              { value: "name", label: "Name" },
              { value: "createdAt", label: "Created" },
              { value: "updatedAt", label: "Updated" },
            ]}
            filters={[
              {
                name: "active",
                label: "Status",
                value: query.active,
                options: [
                  { value: "true", label: "Active" },
                  { value: "false", label: "Inactive" },
                ],
              },
            ]}
          />

          <div className="rounded-xl border border-info/25 bg-info/5 px-4 py-3 text-sm text-muted-foreground">
            Supplier and last price-update date are evidence fields, not a universal freshness or confidence score. Costbook does not infer “verified” or “current local” pricing from incomplete metadata.
          </div>

          <MaterialsCatalog
            initialMaterials={materials}
            canWrite={workspace.permissions.canWrite}
            canManage={workspace.permissions.canManage}
            activeFilter={query.active === "true" ? true : query.active === "false" ? false : undefined}
          />
        </>
      ) : null}
    </div>
  );
}
