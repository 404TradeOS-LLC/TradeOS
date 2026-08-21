import type { Metadata } from "next";
import { Hammer } from "lucide-react";
import { LaborRatesCatalog } from "@/components/costbook/labor-rates-catalog";
import { CatalogQueryControls } from "@/components/costbook/catalog-query-controls";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ApiClientError, getCostbookWorkspace, listCostbookLaborRates, type CostbookLaborRate, type CostbookWorkspaceSummary } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export const metadata: Metadata = {
  title: "Labor Rates | TradeOS",
  description: "Manage organization-scoped Costbook labor rates with authenticated TradeOS permissions.",
};

function toErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  return "Unable to load Costbook labor rates from the backend.";
}

type LaborQuery = { limit?: string; cursor?: string; q?: string; sort?: string; order?: "asc" | "desc"; active?: string; trade?: string };

export default async function CostbookLaborRatesPage({ searchParams }: { searchParams: Promise<LaborQuery> }) {
  const token = await getSessionToken();
  const query = await searchParams;
  let workspace: CostbookWorkspaceSummary | null = null;
  let laborRates: CostbookLaborRate[] = [];
  let page = { total: 0, nextCursor: null as string | null };
  let loadError: string | null = null;

  if (!token) {
    loadError = "You need to be signed in to view Costbook labor rates.";
  } else {
    try {
      const [loadedWorkspace, loadedPage] = await Promise.all([
        getCostbookWorkspace(token),
        listCostbookLaborRates(token, { limit: query.limit ? Number(query.limit) : undefined, cursor: query.cursor, q: query.q, sort: query.sort, order: query.order, active: query.active === "true" ? true : query.active === "false" ? false : undefined, trade: query.trade }),
      ]);
      workspace = loadedWorkspace;
      laborRates = loadedPage.items;
      page = { total: loadedPage.total, nextCursor: loadedPage.nextCursor };
    } catch (error) {
      loadError = toErrorMessage(error);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Labor Rates"
        description="Organization-scoped labor-rate records for Costbook."
        backHref="/costbook"
        backLabel="Costbook"
      />

      {loadError ? (
        <EmptyState title="Couldn't load labor rates" description={loadError} />
      ) : workspace ? (
        <>
          <section className="grid gap-4 sm:grid-cols-3" aria-label="Labor rates summary">
            <div className="rounded-lg border border-border/70 bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Labor rates in result</p>
                  <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-foreground">{page.total}</p>
                </div>
                <Hammer className="size-5 text-muted-foreground" aria-hidden="true" />
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

          <CatalogQueryControls pathname="/costbook/labor-rates" query={query} total={page.total} shown={laborRates.length} nextCursor={page.nextCursor} sortOptions={[{ value: "role", label: "Role" }, { value: "createdAt", label: "Created" }, { value: "updatedAt", label: "Updated" }]} filters={[{ name: "active", label: "Status", value: query.active, options: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }] }]} />
          <LaborRatesCatalog
            initialLaborRates={laborRates}
            canWrite={workspace.permissions.canWrite}
            canManage={workspace.permissions.canManage}
          />
        </>
      ) : null}
    </div>
  );
}
