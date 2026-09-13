import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ApiClientError, getCostbookWorkspace } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { CompositeImportClient } from "./import-client";

export const metadata: Metadata = {
  title: "Production Costbook Import | TradeOS",
  description: "Authenticated, organization-scoped import of governed composite price benchmarks.",
};

export default async function CostbookImportPage() {
  const token = await getSessionToken();
  if (!token) redirect("/login?next=/costbook/import");

  let canManage = false;
  let accessError: string | null = null;
  try {
    const workspace = await getCostbookWorkspace(token);
    canManage = workspace.permissions.canManage;
  } catch (error) {
    accessError = error instanceof ApiClientError ? error.message : "Unable to verify Costbook permissions.";
  }

  if (accessError) return <EmptyState title="Unable to verify import access" description={accessError} />;
  if (!canManage) {
    return (
      <EmptyState
        title="Costbook manage permission required"
        description="This production import is restricted to authenticated users with the costbook.manage capability."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Production benchmark import"
        description="Import normalized INDOT composite installed-price evidence through the authenticated Costbook API. No access token is exposed to the browser."
      />

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
        <p className="font-semibold">Governed reference-data lane</p>
        <p className="mt-1 text-muted-foreground">
          These rows are composite awarded-bid benchmarks. They remain separate from Material, LaborRate, Equipment, CostItem, estimate, proposal, invoice, and bill-rate records.
        </p>
      </div>

      <CompositeImportClient />

      <Link href="/costbook" className="text-sm font-medium underline underline-offset-4">
        Back to Costbook
      </Link>
    </div>
  );
}
