import type { CurrentWeekPaymentLedger } from "@/lib/payment-ledger";
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
  marginAvailable: false;
}

export function buildFinancialIntelligenceSummary(input: {
  paymentLedger: CurrentWeekPaymentLedger | null;
  receivables: ReceivablesSummary;
  proposals: AttentionProposalRow[];
  unsignedProposalTotal: number;
  invoiceError?: string | null;
  proposalError?: string | null;
}): FinancialIntelligenceSummary {
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
    marginAvailable: false,
  };
}
