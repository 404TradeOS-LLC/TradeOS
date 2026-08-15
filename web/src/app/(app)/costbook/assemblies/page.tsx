import type { Metadata } from "next";
import { AssemblyCatalog } from "@/components/costbook/assembly-catalog";
import type { CostItemCatalogRecord } from "@/components/costbook/cost-item-catalog-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { apiFetch, getCostbookWorkspace } from "@/lib/api";
import { listCostbookAssemblies } from "@/lib/costbook-api";
import { getSessionToken } from "@/lib/session";

export const metadata: Metadata = { title: "Assemblies | Costbook | TradeOS" };

export default async function CostbookAssembliesPage() {
  const token = await getSessionToken();
  if (!token) return <EmptyState title="Sign in required" description="You need an authenticated Costbook session." />;

  try {
    const [workspace, assemblies, costItems] = await Promise.all([
      getCostbookWorkspace(token),
      listCostbookAssemblies(token),
      apiFetch<CostItemCatalogRecord[]>("/api/v1/costbook/cost-items", { token }),
    ]);
    return <div className="flex flex-col gap-6">
      <PageHeader title="Assemblies" description="Compose reusable CostItems and child Assemblies without duplicating pricing data." backHref="/costbook" backLabel="Costbook" />
      <AssemblyCatalog initialAssemblies={assemblies} costItems={costItems} canWrite={workspace.permissions.canWrite} canManage={workspace.permissions.canManage} />
    </div>;
  } catch (error) {
    return <EmptyState title="Couldn't load assemblies" description={error instanceof Error ? error.message : "Assembly data is unavailable."} />;
  }
}
