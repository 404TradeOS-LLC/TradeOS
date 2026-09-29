import type { Metadata } from "next";
import Link from "next/link";
import {
  Boxes,
  Calculator,
  ExternalLink,
  Info,
  Layers3,
  Ruler,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getCostbookAssembly,
  getCostbookAssemblyUnitCost,
  listCostbookAssemblyItems,
  type CostbookAssemblyItem,
} from "@/lib/costbook-api";
import { getSessionToken } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Assembly | Costbook | TradeOS",
  description: "Review a reusable Costbook assembly recipe and its current resolved unit cost.",
};

const COMPONENT_PAGE_LIMIT = 100;

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function typeLabel(item: CostbookAssemblyItem) {
  return item.componentType === "assembly" ? "Child assembly" : "Cost item";
}

export default async function CostbookAssemblyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const token = await getSessionToken();

  if (!token) {
    return <EmptyState title="Sign in required" description="You need an authenticated Costbook session." />;
  }

  let assembly: Awaited<ReturnType<typeof getCostbookAssembly>>;
  let itemsPage: Awaited<ReturnType<typeof listCostbookAssemblyItems>>;

  try {
    [assembly, itemsPage] = await Promise.all([
      getCostbookAssembly(token, id),
      listCostbookAssemblyItems(token, id, {
        limit: COMPONENT_PAGE_LIMIT,
        sort: "sortOrder",
        order: "asc",
      }),
    ]);
  } catch (error) {
    return (
      <EmptyState
        title="Couldn't load assembly"
        description={error instanceof Error ? error.message : "Assembly detail is unavailable."}
      />
    );
  }

  const costResult = await getCostbookAssemblyUnitCost(token, id)
    .then((value) => ({ value, error: null as string | null }))
    .catch((error: unknown) => ({
      value: null,
      error: error instanceof Error ? error.message : "Current unit cost could not be resolved.",
    }));

  const shownItems = itemsPage.items;
  const hasMoreItems = Boolean(itemsPage.nextCursor) || itemsPage.total > shownItems.length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={assembly.name}
        breadcrumbs={[
          { label: "Costbook", href: "/costbook" },
          { label: "Assemblies", href: "/costbook/assemblies" },
          { label: assembly.name },
        ]}
        description={
          assembly.code +
          " · " +
          assembly.unitOfMeasure +
          (assembly.isTemplate ? " · Template" : "")
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{assembly.isActive ? "Active" : "Inactive"}</Badge>
            {assembly.isTemplate ? <Badge variant="secondary">Reusable template</Badge> : null}
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid content-start gap-5">
          <Card className="border-border/70">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base">Scope</CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <p className="max-w-3xl text-sm leading-6 text-foreground">
                {assembly.description ?? "No assembly description has been saved."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border/70 bg-muted/20 px-2.5 py-1">
                  Output unit · {assembly.unitOfMeasure}
                </span>
                <span className="rounded-full border border-border/70 bg-muted/20 px-2.5 py-1">
                  {assembly.isTemplate ? "Template" : "Organization assembly"}
                </span>
                <span className="rounded-full border border-border/70 bg-muted/20 px-2.5 py-1">
                  {assembly.isActive ? "Available for reuse" : "Inactive"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="border-b border-border/60">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Recipe</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Quantities are stored per 1 {assembly.unitOfMeasure} of assembly output.
                  </p>
                </div>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {itemsPage.total} component{itemsPage.total === 1 ? "" : "s"}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {shownItems.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">
                  This assembly does not have any components yet.
                </p>
              ) : (
                <div className="divide-y divide-border/60">
                  {shownItems.map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">{item.componentName}</p>
                          <Badge variant="outline">{typeLabel(item)}</Badge>
                        </div>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          {item.componentCode} · {item.componentUnitOfMeasure}
                        </p>
                      </div>
                      <div className="sm:text-right">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Qty / 1 {assembly.unitOfMeasure}
                        </p>
                        <p className="mt-1 font-mono text-base font-semibold tabular-nums text-foreground">
                          {item.quantityPerUnit}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {hasMoreItems ? (
                <div className="border-t border-border/60 px-4 py-3 text-xs text-muted-foreground sm:px-5">
                  Showing {shownItems.length} of {itemsPage.total} components. Use the Assembly catalog editor to review the remaining recipe rows.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <aside className="grid content-start gap-4 xl:sticky xl:top-20 xl:self-start">
          <Card className="border-primary/25">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calculator className="size-4 text-primary" aria-hidden="true" />
                <CardTitle className="text-base">Current cost</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {costResult.value ? (
                <>
                  <p className="font-mono text-3xl font-semibold tabular-nums text-foreground">
                    {money(costResult.value.unitCost)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    per 1 {assembly.unitOfMeasure} · {costResult.value.componentCount} resolved component
                    {costResult.value.componentCount === 1 ? "" : "s"}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">Current unit cost unavailable</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{costResult.error}</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Layers3 className="size-4 text-muted-foreground" aria-hidden="true" />
                <CardTitle className="text-base">Estimator use</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground">
              <p>
                Assemblies are reusable Costbook recipes. Estimate Items can add an Assembly and capture the pricing snapshot/source identity at that time.
              </p>
              <p>
                This detail page does not create an Estimate or invent a sell price, margin, or job quantity without Estimate context.
              </p>
            </CardContent>
          </Card>

          <div className="rounded-xl border border-info/25 bg-info/5 p-4">
            <div className="flex gap-3">
              <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-foreground">Trust boundary</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  The Assembly API resolves current unit cost, but it does not return component-level supplier/date provenance, confidence, sell price, gross margin, or job-specific inputs. This workspace does not infer those fields.
                </p>
              </div>
            </div>
          </div>

          <Card className="border-border/70">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Ruler className="size-4 text-muted-foreground" aria-hidden="true" />
                <CardTitle className="text-base">Assembly actions</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Link
                href={"/costbook/assemblies?q=" + encodeURIComponent(assembly.code)}
                className={buttonVariants({ variant: "outline" })}
              >
                <Boxes className="size-4" aria-hidden="true" />
                Open in catalog editor
              </Link>
              <Link href="/estimates" className={cn(buttonVariants({ variant: "ghost" }), "justify-between")}>
                Browse Estimates
                <ExternalLink className="size-4" aria-hidden="true" />
              </Link>
              <p className="text-xs text-muted-foreground">
                Use an Assembly from an Estimate Items workflow when you have project/estimate context.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
