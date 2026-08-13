import type { Metadata } from "next";
import { Wrench } from "lucide-react";
import { EquipmentCatalog } from "@/components/costbook/equipment-catalog";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ApiClientError, getCostbookWorkspace, listCostbookEquipment, type CostbookEquipment, type CostbookWorkspaceSummary } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export const metadata: Metadata = {
  title: "Equipment | TradeOS",
  description: "Manage organization-scoped Costbook equipment records with authenticated TradeOS permissions.",
};

function toErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  return "Unable to load Costbook equipment from the backend.";
}

export default async function CostbookEquipmentPage() {
  const token = await getSessionToken();
  let workspace: CostbookWorkspaceSummary | null = null;
  let equipment: CostbookEquipment[] = [];
  let loadError: string | null = null;

  if (!token) {
    loadError = "You need to be signed in to view Costbook equipment.";
  } else {
    try {
      [workspace, equipment] = await Promise.all([
        getCostbookWorkspace(token),
        listCostbookEquipment(token),
      ]);
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
