import Link from "next/link";
import {
  CircleDollarSign,
  FileText,
  Info,
  ReceiptText,
} from "lucide-react";
import { markInvoicePaidAction, sendInvoiceAction, voidInvoiceAction } from "@/app/actions/invoices";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { LineItemRow } from "@/components/shared/line-item-row";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInvoice, getOrganizationSettings, getProject } from "@/lib/api";
import {
  buildInvoiceTimeline,
  formatDate,
  formatInvoiceCurrency,
  getInvoiceDisplayStatus,
} from "@/lib/document-workflow";
import { getSessionToken } from "@/lib/session";
import { RecordPaymentForm } from "./record-payment-form";

function invoiceTypeLabel(type: "full" | "progress") {
  return type === "progress" ? "Progress invoice" : "Final invoice";
}

function MoneyMetric({
  label,
  value,
  helper,
  emphasis = false,
}: {
  label: string;
  value: string;
  helper?: string;
  emphasis?: boolean;
}) {
  return (
    <div className={emphasis ? "rounded-xl border border-primary/25 bg-primary/5 p-4" : "rounded-xl border border-border/70 bg-card p-4"}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string; invoiceId: string }> }) {
  const { id: projectId, invoiceId } = await params;
  const token = await getSessionToken();
  const [project, invoice, settings] = await Promise.all([
    getProject(token ?? "", projectId),
    getInvoice(token ?? "", invoiceId),
    getOrganizationSettings(token ?? ""),
  ]);

  // Keep this list in exact lockstep with the backend billing.write role grant.
  // page.test.ts intentionally fails if either side changes independently.
  const canRecordPayment = ["owner", "admin", "dispatcher", "estimator"].includes(settings.currentRole);
  const timeline = buildInvoiceTimeline(invoice);
  const displayStatus = getInvoiceDisplayStatus(invoice);
  const paymentCount = invoice.payments.length;
  const hasOpenBalance = invoice.balanceDue > 0;
  const canShowPaymentEntry =
    canRecordPayment &&
    hasOpenBalance &&
    (invoice.status === "sent" || invoice.status === "overdue");
  const sentLabel = invoice.sentAt ? `Sent ${formatDate(invoice.sentAt)}` : "Not sent yet";
  const dueLabel = invoice.dueDate ? `Due ${formatDate(invoice.dueDate)}` : "No due date";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Invoice #${invoice.invoiceNumber}`}
        breadcrumbs={[
          { label: project.name, href: `/projects/${projectId}` },
          { label: `Invoice #${invoice.invoiceNumber}` },
        ]}
        description={`${project.customer?.name ?? "No customer linked"} · ${invoiceTypeLabel(invoice.type)} · ${sentLabel} · ${dueLabel}`}
        action={<StatusBadge status={displayStatus} />}
      />

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Invoice financial summary">
        <MoneyMetric label="Invoice total" value={formatInvoiceCurrency(invoice.amount)} />
        <MoneyMetric
          label="Paid"
          value={formatInvoiceCurrency(invoice.paidAmount)}
          helper={`${paymentCount} recorded payment${paymentCount === 1 ? "" : "s"}`}
        />
        <MoneyMetric
          label="Balance due"
          value={formatInvoiceCurrency(invoice.balanceDue)}
          helper={dueLabel}
          emphasis={hasOpenBalance}
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid content-start gap-5">
          <Card className="border-border/70">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base">Billing</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Type</p>
                <p className="mt-1 text-sm font-medium text-foreground">{invoiceTypeLabel(invoice.type)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {invoice.type === "progress" && invoice.percentComplete != null
                    ? `${invoice.percentComplete}% complete billed`
                    : "Full contract value"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Customer</p>
                <p className="mt-1 text-sm font-medium text-foreground">{project.customer?.name ?? "No customer linked"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{project.customer?.email ?? "No customer email saved"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Job</p>
                <Link href={`/projects/${projectId}`} className="mt-1 block text-sm font-medium text-foreground underline-offset-4 hover:underline">
                  {project.name}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">{project.siteAddress ?? "No site address saved"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Status</p>
                <div className="mt-1"><StatusBadge status={displayStatus} /></div>
                <p className="mt-1 text-xs text-muted-foreground">{dueLabel}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-base">Work performed</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {invoice.lineItems.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {invoice.lineItems.map((line) => (
                    <LineItemRow
                      key={line.id}
                      description={line.description}
                      amount={formatInvoiceCurrency(line.lineTotal)}
                      className="border-none px-0 py-2"
                    />
                  ))}
                </div>
              ) : (
                <p className="py-4 text-sm text-muted-foreground">No invoice line items are available.</p>
              )}

              <div className="ml-auto mt-3 grid w-full max-w-sm gap-2 border-t border-border/70 pt-4 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono tabular-nums">{formatInvoiceCurrency(invoice.subtotal)}</span>
                </div>
                {invoice.taxAmount > 0 ? (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Tax{invoice.taxPct > 0 ? ` (${invoice.taxPct}%)` : ""}</span>
                    <span className="font-mono tabular-nums">{formatInvoiceCurrency(invoice.taxAmount)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Invoice total</span>
                  <span className="font-mono font-medium tabular-nums">{formatInvoiceCurrency(invoice.amount)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-mono tabular-nums">− {formatInvoiceCurrency(invoice.paidAmount)}</span>
                </div>
                <div className="flex justify-between gap-3 border-t border-border/60 pt-2 font-semibold">
                  <span>Balance due</span>
                  <span className="font-mono tabular-nums">{formatInvoiceCurrency(invoice.balanceDue)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <ActivityTimeline title="Invoice activity" items={timeline} />
        </div>

        <aside className="grid content-start gap-4 xl:sticky xl:top-20 xl:self-start">
          {hasOpenBalance ? (
            <Card className="border-primary/25">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CircleDollarSign className="size-4 text-primary" aria-hidden="true" />
                  <CardTitle className="text-base">Next action</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div>
                  <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                    {formatInvoiceCurrency(invoice.balanceDue)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    remains due · {dueLabel} · {paymentCount} recorded payment{paymentCount === 1 ? "" : "s"}
                  </p>
                </div>

                {invoice.status === "draft" ? (
                  <form action={sendInvoiceAction}>
                    <input type="hidden" name="invoiceId" value={invoice.id} />
                    <input type="hidden" name="projectId" value={projectId} />
                    <Button type="submit" className="w-full">Send invoice</Button>
                  </form>
                ) : null}

                {canShowPaymentEntry ? (
                  <RecordPaymentForm projectId={projectId} invoiceId={invoice.id} balanceDue={invoice.balanceDue} />
                ) : null}

                {!canRecordPayment && (invoice.status === "sent" || invoice.status === "overdue") ? (
                  <p className="text-sm text-muted-foreground">Your current role can review billing but cannot record payments.</p>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-success/25 bg-success/5">
              <CardContent className="pt-5">
                <p className="font-medium text-foreground">No balance remains due</p>
                <p className="mt-1 text-sm text-muted-foreground">Invoice payment state is derived from recorded-payment and invoice status truth.</p>
              </CardContent>
            </Card>
          )}

          <div className="rounded-xl border border-info/25 bg-info/5 p-4">
            <div className="flex gap-3">
              <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-foreground">Record Payment tracks money received</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  It records payment activity on this invoice. It does not mean TradeOS processed the customer&apos;s payment.
                </p>
              </div>
            </div>
          </div>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="text-base">Document</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <a
                href={`/api/documents/invoices/${invoice.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "outline" })}
              >
                <FileText className="size-4" aria-hidden="true" />
                Open PDF
              </a>
              <Link href={`/portal/invoices/${invoice.id}`} className={buttonVariants({ variant: "outline" })}>
                <ReceiptText className="size-4" aria-hidden="true" />
                Customer Portal
              </Link>
              <p className="text-xs text-muted-foreground">Customer-view telemetry is not currently recorded.</p>
            </CardContent>
          </Card>

          {invoice.status !== "paid" && invoice.status !== "voided" ? (
            <details className="rounded-xl border border-border/70 bg-card p-4">
              <summary className="cursor-pointer text-sm font-medium text-foreground">More billing actions</summary>
              <div className="mt-4 grid gap-2">
                {(invoice.status === "sent" || invoice.status === "overdue") ? (
                  <form action={markInvoicePaidAction}>
                    <input type="hidden" name="invoiceId" value={invoice.id} />
                    <input type="hidden" name="projectId" value={projectId} />
                    <Button type="submit" variant="outline" className="w-full">
                      Mark paid without recording a payment
                    </Button>
                  </form>
                ) : null}

                <form action={voidInvoiceAction}>
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <input type="hidden" name="projectId" value={projectId} />
                  <Button type="submit" variant="destructive" className="w-full">
                    Void invoice
                  </Button>
                </form>
              </div>
            </details>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
