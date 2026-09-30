import type { Metadata } from "next";
import { AssemblyCatalog } from "@/components/costbook/assembly-catalog";
import { CatalogQueryControls } from "@/components/costbook/catalog-query-controls";
import type { CostItemCatalogRecord } from "@/components/costbook/cost-item-catalog-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { apiFetch, getCostbookWorkspace } from "@/lib/api";
import { listCostbookAssemblies, type CostbookAssembly } from "@/lib/costbook-api";
import { getSessionToken } from "@/lib/session";

export const metadata: Metadata = { title: "Assemblies | Costbook | TradeOS" };

type AssemblyPageData = {
  assemblies: CostbookAssembly[];
  childAssemblies: CostbookAssembly[];
  costItems: CostItemCatalogRecord[];
  canWrite: boolean;
  canManage: boolean;
  total: number;
  nextCursor: string | null;
};

type AssembliesQuery = { limit?: string; cursor?: string; q?: string; sort?: string; order?: "asc" | "desc"; active?: string; isTemplate?: string };

async function loadChildAssemblyChoices(token: string): Promise<CostbookAssembly[]> {
  const items: CostbookAssembly[] = [];
  let cursor: string | undefined;
  do {
    const page = await listCostbookAssemblies(token, { limit: 100, cursor, active: true, sort: "name", order: "asc" });
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return items;
}

async function loadCostItemChoices(token: string): Promise<CostItemCatalogRecord[]> {
  return apiFetch<CostItemCatalogRecord[]>("/api/v1/costbook/cost-items/search?q=", { token });
}

export default async function CostbookAssembliesPage({ searchParams }: { searchParams: Promise<AssembliesQuery> }) {
  const token = await getSessionToken();
  const query = await searchParams;
  if (!token) return <EmptyState title="Sign in required" description="You need an authenticated Costbook session." />;

  let data: AssemblyPageData | null = null;
  let loadError: string | null = null;

  try {
    const active = query.active === "true" ? true : query.active === "false" ? false : undefined;
    const isTemplate = query.isTemplate === "true" ? true : query.isTemplate === "false" ? false : undefined;
    const [workspace, assemblies, childAssemblies, costItems] = await Promise.all([
      getCostbookWorkspace(token),
      listCostbookAssemblies(token, { limit: query.limit ? Number(query.limit) : undefined, cursor: query.cursor, q: query.q, sort: query.sort, order: query.order, active, isTemplate }),
      loadChildAssemblyChoices(token),
      loadCostItemChoices(token),
    ]);
    data = {
      assemblies: assemblies.items,
      childAssemblies,
      costItems,
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

  const catalogKey = [query.cursor, query.q, query.sort, query.order, query.active, query.isTemplate].map((value) => value ?? "").join("|");
  const showingInactive = query.active === "false";
  const displayAssemblies = showingInactive ? data.assemblies.map((assembly) => ({ ...assembly, isActive: true })) : data.assemblies;

  return <div className="flex flex-col gap-6">
    <PageHeader title="Assemblies" description="Start with a residential NAHB workflow and CSI classification, then map your own Cost Items into reusable estimating assemblies." backHref="/costbook" backLabel="Costbook" />
    <CatalogQueryControls pathname="/costbook/assemblies" query={query} total={data.total} shown={data.assemblies.length} nextCursor={data.nextCursor} sortOptions={[{ value: "name", label: "Name" }, { value: "code", label: "Code" }, { value: "createdAt", label: "Created" }, { value: "updatedAt", label: "Updated" }]} filters={[{ name: "active", label: "Status", value: query.active, options: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }] }, { name: "isTemplate", label: "Template", value: query.isTemplate, options: [{ value: "true", label: "Templates" }, { value: "false", label: "Regular" }] }]} />
    <AssemblyCatalog key={catalogKey} initialAssemblies={displayAssemblies} childAssemblies={data.childAssemblies} costItems={data.costItems} canWrite={showingInactive ? false : data.canWrite} canManage={showingInactive ? false : data.canManage} />
  </div>;
}
