import Link from "next/link";
import { AlertTriangle, CircleDollarSign, FileSignature, ShieldCheck, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/document-workflow";
import type { FinancialIntelligenceSummary } from "./financial-intelligence-model";

function money(value: number | null) {
  return value == null ? "Unavailable" : formatCurrency(value);
}

function Metric({ label, value, helper, attention = false }: { label: string; value: string; helper: string; attention?: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${attention ? "text-warning" : "text-foreground"}`}>{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{helper}</p>
    </div>
  );
}

export function FinancialIntelligenceCard({ summary }: { summary: FinancialIntelligenceSummary }) {
  const projectedMargin = summary.projectedMarginPct == null ? "Unavailable" : `${summary.projectedMarginPct.toFixed(1)}%`;
  const generatedLabel = summary.generatedAt ? "Generated from live records" : "Live fallback sources";

  return (
    <Card className="overflow-hidden border-border/70">
      <CardHeader className="bg-foreground text-background">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="text-background">Financial intelligence</CardTitle>
            <CardDescription className="mt-2 max-w-2xl text-background/70">
              Live organization-wide cash, exposure, opportunity, and estimate-backed margin signals.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-background/20 px-3 py-1.5 text-xs text-background/80">
            <ShieldCheck className="size-4" aria-hidden="true" /> {summary.exactOrganizationSummary ? "Organization-wide" : "Verified fallback"}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 pt-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Collected this week" value={money(summary.collectedThisWeek)} helper={summary.paymentCount == null ? "Payment ledger unavailable" : `${summary.paymentCount} recorded payment${summary.paymentCount === 1 ? "" : "s"}`} />
          <Metric label="Open receivables" value={money(summary.outstandingReceivables)} helper={summary.openInvoiceCount == null ? "Invoice queue unavailable" : `${summary.openInvoiceCount} open invoice${summary.receivablesPartial ? "s · loaded amount is a floor" : summary.openInvoiceCount === 1 ? "" : "s"}`} />
          <Metric label="Overdue exposure" value={money(summary.overdueReceivables)} helper={summary.overdueInvoiceCount == null ? "Invoice queue unavailable" : `${summary.overdueInvoiceCount} overdue invoice${summary.overdueInvoiceCount === 1 ? "" : "s"}`} attention={(summary.overdueInvoiceCount ?? 0) > 0} />
          <Metric label="Unsigned opportunity" value={money(summary.unsignedProposalOpportunity)} helper={summary.unsignedProposalCount == null ? "Proposal queue unavailable" : `${summary.unsignedProposalCount} unsigned proposal${summary.proposalsPartial ? "s · known prices only" : summary.unsignedProposalCount === 1 ? "" : "s"}`} />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Link href="/dashboard#invoices-waiting" className="flex items-center gap-3 rounded-xl border border-border/60 p-4 transition-colors hover:bg-muted/30"><AlertTriangle className="size-5 text-warning" /><span><strong className="block text-sm">Protect collections</strong><small className="text-muted-foreground">Review overdue and open invoices</small></span></Link>
          <Link href="/projects" className="flex items-center gap-3 rounded-xl border border-border/60 p-4 transition-colors hover:bg-muted/30"><FileSignature className="size-5 text-primary" /><span><strong className="block text-sm">Convert proposals</strong><small className="text-muted-foreground">Follow up on unsigned work</small></span></Link>
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-primary/[0.04] p-4">
            {summary.projectedMarginPct == null ? <CircleDollarSign className="size-5 text-muted-foreground" /> : <TrendingUp className="size-5 text-primary" />}
            <span>
              <strong className="block text-sm">Projected committed margin · {projectedMargin}</strong>
              <small className="text-muted-foreground">
                {summary.committedEstimateCount == null
                  ? summary.projectedMarginCoverage.detail
                  : `${summary.committedEstimateCount} accepted estimate snapshot${summary.committedEstimateCount === 1 ? "" : "s"}${summary.projectedGrossProfit == null ? "" : ` · ${formatCurrency(summary.projectedGrossProfit)} projected gross profit`}`}
              </small>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
          <span>{generatedLabel}</span>
          <span>Actual job margin remains locked until field labor, material, and equipment costs are captured.</span>
        </div>
      </CardContent>
    </Card>
  );
}
