import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDate } from "@/lib/document-workflow";
import type { ReceivablesSummary } from "@/components/dashboard/receivables-model";

interface ReceivablesCardProps {
  summary: ReceivablesSummary;
  errorMessage?: string | null;
}

function StatBlock({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "attention" }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${tone === "attention" ? "text-destructive" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

/**
 * Displays a single outstanding-money summary: total open receivables,
 * overdue receivables, counts, and the top invoices by dollar priority.
 * Built from the same canonical invoice work-queue rows (and their
 * backend-computed balanceDue) that the Needs Attention card already uses —
 * no independent balance math.
 */
export function ReceivablesCard({ summary, errorMessage = null }: ReceivablesCardProps) {
  const hasInvoices = summary.loadedInvoiceCount > 0;

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Outstanding money</CardTitle>
        <CardDescription>
          Open receivables across the organization.
          {summary.isPartial ? ` Dollar totals reflect the ${summary.loadedInvoiceCount} most active of ${summary.openInvoiceTotal} open invoices.` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {errorMessage ? (
          // One or both invoice queues failed — the exact totals below would
          // be built from whichever queue came back, which understates the
          // real figures (a $0/0 stat standing in for "unknown" is exactly
          // what AGENTS.md's truthful-degraded-states rule forbids), so this
          // renders only the error state instead of partially-wrong numbers.
          <p className="text-sm text-destructive">{errorMessage} Try refreshing, or open Invoices directly.</p>
        ) : !hasInvoices ? (
          <EmptyState title="Nothing outstanding right now." description="No open invoices need follow-up across the organization." />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatBlock label="Total outstanding" value={formatCurrency(summary.loadedOutstanding)} />
              <StatBlock label="Overdue" value={formatCurrency(summary.loadedOverdueOutstanding)} tone={summary.overdueInvoiceTotal > 0 ? "attention" : "neutral"} />
              <StatBlock label="Open invoices" value={String(summary.openInvoiceTotal)} />
              <StatBlock label="Overdue invoices" value={String(summary.overdueInvoiceTotal)} tone={summary.overdueInvoiceTotal > 0 ? "attention" : "neutral"} />
            </div>

            {summary.topInvoices.length > 0 ? (
              <div className="space-y-2">
                {summary.topInvoices.map((invoice) => (
                  <div key={invoice.invoiceId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                    <div className="min-w-0">
                      <div className="break-words font-medium text-foreground">
                        {invoice.projectName} · Invoice #{invoice.documentNumber}
                      </div>
                      <div className="break-words text-sm text-muted-foreground">
                        {invoice.customerName} · {formatCurrency(invoice.balanceDue)} owed{invoice.dueDate ? ` · due ${formatDate(invoice.dueDate)}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={invoice.overdue ? "overdue" : invoice.paidAmount > 0 ? "partially_paid" : invoice.status} />
                      <Link
                        href={`/projects/${invoice.projectId}/invoices/${invoice.invoiceId}`}
                        aria-label={`Review invoice for ${invoice.projectName}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Review invoice
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
