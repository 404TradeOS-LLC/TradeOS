import type { Metadata } from "next";
import { Wrench } from "lucide-react";
import { EquipmentCatalog } from "@/components/costbook/equipment-catalog";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ApiClientError, apiFetch, type CostbookWorkspaceSummary } from "@/lib/api";
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
function listCostbookEquipment(token: string, signal: AbortSignal) {
  return apiFetch<CostbookEquipment[]>("/api/v1/costbook/equipment", { token, signal });
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
export default async function CostbookEquipmentPage() {
  const token = await getSessionToken();
  let workspace: CostbookWorkspaceSummary | null = null;
  let equipment: CostbookEquipment[] = [];
  let loadError: string | null = null;

  if (!token) {
    loadError = "You need to be signed in to view Costbook equipment.";
  } else {
    try {
      [workspace, equipment] = await loadEquipmentPageData(token, {
        getWorkspace: getEquipmentWorkspace,
        listEquipment: listCostbookEquipment,
      });
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
            <div className="rounded-lg border border-border/70 bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Equipment</p>
                  <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-foreground">{equipment.length}</p>
                </div>
                <Wrench className="size-5 text-muted-foreground" aria-hidden="true" />
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
