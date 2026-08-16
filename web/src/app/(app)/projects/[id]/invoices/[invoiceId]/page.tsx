import Link from "next/link";
import { markInvoicePaidAction, sendInvoiceAction, voidInvoiceAction } from "@/app/actions/invoices";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { LineItemRow } from "@/components/shared/line-item-row";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInvoice, getProject } from "@/lib/api";
import { buildInvoiceTimeline, formatCurrency, formatDate, getInvoiceDisplayStatus, getInvoiceRunningBalance } from "@/lib/document-workflow";
import { getSessionToken } from "@/lib/session";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string; invoiceId: string }> }) {
  const { id: projectId, invoiceId } = await params;
  const token = await getSessionToken();
  const [project, invoice] = await Promise.all([getProject(token ?? "", projectId), getInvoice(token ?? "", invoiceId)]);
  const timeline = buildInvoiceTimeline(invoice);
  const displayStatus = getInvoiceDisplayStatus(invoice);
  const runningBalance = getInvoiceRunningBalance(invoice);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Invoice #${invoice.invoiceNumber}`}
        backHref={`/projects/${projectId}`}
        backLabel="Back to project"
        action={<StatusBadge status={displayStatus} />}
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Invoice center</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Customer</div>
              <div className="mt-2 font-medium">{project.customer?.name ?? "No customer linked"}</div>
              <div className="mt-1 text-sm text-muted-foreground">{project.customer?.email ?? "No customer email saved"}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Project</div>
              <div className="mt-2 font-medium">{project.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">{project.siteAddress ?? "No address saved"}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Running balance</div>
              <div className="mt-2 text-2xl font-semibold">{formatCurrency(runningBalance)}</div>
              <div className="mt-1 text-sm text-muted-foreground">Use this balance to confirm what is still outstanding on the job and whether the invoice is ready to close.</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Billing type</div>
              <div className="mt-2 font-medium">{invoice.type === "progress" ? "Progress invoice" : "Final invoice"}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {invoice.type === "progress" && invoice.percentComplete != null ? `${invoice.percentComplete}% complete billed.` : "Full contract value billed."}
              </div>
            </div>
          </CardContent>
        </Card>

        <ActivityTimeline title="Invoice timeline" items={timeline} />
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {invoice.lineItems.map((li) => (
            <LineItemRow key={li.id} description={li.description} amount={formatCurrency(li.lineCost)} className="border-none p-0" />
          ))}
          <div className="flex items-center justify-between gap-3 border-t pt-2 text-base font-semibold">
            <span className="min-w-0 truncate">Total</span>
            <span className="shrink-0">{formatCurrency(invoice.amount)}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Billing summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3 text-sm">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Status</div>
            <div className="mt-2 font-medium">{displayStatus}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Due date</div>
            <div className="mt-2 font-medium">{formatDate(invoice.dueDate)}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Payment history</div>
            <div className="mt-2 text-muted-foreground">{invoice.paidAt ? "Paid in full" : "No payments recorded yet"}</div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardContent className="flex flex-col gap-4 pt-6">
          <a
            href={`/api/documents/invoices/${invoice.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            Download PDF
          </a>

          <Link href={`/portal/invoices/${invoice.id}`} className={buttonVariants({ variant: "outline" })}>
            Open customer portal view
          </Link>

          {invoice.status === "draft" && (
            <form action={sendInvoiceAction}>
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <input type="hidden" name="projectId" value={projectId} />
              <Button type="submit">Send invoice</Button>
            </form>
          )}

          {(invoice.status === "sent" || invoice.status === "overdue") && (
            <form action={markInvoicePaidAction}>
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <input type="hidden" name="projectId" value={projectId} />
              <Button type="submit">Mark paid</Button>
            </form>
          )}

          {invoice.status !== "paid" && invoice.status !== "voided" && (
            <form action={voidInvoiceAction}>
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <input type="hidden" name="projectId" value={projectId} />
              <Button type="submit" variant="destructive">
                Void invoice
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
