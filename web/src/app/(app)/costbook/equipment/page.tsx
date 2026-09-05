import type { Metadata } from "next";
import { Wrench } from "lucide-react";
import { EquipmentCatalog } from "@/components/costbook/equipment-catalog";
import { CatalogQueryControls } from "@/components/costbook/catalog-query-controls";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ApiClientError, apiFetch, type CatalogPage, type CostbookWorkspaceSummary } from "@/lib/api";
import { loadEquipmentPageData } from "@/lib/costbook-equipment-load";
import { getSessionToken } from "@/lib/session";

interface CostbookEquipment {
  id: string;
  organizationId: string;
  name: string;
  ownershipCostPerHour: number;
  operatingCostPerHour: number;
  dailyRate: number | null;
  hourlyCost: number;
  createdAt: string;
  updatedAt: string;
}

/** Loads the organization-scoped equipment catalog with a caller-owned cancellation signal. */
function listCostbookEquipment(token: string, signal: AbortSignal, query: EquipmentQuery = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  return apiFetch<CatalogPage<CostbookEquipment>>(`/api/v1/costbook/equipment?${params.toString()}`, { token, signal });
}

/** Loads Costbook workspace permissions and counts with the same bounded request signal. */
function getEquipmentWorkspace(token: string, signal: AbortSignal) {
  return apiFetch<CostbookWorkspaceSummary>("/api/v1/costbook/workspace", { token, signal });
}

export const metadata: Metadata = {
  title: "Equipment | TradeOS",
  description: "Manage organization-scoped Costbook equipment records with authenticated TradeOS permissions.",
};

/** Converts backend and timeout failures into contractor-facing equipment load errors. */
function toErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "Costbook equipment took too long to load. Try again.";
  }
  return "Unable to load Costbook equipment from the backend.";
}

/** Renders the authenticated Costbook equipment workspace with bounded backend loading. */
type EquipmentQuery = { limit?: string; cursor?: string; q?: string; sort?: string; order?: "asc" | "desc" };

export default async function CostbookEquipmentPage({ searchParams }: { searchParams: Promise<EquipmentQuery> }) {
  const token = await getSessionToken();
  const query = await searchParams;
  let workspace: CostbookWorkspaceSummary | null = null;
  let equipment: CostbookEquipment[] = [];
  let page = { total: 0, nextCursor: null as string | null };
  let loadError: string | null = null;

  if (!token) {
    loadError = "You need to be signed in to view Costbook equipment.";
  } else {
    try {
      const [loadedWorkspace, equipmentPage] = await loadEquipmentPageData(token, {
        getWorkspace: getEquipmentWorkspace,
        listEquipment: (currentToken, signal) => listCostbookEquipment(currentToken, signal, query),
      });
      workspace = loadedWorkspace;
      equipment = equipmentPage.items;
      page = { total: equipmentPage.total, nextCursor: equipmentPage.nextCursor };
    } catch (error) {
      loadError = toErrorMessage(error);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Equipment"
        description="Organization-scoped equipment catalog records for Costbook."
        backHref="/costbook"
        backLabel="Costbook"
      />

      {loadError ? (
        <EmptyState title="Couldn't load equipment" description={loadError} />
      ) : workspace ? (
        <>
          <section className="grid gap-4 sm:grid-cols-3" aria-label="Equipment summary">
            <div className="rounded-lg border border-border/70 bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Equipment in result</p>
                  <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-foreground">{page.total}</p>
                </div>
                <Wrench className="size-5 text-muted-foreground" aria-hidden="true" />
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-card p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Write Access</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{workspace.permissions.canWrite ? "Enabled" : "Read Only"}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-card p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Scope</p>
              <p className="mt-2 truncate text-sm font-medium text-foreground">{workspace.organizationId}</p>
            </div>
          </section>

          <CatalogQueryControls pathname="/costbook/equipment" query={query} total={page.total} shown={equipment.length} nextCursor={page.nextCursor} sortOptions={[{ value: "name", label: "Name" }, { value: "createdAt", label: "Created" }, { value: "updatedAt", label: "Updated" }]} />
          <EquipmentCatalog
            initialEquipment={equipment}
            canWrite={workspace.permissions.canWrite}
            canManage={workspace.permissions.canManage}
          />
        </>
      ) : null}
    </div>
  );
}
