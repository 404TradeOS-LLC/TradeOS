import type { Metadata } from "next";
import { AssemblyCatalog } from "@/components/costbook/assembly-catalog";
import { CatalogQueryControls } from "@/components/costbook/catalog-query-controls";
import type { CostItemCatalogRecord } from "@/components/costbook/cost-item-catalog-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { apiFetch, getCostbookWorkspace, type CatalogPage } from "@/lib/api";
import { listCostbookAssemblies, type CostbookAssembly } from "@/lib/costbook-api";
import { getSessionToken } from "@/lib/session";

export const metadata: Metadata = { title: "Assemblies | Costbook | TradeOS" };

type AssemblyPageData = {
  assemblies: CostbookAssembly[];
  costItems: CostItemCatalogRecord[];
  canWrite: boolean;
  canManage: boolean;
  total: number;
  nextCursor: string | null;
};

type AssembliesQuery = { limit?: string; cursor?: string; q?: string; sort?: string; order?: "asc" | "desc"; active?: string; isTemplate?: string };

export default async function CostbookAssembliesPage({ searchParams }: { searchParams: Promise<AssembliesQuery> }) {
  const token = await getSessionToken();
  const query = await searchParams;
  if (!token) return <EmptyState title="Sign in required" description="You need an authenticated Costbook session." />;

  let data: AssemblyPageData | null = null;
  let loadError: string | null = null;

  try {
    const [workspace, assemblies, costItems] = await Promise.all([
      getCostbookWorkspace(token),
      listCostbookAssemblies(token, { limit: query.limit ? Number(query.limit) : undefined, cursor: query.cursor, q: query.q, sort: query.sort, order: query.order, active: query.active === undefined ? undefined : query.active === "true", isTemplate: query.isTemplate === undefined ? undefined : query.isTemplate === "true" }),
      apiFetch<CatalogPage<CostItemCatalogRecord>>("/api/v1/costbook/cost-items?limit=100&active=true", { token }),
    ]);
    data = {
      assemblies: assemblies.items,
      costItems: costItems.items,
      canWrite: workspace.permissions.canWrite,
      canManage: workspace.permissions.canManage,
      total: assemblies.total,
      nextCursor: assemblies.nextCursor,
    };
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Assembly data is unavailable.";
  }

  if (!data) {
    return <EmptyState title="Couldn't load assemblies" description={loadError ?? "Assembly data is unavailable."} />;
  }

  return <div className="flex flex-col gap-6">
    <PageHeader title="Assemblies" description="Compose reusable CostItems and child Assemblies without duplicating pricing data." backHref="/costbook" backLabel="Costbook" />
    <CatalogQueryControls pathname="/costbook/assemblies" query={query} total={data.total} shown={data.assemblies.length} nextCursor={data.nextCursor} sortOptions={[{ value: "name", label: "Name" }, { value: "code", label: "Code" }, { value: "createdAt", label: "Created" }, { value: "updatedAt", label: "Updated" }]} filters={[{ name: "active", label: "Status", value: query.active, options: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }] }, { name: "isTemplate", label: "Template", value: query.isTemplate, options: [{ value: "true", label: "Templates" }, { value: "false", label: "Regular" }] }]} />
    <AssemblyCatalog initialAssemblies={data.assemblies} costItems={data.costItems} canWrite={data.canWrite} canManage={data.canManage} />
  </div>;
}
