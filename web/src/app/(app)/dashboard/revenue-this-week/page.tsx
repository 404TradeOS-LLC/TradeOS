import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/document-workflow";
import { getOrganizationSettings, getProject, listProjects } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { mergeTradeOsSettingsDraft } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Revenue This Week | TradeOS",
  description: "Paid invoices that make up the owner dashboard's Revenue This Week KPI.",
};

const DASHBOARD_PROJECT_DETAIL_LIMIT = 8;

function getSafeTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "UTC";
  }
}

function toValidDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function getZonedDayOrdinal(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function isSameWeek(value: string | null | undefined, comparison: Date, timeZone: string) {
  const date = toValidDate(value);
  if (!date) return false;
  const comparisonDay = getZonedDayOrdinal(comparison, timeZone);
  const weekStart = comparisonDay - new Date(comparisonDay * 86_400_000).getUTCDay();
  const targetDay = getZonedDayOrdinal(date, timeZone);

  return targetDay >= weekStart && targetDay < weekStart + 7;
}

function formatPaidAt(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function RevenueThisWeekPage() {
  const token = await getSessionToken();

  if (!token) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Revenue This Week" description="Paid invoices represented by the owner dashboard KPI." backHref="/dashboard" backLabel="Dashboard" />
        <EmptyState title="Revenue data is unavailable." description="Sign in again to load the paid invoices behind this dashboard metric." />
      </div>
    );
  }

  const [projects, settingsResponse] = await Promise.all([listProjects(token), getOrganizationSettings(token)]);
  const projectDetails = await Promise.all(projects.slice(0, DASHBOARD_PROJECT_DETAIL_LIMIT).map((project) => getProject(token, project.id)));
  const settings = mergeTradeOsSettingsDraft(settingsResponse.settings);
  const timeZone = getSafeTimeZone(settings.timezone);
  const now = new Date();

  const paidInvoices = projectDetails
    .flatMap((project) =>
      project.invoices
        .filter((invoice) => invoice.status === "paid" && isSameWeek(invoice.paidAt, now, timeZone))
        .map((invoice) => ({
          invoice,
          projectId: project.id,
          projectName: project.name,
          customerName: project.customer?.name ?? "No customer linked",
        }))
    )
    .sort((a, b) => new Date(b.invoice.paidAt ?? 0).getTime() - new Date(a.invoice.paidAt ?? 0).getTime());

  const total = paidInvoices.reduce((sum, row) => sum + row.invoice.amount, 0);
  const scopeLabel = projectDetails.length < DASHBOARD_PROJECT_DETAIL_LIMIT ? `${projectDetails.length} loaded projects` : `recent ${DASHBOARD_PROJECT_DETAIL_LIMIT} loaded projects`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Revenue This Week"
        description={`Paid invoices recorded this week in the ${scopeLabel}, using the same scope and timezone rules as the dashboard KPI.`}
        backHref="/dashboard"
        backLabel="Dashboard"
      />

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>{formatCurrency(total)}</CardTitle>
          <CardDescription>
            {paidInvoices.length} paid {paidInvoices.length === 1 ? "invoice" : "invoices"} in the current organization week ({timeZone}).
          </CardDescription>
        </CardHeader>
      </Card>

      {paidInvoices.length === 0 ? (
        <EmptyState
          title="No paid invoices this week."
          description="When an invoice in the dashboard's loaded project scope is marked paid, it will appear here and contribute to Revenue This Week."
          action={
            <Link href="/projects" className={buttonVariants({ variant: "outline" })}>
              Review projects
            </Link>
          }
        />
      ) : (
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Paid invoices</CardTitle>
            <CardDescription>Open an invoice to review its billing timeline and payment state.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {paidInvoices.map(({ invoice, projectId, projectName, customerName }) => (
              <article key={invoice.id} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status="paid" />
                      <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Invoice #{invoice.invoiceNumber}</span>
                    </div>
                    <h2 className="mt-2 break-words font-semibold text-foreground">{projectName}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{customerName}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>{formatCurrency(invoice.amount)}</span>
                      {invoice.paidAt ? <span>Paid {formatPaidAt(invoice.paidAt, timeZone)}</span> : null}
                    </div>
                  </div>
                  <Link href={`/projects/${projectId}/invoices/${invoice.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Open invoice
                  </Link>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-xs leading-5 text-muted-foreground">
        This drill-down currently reconciles the KPI from paid invoice totals. TradeOS stores individual Payment records, but the current web read contract does not expose an organization-level payment ledger, so this page does not invent payment-level detail that the API does not return.
      </p>
    </div>
  );
}
