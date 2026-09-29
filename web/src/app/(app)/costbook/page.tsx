import type { Metadata } from "next";
import Link from "next/link";
import {
  Boxes,
  CircleDollarSign,
  FlaskConical,
  Hammer,
  History,
  Package,
  Search,
  Settings2,
  Upload,
  Wrench,
} from "lucide-react";
import { PricingProvenance } from "@/components/costbook/pricing-provenance";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ApiClientError,
  getCostbookWorkspace,
  listCostbookMaterials,
  type CostbookMaterial,
  type CostbookWorkspaceSummary,
} from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Costbook | TradeOS",
  description: "Search organization pricing, inspect source evidence, and manage governed Costbook catalogs.",
};

type PrimaryAreaId = "materials" | "labor" | "equipment" | "assemblies";
type CostbookQuery = { area?: string; q?: string };

const primaryAreas: Array<{
  id: PrimaryAreaId;
  label: string;
  href: string;
  countKey: "materials" | "laborRates" | "equipment" | "assemblies";
  icon: typeof Package;
  searchPlaceholder: string;
}> = [
  {
    id: "materials",
    label: "Materials",
    href: "/costbook/materials",
    countKey: "materials",
    icon: Package,
    searchPlaceholder: "Search material name or SKU…",
  },
  {
    id: "labor",
    label: "Labor",
    href: "/costbook/labor-rates",
    countKey: "laborRates",
    icon: Hammer,
    searchPlaceholder: "Search labor role or description…",
  },
  {
    id: "equipment",
    label: "Equipment",
    href: "/costbook/equipment",
    countKey: "equipment",
    icon: Wrench,
    searchPlaceholder: "Search equipment…",
  },
  {
    id: "assemblies",
    label: "Assemblies",
    href: "/costbook/assemblies",
    countKey: "assemblies",
    icon: Boxes,
    searchPlaceholder: "Search assembly name or code…",
  },
];

function toErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  return "Unable to load Costbook workspace data from the backend.";
}

function normalizeArea(value: string | undefined): PrimaryAreaId {
  return primaryAreas.some((area) => area.id === value) ? (value as PrimaryAreaId) : "materials";
}

