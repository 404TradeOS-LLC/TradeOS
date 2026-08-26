import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { getProject } from "@/lib/api";
import { formatInvoiceCurrency, formatCurrency, getInvoiceDisplayStatus, getProposalDisplayStatus } from "@/lib/document-workflow";
import { getSessionToken } from "@/lib/session";

export default async function CustomerPortalProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  const project = await getProject(token ?? "", id);
  const latestProposal = project.proposals[0] ?? null;
  const latestContract = project.contracts[0] ?? null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="space-y-3">
        <div className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Customer portal</div>
        <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Review the current proposal, contract, invoices, and project progress in one simple customer-facing workspace.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Proposal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>{latestProposal ? <StatusBadge status={getProposalDisplayStatus(latestProposal)} /> : "Not issued yet"}</div>
            <div className="text-muted-foreground">{latestProposal ? formatCurrency(latestProposal.finalPrice ?? latestProposal.priceHigh ?? latestProposal.priceLow) : "Waiting on pricing"}</div>
            {latestProposal && (
              <Link href={`/portal/proposals/${latestProposal.id}`} className={buttonVariants()}>
                Review proposal
              </Link>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Contract</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>{latestContract ? <StatusBadge status={latestContract.status} /> : "Not created yet"}</div>
            <div className="text-muted-foreground">{latestContract ? "Ready for signature review." : "Contract appears after proposal acceptance."}</div>
            {latestContract && (
              <Link href={`/portal/contracts/${latestContract.id}`} className={buttonVariants()}>
                Review contract
              </Link>
            )}
          </CardContent>
        </Card>

      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {project.invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices have been issued for this project yet.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {project.invoices.map((invoice) => (
                <div key={invoice.id} className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">Invoice #{invoice.invoiceNumber}</span>
                      <StatusBadge status={getInvoiceDisplayStatus(invoice)} />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                      <span>Total {formatInvoiceCurrency(invoice.amount)}</span>
                      <span>Paid {formatInvoiceCurrency(invoice.paidAmount)}</span>
                      <span>Due {formatInvoiceCurrency(invoice.balanceDue)}</span>
                    </div>
                  </div>
                  <Link href={`/portal/invoices/${invoice.id}`} className={buttonVariants({ variant: "outline" })}>
                    View invoice
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
