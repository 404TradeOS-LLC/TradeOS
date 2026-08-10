import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/document-workflow";
import { createEstimateAction } from "@/app/actions/projects";

export interface AttentionEstimateRow {
  projectId: string;
  projectName: string;
  customerName: string;
  estimateId: string;
  version: number;
  status: string;
  totalPrice: number;
}

export interface AttentionProposalRow {
  projectId: string;
  projectName: string;
  customerName: string;
  proposalId: string;
  status: string;
  amount: number | null;
}

export interface AttentionInvoiceRow {
  projectId: string;
  projectName: string;
  customerName: string;
  invoiceId: string;
  status: string;
  amount: number;
  dueDate: string | null;
}

export interface AttentionStartRow {
  projectId: string;
  projectName: string;
  customerName: string;
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border/60 bg-muted/20 p-4">{children}</div>;
}

function RowHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="min-w-0">
      <div className="break-words font-medium text-foreground">{title}</div>
      <div className="break-words text-sm text-muted-foreground">{subtitle}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{children}</h2>;
}

export function NeedsAttentionCard({
  estimates,
  proposals,
  invoices,
  readyToStart,
  scopeLabel,
}: {
  estimates: AttentionEstimateRow[];
  proposals: AttentionProposalRow[];
  invoices: AttentionInvoiceRow[];
  readyToStart: AttentionStartRow[];
  scopeLabel: string;
}) {
  const hasAnything = estimates.length + proposals.length + invoices.length + readyToStart.length > 0;

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Needs attention</CardTitle>
        <CardDescription>The decisions and next steps found in the {scopeLabel}, ahead of the summary metrics below.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!hasAnything ? (
          <EmptyState
            title="Nothing waiting on you right now"
            description="Create a project to start the first estimate, or check back once a proposal or invoice needs a response."
            action={
              <Link href="/projects/new" className={buttonVariants({ variant: "outline" })}>
                Create a project
              </Link>
            }
          />
        ) : (
          <>
            {estimates.length > 0 ? (
              <div id="open-estimates" className="scroll-mt-6 space-y-2">
                <SectionLabel>Estimates in progress</SectionLabel>
                <div className="space-y-2">
                  {estimates.map((row) => (
                    <Row key={row.estimateId}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <RowHeader
                          title={`${row.projectName} · v${row.version}`}
                          subtitle={`${row.customerName} · ${formatCurrency(row.totalPrice)}`}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={row.status} />
                          <Link
                            href={`/projects/${row.projectId}/estimates/${row.estimateId}`}
                            aria-label={`Continue ${row.projectName} estimate v${row.version}`}
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                          >
                            Continue
                          </Link>
                          {row.status === "draft" ? (
                            <Link
                              href={`/projects/${row.projectId}/estimates/${row.estimateId}/assist`}
                              aria-label={`Open AI assist for ${row.projectName} estimate v${row.version}`}
                              className={buttonVariants({ variant: "outline", size: "sm" })}
                            >
                              AI assist
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </Row>
                  ))}
                </div>
              </div>
            ) : null}

            {proposals.length > 0 ? (
              <div className="space-y-2">
                <SectionLabel>Proposals awaiting a response</SectionLabel>
                <div className="space-y-2">
                  {proposals.map((row) => (
                    <Row key={row.proposalId}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <RowHeader
                          title={row.projectName}
                          subtitle={row.amount != null ? `${row.customerName} · ${formatCurrency(row.amount)}` : row.customerName}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={row.status} />
                          <Link
                            href={`/projects/${row.projectId}/proposals/${row.proposalId}`}
                            aria-label={`Review proposal for ${row.projectName}`}
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                          >
                            Review proposal
                          </Link>
                        </div>
                      </div>
                    </Row>
                  ))}
                </div>
              </div>
            ) : null}

            {invoices.length > 0 ? (
              <div id="invoices-waiting" className="scroll-mt-6 space-y-2">
                <SectionLabel>Invoices needing follow-up</SectionLabel>
                <div className="space-y-2">
                  {invoices.map((row) => (
                    <Row key={row.invoiceId}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <RowHeader
                          title={row.projectName}
                          subtitle={`${row.customerName} · ${formatCurrency(row.amount)}${row.dueDate ? ` · due ${formatDate(row.dueDate)}` : ""}`}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={row.status} />
                          <Link
                            href={`/projects/${row.projectId}/invoices/${row.invoiceId}`}
                            aria-label={`Review invoice for ${row.projectName}`}
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                          >
                            Review invoice
                          </Link>
                        </div>
                      </div>
                    </Row>
                  ))}
                </div>
              </div>
            ) : null}

            {readyToStart.length > 0 ? (
              <div className="space-y-2">
                <SectionLabel>Ready to start an estimate</SectionLabel>
                <div className="space-y-2">
                  {readyToStart.map((row) => (
                    <Row key={row.projectId}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <RowHeader title={row.projectName} subtitle={row.customerName} />
                        <form action={createEstimateAction}>
                          <input type="hidden" name="projectId" value={row.projectId} />
                          <Button type="submit" size="sm" aria-label={`Start estimate for ${row.projectName}`}>
                            Start estimate
                          </Button>
                        </form>
                      </div>
                    </Row>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
