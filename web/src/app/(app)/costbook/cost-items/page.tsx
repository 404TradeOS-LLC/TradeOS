import type { Metadata } from "next";
import { Boxes } from "lucide-react";
import { CostItemCatalog } from "@/components/costbook/cost-item-catalog";
import { CatalogQueryControls } from "@/components/costbook/catalog-query-controls";
import type { CostItemCatalogRecord } from "@/components/costbook/cost-item-catalog-actions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ApiClientError, apiFetch, type CatalogPage, type CostbookWorkspaceSummary } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

type Subcategory = { id: string; code: string; name: string; isActive: boolean };
type LaborRate = { id: string; role: string; active: boolean };
type Material = { id: string; sku: string | null; name: string };
type Equipment = { id: string; name: string };

export const metadata: Metadata = {
  title: "Cost Items | TradeOS",
  description: "Manage organization-scoped Costbook items that connect hierarchy, labor, materials, and equipment for estimating.",
};

function toErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  return "Unable to load Costbook cost items from the backend.";
}

type CostItemsQuery = { limit?: string; cursor?: string; q?: string; sort?: string; order?: "asc" | "desc"; active?: string; subcategoryId?: string; componentType?: "labor" | "material" | "equipment" | "subcontractor" | "none" };

export default async function CostbookCostItemsPage({ searchParams }: { searchParams: Promise<CostItemsQuery> }) {
  const token = await getSessionToken();
  const query = await searchParams;
  let workspace: CostbookWorkspaceSummary | null = null;
  let costItems: CostItemCatalogRecord[] = [];
  let subcategories: Subcategory[] = [];
  let laborRates: LaborRate[] = [];
  let materials: Material[] = [];
  let equipment: Equipment[] = [];
  let costItemPage = { total: 0, nextCursor: null as string | null };
  let loadError: string | null = null;

  if (!token) {
    loadError = "You need to be signed in to view Costbook cost items.";
  } else {
    try {
      const [loadedWorkspace, loadedCostItems, loadedSubcategories, loadedLaborRates, loadedMaterials, loadedEquipment] = await Promise.all([
        apiFetch<CostbookWorkspaceSummary>("/api/v1/costbook/workspace", { token }),
        apiFetch<CatalogPage<CostItemCatalogRecord>>(`/api/v1/costbook/cost-items?limit=${query.limit ?? 100}${query.cursor ? `&cursor=${encodeURIComponent(query.cursor)}` : ""}${query.q ? `&q=${encodeURIComponent(query.q)}` : ""}${query.sort ? `&sort=${encodeURIComponent(query.sort)}` : ""}${query.order ? `&order=${query.order}` : ""}${query.active ? `&active=${query.active}` : ""}${query.subcategoryId ? `&subcategoryId=${query.subcategoryId}` : ""}${query.componentType ? `&componentType=${query.componentType}` : ""}`, { token }),
        apiFetch<CatalogPage<Subcategory>>("/api/v1/costbook/subcategories?limit=100", { token }),
        apiFetch<CatalogPage<LaborRate>>("/api/v1/costbook/labor-rates?limit=100&active=true", { token }),
        apiFetch<CatalogPage<Material>>("/api/v1/costbook/materials?limit=100", { token }),
        apiFetch<CatalogPage<Equipment>>("/api/v1/costbook/equipment?limit=100", { token }),
      ]);
      workspace = loadedWorkspace;
      costItems = loadedCostItems.items;
      subcategories = loadedSubcategories.items;
      laborRates = loadedLaborRates.items;
      materials = loadedMaterials.items;
      equipment = loadedEquipment.items;
      costItemPage = { total: loadedCostItems.total, nextCursor: loadedCostItems.nextCursor };
    } catch (error) {
      loadError = toErrorMessage(error);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cost Items"
        description="Reusable estimating items built from your Costbook hierarchy and catalog records."
        backHref="/costbook"
        backLabel="Costbook"
      />

      {loadError ? (
        <EmptyState title="Couldn't load cost items" description={loadError} />
      ) : workspace ? (
        <>
          <section className="grid gap-4 sm:grid-cols-3" aria-label="Cost item summary">
            <div className="rounded-lg border border-border/70 bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Active Cost Items</p>
                  <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-foreground">{costItemPage.total}</p>
                </div>
                <Boxes className="size-5 text-muted-foreground" aria-hidden="true" />
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-surface p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Write Access</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{workspace.permissions.canWrite ? "Enabled" : "Read Only"}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-surface p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Lifecycle Control</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{workspace.permissions.canManage ? "Enabled" : "Read Only"}</p>
            </div>
          </section>

          <CatalogQueryControls pathname="/costbook/cost-items" query={query} total={costItemPage.total} shown={costItems.length} nextCursor={costItemPage.nextCursor} sortOptions={[{ value: "code", label: "Code" }, { value: "name", label: "Name" }, { value: "createdAt", label: "Created" }, { value: "updatedAt", label: "Updated" }]} filters={[{ name: "active", label: "Status", value: query.active, options: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }] }, { name: "componentType", label: "Component", value: query.componentType, options: [{ value: "labor", label: "Labor" }, { value: "material", label: "Material" }, { value: "equipment", label: "Equipment" }, { value: "subcontractor", label: "Subcontractor" }, { value: "none", label: "None" }] }]} />
          <CostItemCatalog
            initialCostItems={costItems}
            subcategories={subcategories.filter((item) => item.isActive).map((item) => ({ id: item.id, label: `${item.code} · ${item.name}` }))}
            laborRates={laborRates.filter((item) => item.active).map((item) => ({ id: item.id, label: item.role }))}
            materials={materials.map((item) => ({ id: item.id, label: item.sku ? `${item.sku} · ${item.name}` : item.name }))}
            equipment={equipment.map((item) => ({ id: item.id, label: item.name }))}
            canWrite={workspace.permissions.canWrite}
            canManage={workspace.permissions.canManage}
          />
        </>
      ) : null}
    </div>
  );
}
