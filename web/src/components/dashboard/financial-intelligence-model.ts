import type { CurrentWeekPaymentLedger } from "@/lib/payment-ledger";
import type { FinancialSourceCoverage, FinancialSummary } from "@/lib/api";
import type { AttentionProposalRow } from "./needs-attention-model";
import type { ReceivablesSummary } from "./receivables-model";

export interface FinancialIntelligenceSummary {
  collectedThisWeek: number | null;
  paymentCount: number | null;
  outstandingReceivables: number | null;
  overdueReceivables: number | null;
  openInvoiceCount: number | null;
  overdueInvoiceCount: number | null;
  unsignedProposalOpportunity: number | null;
  unsignedProposalCount: number | null;
  receivablesPartial: boolean;
  proposalsPartial: boolean;
  projectedMarginPct: number | null;
  projectedGrossProfit: number | null;
  committedEstimateCount: number | null;
  projectedMarginCoverage: FinancialSourceCoverage;
  actualJobCostCoverage: FinancialSourceCoverage;
  generatedAt: string | null;
  exactOrganizationSummary: boolean;
}

export function buildFinancialIntelligenceSummary(input: {
  paymentLedger: CurrentWeekPaymentLedger | null;
  receivables: ReceivablesSummary;
  proposals: AttentionProposalRow[];
  unsignedProposalTotal: number;
  invoiceError?: string | null;
  proposalError?: string | null;
  backendSummary?: FinancialSummary | null;
}): FinancialIntelligenceSummary {
  if (input.backendSummary) {
    const backend = input.backendSummary;
    return {
      collectedThisWeek: backend.cashCollected.amount,
      paymentCount: backend.cashCollected.paymentCount,
      outstandingReceivables: backend.receivables.openAmount,
      overdueReceivables: backend.receivables.overdueAmount,
      openInvoiceCount: backend.receivables.openInvoiceCount,
      overdueInvoiceCount: backend.receivables.overdueInvoiceCount,
      unsignedProposalOpportunity: backend.unsignedOpportunity.amount,
      unsignedProposalCount: backend.unsignedOpportunity.proposalCount,
      receivablesPartial: backend.receivables.coverage.status === "partial",
      proposalsPartial: backend.unsignedOpportunity.coverage.status === "partial",
      projectedMarginPct: backend.projectedCommittedMargin.marginPct,
      projectedGrossProfit: backend.projectedCommittedMargin.grossProfit,
      committedEstimateCount: backend.projectedCommittedMargin.estimateCount,
      projectedMarginCoverage: backend.projectedCommittedMargin.coverage,
      actualJobCostCoverage: backend.actualJobCosts.coverage,
      generatedAt: backend.generatedAt,
      exactOrganizationSummary: true,
    };
  }

  const knownProposalAmounts = input.proposals
    .map((proposal) => proposal.amount)
    .filter((amount): amount is number => typeof amount === "number" && Number.isFinite(amount));

  return {
    collectedThisWeek: input.paymentLedger?.totalAmount ?? null,
    paymentCount: input.paymentLedger?.paymentCount ?? null,
    outstandingReceivables: input.invoiceError ? null : input.receivables.loadedOutstanding,
    overdueReceivables: input.invoiceError ? null : input.receivables.loadedOverdueOutstanding,
    openInvoiceCount: input.invoiceError ? null : input.receivables.openInvoiceTotal,
    overdueInvoiceCount: input.invoiceError ? null : input.receivables.overdueInvoiceTotal,
    unsignedProposalOpportunity: input.proposalError ? null : knownProposalAmounts.reduce((sum, amount) => sum + amount, 0),
    unsignedProposalCount: input.proposalError ? null : input.unsignedProposalTotal,
    receivablesPartial: input.receivables.isPartial,
    proposalsPartial:
      input.proposals.length < input.unsignedProposalTotal ||
      knownProposalAmounts.length < input.proposals.length,
    projectedMarginPct: null,
    projectedGrossProfit: null,
    committedEstimateCount: null,
    projectedMarginCoverage: { status: "unavailable", detail: "The organization financial summary is unavailable." },
    actualJobCostCoverage: { status: "unavailable", detail: "An organization-wide actual job-cost source is not available." },
    generatedAt: null,
    exactOrganizationSummary: false,
  };
}
