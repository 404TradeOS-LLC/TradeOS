import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileCheck2,
  FileText,
  Info,
  LockKeyhole,
  ReceiptText,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getPortalProject } from "@/lib/api";
import {
  formatCurrency,
  formatInvoiceCurrency,
  getInvoiceDisplayStatus,
  getProposalDisplayStatus,
} from "@/lib/document-workflow";
import { cn } from "@/lib/utils";

function customerGreeting(name: string | null | undefined) {
  const first = name?.trim().split(/\s+/)[0];
  return first ? `Hi ${first},` : "Welcome,";
}

function contractNeedsSignature(status: string) {
  return status !== "signed" && status !== "voided";
}

function DocumentRow({
  icon,
  label,
  status,
  summary,
  note,
  href,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  status: React.ReactNode;
  summary: string;
  note: string;
  href: string;
  action: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-24 items-center gap-3 px-4 py-4 outline-none transition-colors hover:bg-muted/30 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:px-5"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted/30 text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{label}</span>
          {status}
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">{summary}</span>
        <span className="mt-1 hidden text-xs text-muted-foreground sm:block">{note}</span>
      </span>
      <span className="hidden shrink-0 text-sm font-medium text-foreground md:block">{action}</span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}

export default async function CustomerPortalProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getPortalProject(id);
  const proposal = project.proposals[0] ?? null;
  const contract = project.contracts[0] ?? null;
  const needsSignature = contract ? contractNeedsSignature(contract.status) : false;

  const activeInvoices = project.invoices.filter((invoice) => invoice.status !== "voided");
  const invoiceTotal = activeInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const recordedPaid = activeInvoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0);
  const balanceDue = activeInvoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0);
  const paymentCount = activeInvoices.reduce((sum, invoice) => sum + invoice.payments.length, 0);

  return (
    <main className="min-h-screen bg-background">
      <div className="border-b border-border/70 bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="font-heading text-base font-semibold text-foreground">TradeOS Customer Portal</p>
            <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">Secure project documents shared by your contractor</p>
          </div>
          <Badge variant="outline" className="gap-1.5 border-success/30 bg-success/10 text-success">
            <LockKeyhole className="size-3.5" aria-hidden="true" />
            Secure customer session
          </Badge>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
        <header className="border-b border-border/70 pb-5">
          <Link href="/customer-portal" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            ← All projects
          </Link>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Customer portal</p>
          <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {customerGreeting(project.customer?.name)}
          </h1>
          <p className="mt-2 font-heading text-xl font-medium text-foreground">{project.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{project.siteAddress ?? "Address to be confirmed"}</p>
        </header>

        <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5" aria-labelledby="shared-documents-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="shared-documents-heading" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Shared documents
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Proposal · Contract · Invoice</p>
            </div>
            <p className="text-xs text-muted-foreground">Only items your contractor has shared appear here.</p>
          </div>

          {needsSignature && contract ? (
            <div className="mt-4 flex flex-col gap-4 rounded-xl border border-success/30 bg-success/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
                <div>
                  <p className="font-medium text-foreground">Your contract is ready for review and signature</p>
                  <p className="mt-1 text-sm text-muted-foreground">Review the agreed amount, scope, and terms before signing.</p>
                </div>
              </div>
              <Link href={`/customer-portal/contracts/${contract.id}`} className={cn(buttonVariants(), "shrink-0")}>
                Review & Sign Contract
              </Link>
            </div>
          ) : null}
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card" aria-labelledby="project-documents-heading">
            <div className="border-b border-border/70 px-4 py-4 sm:px-5">
              <h2 id="project-documents-heading" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Project documents
              </h2>
            </div>

            <div className="divide-y divide-border/60">
              {proposal ? (
                <DocumentRow
                  icon={<FileText className="size-4" />}
                  label="Proposal"
                  status={<StatusBadge status={getProposalDisplayStatus(proposal)} />}
                  summary={[
                    formatCurrency(proposal.finalPrice ?? proposal.priceHigh ?? proposal.priceLow),
                    proposal.timeline,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  note="Public proposal review is read-only in the current portal."
                  href={`/customer-portal/proposals/${proposal.id}`}
                  action="Review"
                />
              ) : (
                <div className="px-4 py-5 text-sm text-muted-foreground sm:px-5">No proposal has been shared yet.</div>
              )}

              {contract ? (
                <DocumentRow
                  icon={<FileCheck2 className="size-4" />}
                  label="Contract"
                  status={<StatusBadge status={contract.status} />}
                  summary={
                    contract.contractAmount == null
                      ? "Agreement amount pending"
                      : `${formatInvoiceCurrency(contract.contractAmount)} agreed amount · immutable scope snapshot`
                  }
                  note={
                    needsSignature
                      ? "Customer signature is supported for this pending contract."
                      : contract.status === "signed"
                        ? "Open the contract to review the signed agreement."
                        : "This contract was voided and is retained for document history."
                  }
                  href={`/customer-portal/contracts/${contract.id}`}
                  action={needsSignature ? "Review & Sign" : "Review"}
                />
              ) : (
                <div className="px-4 py-5 text-sm text-muted-foreground sm:px-5">No contract has been shared yet.</div>
              )}

              {project.invoices.length > 0 ? (
                project.invoices.map((invoice) => (
                  <DocumentRow
                    key={invoice.id}
                    icon={<ReceiptText className="size-4" />}
                    label={`Invoice #${invoice.invoiceNumber}`}
                    status={<StatusBadge status={getInvoiceDisplayStatus(invoice)} />}
                    summary={`${formatInvoiceCurrency(invoice.amount)} total · ${formatInvoiceCurrency(invoice.paidAmount)} recorded paid · ${formatInvoiceCurrency(invoice.balanceDue)} balance due`}
                    note="Payment history is shown; public payment processing is not available."
                    href={`/customer-portal/invoices/${invoice.id}`}
                    action="View Invoice"
                  />
                ))
              ) : (
                <div className="px-4 py-5 text-sm text-muted-foreground sm:px-5">No invoices have been issued yet.</div>
              )}
            </div>
          </section>

          <aside className="grid content-start gap-4">
            <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <CircleDollarSign className="size-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Money</h2>
              </div>

              <div className="mt-4 grid gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Invoice total</p>
                  <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-foreground">{formatInvoiceCurrency(invoiceTotal)}</p>
                </div>
                <div className="border-t border-border/60 pt-3">
                  <p className="text-xs text-muted-foreground">Recorded paid</p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">{formatInvoiceCurrency(recordedPaid)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {paymentCount} payment{paymentCount === 1 ? "" : "s"} recorded on active invoices
                  </p>
                </div>
                <div className="border-t border-border/60 pt-3">
                  <p className="text-xs text-muted-foreground">Balance due</p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">{formatInvoiceCurrency(balanceDue)}</p>
                </div>
              </div>
              {project.invoices.some((invoice) => invoice.status === "voided") ? (
                <p className="mt-3 text-xs text-muted-foreground">Voided invoices remain in document history but are excluded from the current Money totals.</p>
              ) : null}
            </section>

            <section className="rounded-2xl border border-info/25 bg-info/5 p-4">
              <div className="flex gap-3">
                <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-foreground">Current portal capability</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    This secure portal currently covers project documents. Messaging, project progress/photos, schedule updates, customer change-order approval, and Pay Now are not current public portal capabilities.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
