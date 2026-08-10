import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/document-workflow";
import { getCurrentWeekPaymentLedger } from "@/lib/payment-ledger";
import { getSessionToken } from "@/lib/session";

export const metadata: Metadata = {
  title: "Revenue This Week | TradeOS",
  description: "Recorded payments that make up the owner dashboard's Revenue This Week KPI.",
};

function formatPaymentDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMethod(method: string) {
  return method
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function RevenueThisWeekPage() {
  const token = await getSessionToken();

  if (!token) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Revenue This Week" description="Recorded payments represented by the owner dashboard KPI." backHref="/dashboard" backLabel="Dashboard" />
        <EmptyState title="Revenue data is unavailable." description="Sign in again to load the payment ledger behind this dashboard metric." />
      </div>
    );
  }

  const ledger = await getCurrentWeekPaymentLedger(token).catch(() => null);

  if (!ledger) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Revenue This Week" description="Recorded payments represented by the owner dashboard KPI." backHref="/dashboard" backLabel="Dashboard" />
        <EmptyState
          title="Payment ledger is temporarily unavailable."
          description="The dashboard will not substitute paid-invoice totals when the payment source cannot be loaded."
          action={
            <Link href="/projects" className={buttonVariants({ variant: "outline" })}>
              Review projects
            </Link>
          }
        />
      </div>
    );
  }

  const timeZone = ledger.timezone.timezone;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Revenue This Week"
        description={`Recorded payment transactions in the current organization week (${timeZone}).`}
        backHref="/dashboard"
        backLabel="Dashboard"
      />

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>{formatCurrency(ledger.totalAmount)}</CardTitle>
          <CardDescription>
            {ledger.paymentCount} recorded {ledger.paymentCount === 1 ? "payment" : "payments"}. This is the same source used by the dashboard KPI.
          </CardDescription>
        </CardHeader>
      </Card>

      {ledger.payments.length === 0 ? (
        <EmptyState
          title="No recorded payments this week."
          description="Payments recorded against invoices during this organization week will appear here and contribute to Revenue This Week."
          action={
            <Link href="/projects" className={buttonVariants({ variant: "outline" })}>
              Review projects
            </Link>
          }
        />
      ) : (
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Payment ledger</CardTitle>
            <CardDescription>Each row is a persisted Payment record, not an inferred invoice-status event.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {ledger.payments.map((payment) => (
              <article key={payment.id} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={payment.status} />
                      <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Invoice #{payment.invoice.invoiceNumber}
                      </span>
                    </div>
                    <h2 className="mt-2 break-words font-semibold text-foreground">{payment.invoice.project.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{payment.invoice.project.customer?.name ?? "No customer linked"}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{formatCurrency(payment.amount)}</span>
                      <span>{formatMethod(payment.method)}</span>
                      <span>{formatPaymentDate(payment.paymentDate, timeZone)}</span>
                      {payment.reference ? <span>Ref: {payment.reference}</span> : null}
                    </div>
                    {payment.notes ? <p className="mt-2 text-sm text-muted-foreground">{payment.notes}</p> : null}
                  </div>
                  <Link
                    href={`/projects/${payment.invoice.project.id}/invoices/${payment.invoice.id}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Open invoice
                  </Link>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>
      )}

      {ledger.timezone.isFallback ? (
        <p className="text-xs leading-5 text-muted-foreground">Organization timezone is missing or invalid, so this weekly ledger is using UTC boundaries.</p>
      ) : null}
    </div>
  );
}
