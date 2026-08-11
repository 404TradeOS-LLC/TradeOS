import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, CircleDollarSign, ClipboardList, Hammer, History, Package, ShieldCheck, Wrench } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiClientError, getCostbookWorkspace, type CostbookWorkspaceSummary } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export const metadata: Metadata = {
  title: "Costbook | TradeOS",
  description: "Costbook workspace foundation for tenant-scoped pricing intelligence, catalog visibility, permissions, and future governed pricing workflows.",
};

const countCards: {
  key: keyof CostbookWorkspaceSummary["counts"];
  label: string;
  icon: typeof Package;
  href?: string;
}[] = [
  { key: "categories", label: "Categories", icon: ClipboardList },
  { key: "costItems", label: "Cost Items", icon: Boxes },
  { key: "materials", label: "Materials", icon: Package, href: "/costbook/materials" },
  { key: "laborRates", label: "Labor Rates", icon: Hammer, href: "/costbook/labor-rates" },
  { key: "equipment", label: "Equipment", icon: Wrench, href: "/costbook/equipment" },
  { key: "assemblies", label: "Assemblies", icon: ShieldCheck },
];

const areaIcons = {
  materials: Package,
  labor: Hammer,
  equipment: Wrench,
  assemblies: Boxes,
  "pricing-rules": CircleDollarSign,
  "price-history": History,
} satisfies Record<CostbookWorkspaceSummary["areas"][number]["id"], typeof Package>;

function toErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  return "Unable to load Costbook workspace data from the backend.";
}

function getAreaStatusLabel(status: CostbookWorkspaceSummary["areas"][number]["status"]) {
  if (status === "existing_catalog") return "Catalog";
  if (status === "foundation_only") return "Foundation";
  return "Future";
}

export default async function CostbookPage() {
  const token = await getSessionToken();
  let workspace: CostbookWorkspaceSummary | null = null;
  let loadError: string | null = null;

  if (!token) {
    loadError = "You need to be signed in to view Costbook.";
  } else {
    try {
      workspace = await getCostbookWorkspace(token);
    } catch (error) {
      loadError = toErrorMessage(error);
    }
  }

  const totalRecords = workspace
    ? Object.values(workspace.counts).reduce((sum, value) => sum + value, 0)
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Costbook"
        description="Pricing workspace foundation for tenant-scoped catalog visibility, Costbook permissions, and future commercial intelligence workflows."
      />

      {loadError ? (
        <EmptyState title="Couldn't load Costbook" description={loadError} />
      ) : workspace ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/70 md:col-span-2">
              <CardHeader>
                <CardTitle>Workspace Foundation</CardTitle>
                <CardDescription>
                  {workspace.initialized ? "Workspace record is initialized for this organization." : "Workspace tables are ready; this organization has not initialized Costbook setup state yet."}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Status</div>
                  <div className="mt-2 text-lg font-semibold capitalize text-foreground">{workspace.status}</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Catalog Records</div>
                  <div className="mt-2 text-lg font-semibold tabular-nums text-foreground">{totalRecords}</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Access</div>
                  <div className="mt-2 text-lg font-semibold text-foreground">
                    {workspace.permissions.canManage ? "Manage" : workspace.permissions.canWrite ? "Write" : "Read"}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>Permission Boundary</CardTitle>
                <CardDescription>Costbook-specific capabilities returned by the authenticated backend session.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <PermissionRow label="Read" enabled={workspace.permissions.canRead} />
                <PermissionRow label="Write" enabled={workspace.permissions.canWrite} />
                <PermissionRow label="Manage" enabled={workspace.permissions.canManage} />
              </CardContent>
            </Card>
          </div>

          {totalRecords === 0 ? (
            <EmptyState
              title="No Costbook catalog records yet"
              description="Materials, labor rates, equipment, assemblies, and cost items will appear here as the organization builds its estimating catalog."
            />
          ) : null}

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Costbook catalog counts">
            {countCards.map((card) => {
              const Icon = card.icon;
              const content = (
                <Card className="h-full border-border/70 transition-colors hover:border-border">
                  <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div>
                      <CardTitle>{card.label}</CardTitle>
                      <CardDescription>Organization-scoped records</CardDescription>
                    </div>
                    <Icon aria-hidden="true" className="size-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="font-mono text-3xl font-semibold tabular-nums text-foreground">{workspace.counts[card.key]}</div>
                  </CardContent>
                </Card>
              );

              return card.href ? (
                <Link key={card.key} href={card.href} className="outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  {content}
                </Link>
              ) : (
                <div key={card.key}>{content}</div>
              );
            })}
          </section>

          <section className="grid gap-4 lg:grid-cols-2" aria-label="Costbook workspace areas">
            {workspace.areas.map((area) => {
              const Icon = areaIcons[area.id];
              return (
                <div key={area.id} className="rounded-lg border border-border/70 bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-md border border-border/70 bg-background">
                        <Icon aria-hidden="true" className="size-5 text-muted-foreground" />
                      </span>
                      <div>
                        <h2 className="text-base font-semibold text-foreground">{area.label}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{area.description}</p>
                      </div>
                    </div>
                    <span className="rounded-full border border-border/70 bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {getAreaStatusLabel(area.status)}
                    </span>
                  </div>
                </div>
              );
            })}
          </section>
        </>
      ) : null}
    </div>
  );
}

function PermissionRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2">
      <span>{label}</span>
      <span className={enabled ? "font-medium text-foreground" : "text-muted-foreground"}>{enabled ? "Enabled" : "No"}</span>
    </div>
  );
}
