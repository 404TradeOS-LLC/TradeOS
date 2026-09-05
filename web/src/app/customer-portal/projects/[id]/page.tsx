import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { getPortalProject } from "@/lib/api";
import { formatCurrency, formatInvoiceCurrency, getInvoiceDisplayStatus, getProposalDisplayStatus } from "@/lib/document-workflow";

export default async function CustomerPortalProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getPortalProject(id);
  const proposal = project.proposals[0] ?? null;
  const contract = project.contracts[0] ?? null;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <div className="space-y-3"><Link href="/customer-portal" className="text-sm text-muted-foreground underline">← All projects</Link><p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Customer portal</p><h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1><p className="text-muted-foreground">{project.siteAddress ?? "Address to be confirmed"}</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle>Proposal</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{proposal ? <><StatusBadge status={getProposalDisplayStatus(proposal)} /><p className="text-muted-foreground">{formatCurrency(proposal.finalPrice ?? proposal.priceHigh ?? proposal.priceLow)}</p><Link href={`/customer-portal/proposals/${proposal.id}`} className={buttonVariants()}>Review proposal</Link></> : <p className="text-muted-foreground">No proposal has been shared yet.</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Contract</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{contract ? <><StatusBadge status={contract.status} /><p className="text-muted-foreground">{contract.contractAmount == null ? "Agreement amount pending" : formatInvoiceCurrency(contract.contractAmount)}</p><Link href={`/customer-portal/contracts/${contract.id}`} className={buttonVariants()}>Review contract</Link></> : <p className="text-muted-foreground">No contract has been shared yet.</p>}</CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Invoices</CardTitle></CardHeader><CardContent className="space-y-3">{project.invoices.length ? project.invoices.map((invoice) => <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 py-3 last:border-0"><div className="space-y-1 text-sm"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">Invoice #{invoice.invoiceNumber}</span><StatusBadge status={getInvoiceDisplayStatus(invoice)} /></div><div className="text-muted-foreground">Total {formatInvoiceCurrency(invoice.amount)} · Due {formatInvoiceCurrency(invoice.balanceDue)}</div></div><Link href={`/customer-portal/invoices/${invoice.id}`} className={buttonVariants({ variant: "outline" })}>View invoice</Link></div>) : <p className="text-sm text-muted-foreground">No invoices have been issued yet.</p>}</CardContent></Card>
    </main>
  );
}
