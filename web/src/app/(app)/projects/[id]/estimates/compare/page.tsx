import Link from "next/link";
import { duplicateEstimateAction } from "@/app/actions/projects";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { getEstimate, listEstimatesByProject } from "@/lib/api";
import { buildEstimateComparison, resolveDefaultComparisonIds } from "@/lib/estimate-compare";
import { formatCurrency } from "@/lib/document-workflow";
import { getSessionToken } from "@/lib/session";
import { cn } from "@/lib/utils";

function formatQuantity(value: number | null | undefined) {
  if (value == null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export default async function EstimateComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ left?: string; right?: string }>;
}) {
  const [{ id: projectId }, query] = await Promise.all([params, searchParams]);
  const token = await getSessionToken();
  const estimates = token ? await listEstimatesByProject(token, projectId) : [];
  const defaults = resolveDefaultComparisonIds(estimates);
  const leftId = query.left && estimates.some((estimate) => estimate.id === query.left) ? query.left : defaults.leftId;
  const rightId = query.right && estimates.some((estimate) => estimate.id === query.right) ? query.right : defaults.rightId;

  const [leftEstimate, rightEstimate] =
    token && leftId && rightId
      ? await Promise.all([getEstimate(token, leftId), getEstimate(token, rightId)])
      : [null, null];

  const comparisonRows =
    leftEstimate && rightEstimate && leftEstimate.id !== rightEstimate.id
      ? buildEstimateComparison(leftEstimate, rightEstimate)
      : [];

  const totalDelta =
    leftEstimate && rightEstimate ? rightEstimate.totalPrice - leftEstimate.totalPrice : 0;
  const costDelta =
    leftEstimate && rightEstimate ? rightEstimate.subtotalCost - leftEstimate.subtotalCost : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Compare estimate versions"
        description="Review pricing and scope changes between two saved versions, then duplicate either one into a fresh draft when you need another revision."
        backHref={`/projects/${projectId}?tab=estimate-history`}
        backLabel="Back to estimate history"
      />

      {estimates.length < 2 ? (
        <Card className="border-border/70">
          <CardContent className="space-y-4 pt-6 text-sm text-muted-foreground">
            <p>You need at least two estimate versions before comparison is useful.</p>
            <Link href={`/projects/${projectId}?tab=estimate-history`} className={buttonVariants({ variant: "outline" })}>
              Return to estimate history
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Select versions</CardTitle>
            </CardHeader>
            <CardContent>
              <form method="get" className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <div className="space-y-2">
                  <Label htmlFor="left">Baseline version</Label>
                  <select
                    id="left"
                    name="left"
                    defaultValue={leftId ?? undefined}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {estimates.map((estimate) => (
                      <option key={estimate.id} value={estimate.id}>
                        v{estimate.version} • {estimate.status} • {formatCurrency(estimate.totalPrice)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="right">Compare against</Label>
                  <select
                    id="right"
                    name="right"
                    defaultValue={rightId ?? undefined}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {estimates.map((estimate) => (
                      <option key={estimate.id} value={estimate.id}>
                        v{estimate.version} • {estimate.status} • {formatCurrency(estimate.totalPrice)}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" className={buttonVariants()}>
                  Compare
                </button>
              </form>
            </CardContent>
          </Card>

          {leftEstimate && rightEstimate && leftEstimate.id === rightEstimate.id ? (
            <Card className="border-border/70">
              <CardContent className="pt-6 text-sm text-muted-foreground">
                Choose two different versions to see a side-by-side comparison.
              </CardContent>
            </Card>
          ) : leftEstimate && rightEstimate ? (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <EstimateSummaryCard estimate={leftEstimate} label="Baseline" />
                <EstimateSummaryCard estimate={rightEstimate} label="Compare against" />
              </div>

              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle>Version delta</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                  <Metric label="Job cost change" value={formatCurrency(costDelta)} signed={costDelta} />
                  <Metric label="Total price change" value={formatCurrency(totalDelta)} signed={totalDelta} />
                  <Metric
                    label="Line item count"
                    value={`${leftEstimate.lineItems.length} → ${rightEstimate.lineItems.length}`}
                  />
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle>Line item comparison</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border/70 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        <th className="px-3 py-2">Description</th>
                        <th className="px-3 py-2">Baseline qty</th>
                        <th className="px-3 py-2">Baseline cost</th>
                        <th className="px-3 py-2">Compare qty</th>
                        <th className="px-3 py-2">Compare cost</th>
                        <th className="px-3 py-2">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-4 text-muted-foreground">
                            Neither version has line items yet.
                          </td>
                        </tr>
                      ) : (
                        comparisonRows.map((row) => {
                          const leftCost = row.left?.lineCost ?? 0;
                          const rightCost = row.right?.lineCost ?? 0;
                          const delta = rightCost - leftCost;

                          return (
                            <tr key={row.key} className="border-b border-border/50">
                              <td className="px-3 py-3">
                                <div className="font-medium text-foreground">{row.description}</div>
                                <div className="text-xs text-muted-foreground">{row.unitOfMeasure}</div>
                              </td>
                              <td className="px-3 py-3">{formatQuantity(row.left?.quantity)}</td>
                              <td className="px-3 py-3">{row.left ? formatCurrency(row.left.lineCost) : "—"}</td>
                              <td className="px-3 py-3">{formatQuantity(row.right?.quantity)}</td>
                              <td className="px-3 py-3">{row.right ? formatCurrency(row.right.lineCost) : "—"}</td>
                              <td className={cn("px-3 py-3 font-medium", delta > 0 && "text-warning", delta < 0 && "text-success")}>
                                {row.left || row.right ? formatCurrency(delta) : "—"}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <DuplicateCard projectId={projectId} estimate={leftEstimate} label="Duplicate baseline into new draft" />
                <DuplicateCard projectId={projectId} estimate={rightEstimate} label="Duplicate compare version into new draft" />
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function EstimateSummaryCard({
  estimate,
  label,
}: {
  estimate: Awaited<ReturnType<typeof getEstimate>>;
  label: string;
}) {
  return (
    <Card className="border-border/70">
      <CardHeader className="space-y-3">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Estimate v{estimate.version}</CardTitle>
          <StatusBadge status={estimate.status} />
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <Metric label="Job cost" value={formatCurrency(estimate.subtotalCost)} />
        <Metric label="Total price" value={formatCurrency(estimate.totalPrice)} highlight />
        <Metric label="Line items" value={String(estimate.lineItems.length)} />
        <Metric
          label="Pricing mode"
          value={estimate.targetMarginPct != null ? `${estimate.targetMarginPct}% margin` : `${estimate.profitPct}% markup`}
        />
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  signed,
  highlight,
}: {
  label: string;
  value: string;
  signed?: number;
  highlight?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border border-border/60 bg-muted/20 p-4", highlight && "border-foreground/15 bg-background")}>
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-2 text-lg font-semibold text-foreground",
          signed != null && signed > 0 && "text-warning",
          signed != null && signed < 0 && "text-success"
        )}
      >
        {signed != null && signed > 0 ? `+${value}` : value}
      </div>
    </div>
  );
}

function DuplicateCard({
  projectId,
  estimate,
  label,
}: {
  projectId: string;
  estimate: Awaited<ReturnType<typeof getEstimate>>;
  label: string;
}) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Creates the next draft version with the same line-item snapshots and pricing settings as v{estimate.version}.
        </p>
        <form action={duplicateEstimateAction}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="estimateId" value={estimate.id} />
          <button type="submit" className={buttonVariants({ variant: "outline" })}>
            Duplicate v{estimate.version}
          </button>
        </form>
        <Link href={`/projects/${projectId}/estimates/${estimate.id}`} className={buttonVariants({ variant: "ghost" })}>
          Open v{estimate.version} in builder
        </Link>
      </CardContent>
    </Card>
  );
}