export default async function CostbookPage({ searchParams }: { searchParams: Promise<CostbookQuery> }) {
  const token = await getSessionToken();
  const query = await searchParams;
  const selectedAreaId = normalizeArea(query.area);
  const selectedArea = primaryAreas.find((area) => area.id === selectedAreaId)!;

  let workspace: CostbookWorkspaceSummary | null = null;
  let recentMaterials: CostbookMaterial[] = [];
  let materialsPreviewUnavailable = false;
  let loadError: string | null = null;

  if (!token) {
    loadError = "You need to be signed in to view Costbook.";
  } else {
    try {
      workspace = await getCostbookWorkspace(token);
      try {
        const preview = await listCostbookMaterials(token, {
          limit: 5,
          sort: "updatedAt",
          order: "desc",
          active: true,
        });
        recentMaterials = preview.items;
      } catch {
        materialsPreviewUnavailable = true;
      }
    } catch (error) {
      loadError = toErrorMessage(error);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Costbook"
        description="Your organization pricing authority. Search the catalog first, then inspect the source evidence before using a number."
        action={
          workspace?.permissions.canManage ? (
            <Link href="/costbook/import" className={buttonVariants({ variant: "outline" })}>
              <Upload className="size-4" aria-hidden="true" />
              Import
            </Link>
          ) : undefined
        }
      />

      {loadError ? (
        <EmptyState title="Couldn't load Costbook" description={loadError} />
      ) : workspace ? (
        <>
          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card" aria-label="Search Costbook">
            <div className="border-b border-border/70 px-4 pt-4 sm:px-5">
              <nav className="flex gap-1 overflow-x-auto" aria-label="Costbook catalogs">
                {primaryAreas.map((area) => {
                  const Icon = area.icon;
                  const active = area.id === selectedAreaId;
                  return (
                    <Link
                      key={area.id}
                      href={`/costbook?area=${area.id}`}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-w-fit items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50",
                        active
                          ? "border-primary text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      {area.label}
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {workspace.counts[area.countKey]}
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="p-4 sm:p-5">
              <form action={selectedArea.href} method="get" className="flex flex-col gap-3 sm:flex-row">
                <label className="relative flex-1">
                  <span className="sr-only">Search {selectedArea.label}</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <input
                    name="q"
                    defaultValue={query.q}
                    placeholder={selectedArea.searchPlaceholder}
                    className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </label>
                <button
                  type="submit"
                  className="h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  Search {selectedArea.label}
                </button>
              </form>
              <p className="mt-2 text-xs text-muted-foreground">
                Search opens the real organization-scoped {selectedArea.label.toLowerCase()} catalog with its existing filters, pagination, and permissions.
              </p>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="border-border/70">
              <CardHeader className="border-b border-border/60">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>Recent material pricing</CardTitle>
                    <CardDescription>
                      Stored Material prices with only the supplier and price-update facts the catalog actually carries.
                    </CardDescription>
                  </div>
                  <Link href="/costbook/materials" className="text-sm font-medium text-foreground underline-offset-4 hover:underline">
                    Open Materials
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {materialsPreviewUnavailable ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    Material preview is unavailable. The Materials catalog remains the source of truth.
                  </p>
                ) : recentMaterials.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No active Material records are available yet.</p>
                ) : (
                  <div className="divide-y divide-border/70">
                    {recentMaterials.map((material) => (
                      <div key={material.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{material.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {material.unitOfMeasure} · SKU {material.sku ?? "unassigned"}
                          </p>
                          <div className="mt-2">
                            <PricingProvenance
                              mode="catalog"
                              supplierName={material.supplierName}
                              lastPriceUpdate={material.lastPriceUpdate}
                              compact
                            />
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
                            {money(material.unitCost)}
                          </p>
                          <p className="text-xs text-muted-foreground">/ {material.unitOfMeasure}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid content-start gap-4">
              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle>Pricing evidence</CardTitle>
                  <CardDescription>Review evidence before researched pricing becomes production Costbook pricing.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2">
                  <Link href="/costbook/research-review" className={buttonVariants({ variant: "outline" })}>
                    <FlaskConical className="size-4" aria-hidden="true" />
                    Open Research Review
                  </Link>
                  {workspace.permissions.canManage ? (
                    <Link href="/costbook/price-history" className={buttonVariants({ variant: "outline" })}>
                      <History className="size-4" aria-hidden="true" />
                      Price History
                    </Link>
                  ) : null}
                  <p className="pt-1 text-xs leading-5 text-muted-foreground">
                    Missing source or date stays missing. Costbook does not turn absent evidence into a verified price.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle>Catalog access</CardTitle>
                  <CardDescription>Current authenticated Costbook capability.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium text-foreground">
                    {workspace.permissions.canManage ? "Manage" : workspace.permissions.canWrite ? "Write" : "Read only"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Permissions and organization scope remain enforced by the existing Costbook backend and RLS boundary.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          <details className="rounded-xl border border-border/70 bg-card">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-foreground">
              <Settings2 className="size-4 text-muted-foreground" aria-hidden="true" />
              Catalog administration
            </summary>
            <div className="grid gap-3 border-t border-border/70 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <AdminLink href="/costbook/divisions" label="Hierarchy" description={`${workspace.counts.categories} categories`} />
              <AdminLink href="/costbook/cost-items" label="Cost Items" description={`${workspace.counts.costItems} records`} />
              <AdminLink href="/costbook/pricing" label="Pricing Preview" description="Calculation only" icon={CircleDollarSign} />
              {workspace.permissions.canManage ? (
                <AdminLink href="/costbook/import" label="Import" description="Governed benchmark intake" icon={Upload} />
              ) : null}
            </div>
          </details>
        </>
      ) : null}
    </div>
  );
}

function AdminLink({
  href,
  label,
  description,
  icon: Icon = Boxes,
}: {
  href: string;
  label: string;
  description: string;
  icon?: typeof Boxes;
}) {
  return (
    <Link href={href} className="rounded-xl border border-border/70 p-3 outline-none transition hover:bg-muted/30 focus-visible:ring-3 focus-visible:ring-ring/50">
      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      <p className="mt-2 text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </Link>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
