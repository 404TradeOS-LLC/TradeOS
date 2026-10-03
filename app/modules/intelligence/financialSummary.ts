import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client";
import { applyOverhead, round2 } from "../estimate-engine/formulas";
import { PaymentLedgerService } from "../payments/service";

export type FinancialSourceStatus = "complete" | "partial" | "unavailable";

export interface FinancialSourceCoverage {
  status: FinancialSourceStatus;
  detail: string;
}

export interface FinancialSummaryDTO {
  generatedAt: string;
  cashCollected: {
    period: "current_week";
    amount: number | null;
    paymentCount: number | null;
    rangeUtc: { start: string; end: string } | null;
    timezone: { timezone: string; isFallback: boolean } | null;
    coverage: FinancialSourceCoverage;
  };
  receivables: {
    openAmount: number | null;
    overdueAmount: number | null;
    openInvoiceCount: number | null;
    overdueInvoiceCount: number | null;
    coverage: FinancialSourceCoverage;
  };
  unsignedOpportunity: {
    amount: number | null;
    proposalCount: number | null;
    pricedProposalCount: number | null;
    coverage: FinancialSourceCoverage;
  };
  projectedCommittedMargin: {
    sellAmount: number | null;
    costAmount: number | null;
    grossProfit: number | null;
    marginPct: number | null;
    estimateCount: number | null;
    coverage: FinancialSourceCoverage;
  };
  actualJobCosts: {
    amount: null;
    coverage: FinancialSourceCoverage;
  };
}

type InvoiceSummaryRow = {
  open_amount: unknown;
  overdue_amount: unknown;
  open_invoice_count: bigint | number;
  overdue_invoice_count: bigint | number;
};

type FinancialSummaryDatabase = Pick<typeof prisma, "$queryRaw" | "proposal" | "estimate">;
type PaymentLedgerReader = Pick<PaymentLedgerService, "listCurrentWeek">;

const unavailable = (detail: string): FinancialSourceCoverage => ({ status: "unavailable", detail });

export class FinancialSummaryService {
  constructor(
    private readonly db: FinancialSummaryDatabase = prisma,
    private readonly paymentLedger: PaymentLedgerReader = new PaymentLedgerService()
  ) {}

  async getOrganizationSummary(orgId: string, referenceInstant = new Date()): Promise<FinancialSummaryDTO> {
    const [cashResult, receivablesResult, opportunityResult, marginResult] = await Promise.allSettled([
      this.loadCash(orgId, referenceInstant),
      this.loadReceivables(orgId, referenceInstant),
      this.loadUnsignedOpportunity(orgId),
      this.loadProjectedCommittedMargin(orgId),
    ]);

    return {
      generatedAt: referenceInstant.toISOString(),
      cashCollected:
        cashResult.status === "fulfilled"
          ? cashResult.value
          : {
              period: "current_week",
              amount: null,
              paymentCount: null,
              rangeUtc: null,
              timezone: null,
              coverage: unavailable("The current-week payment ledger could not be read."),
            },
      receivables:
        receivablesResult.status === "fulfilled"
          ? receivablesResult.value
          : {
              openAmount: null,
              overdueAmount: null,
              openInvoiceCount: null,
              overdueInvoiceCount: null,
              coverage: unavailable("Invoice balances could not be summarized."),
            },
      unsignedOpportunity:
        opportunityResult.status === "fulfilled"
          ? opportunityResult.value
          : {
              amount: null,
              proposalCount: null,
              pricedProposalCount: null,
              coverage: unavailable("Unsigned proposals could not be summarized."),
            },
      projectedCommittedMargin:
        marginResult.status === "fulfilled"
          ? marginResult.value
          : {
              sellAmount: null,
              costAmount: null,
              grossProfit: null,
              marginPct: null,
              estimateCount: null,
              coverage: unavailable("Accepted estimate snapshots could not be summarized."),
            },
      actualJobCosts: {
        amount: null,
        coverage: unavailable("TradeOS does not yet persist organization-wide actual labor, material, and equipment costs against jobs."),
      },
    };
  }

  private async loadCash(orgId: string, referenceInstant: Date): Promise<FinancialSummaryDTO["cashCollected"]> {
    const ledger = await this.paymentLedger.listCurrentWeek(orgId, referenceInstant);
    return {
      period: "current_week",
      amount: round2(ledger.totalAmount),
      paymentCount: ledger.paymentCount,
      rangeUtc: ledger.rangeUtc,
      timezone: ledger.timezone,
      coverage: { status: "complete", detail: "All recorded payments in the current organization week." },
    };
  }

  private async loadReceivables(orgId: string, referenceInstant: Date): Promise<FinancialSummaryDTO["receivables"]> {
    const rows = await this.db.$queryRaw<InvoiceSummaryRow[]>(Prisma.sql`
      with balances as (
        select
          i.status,
          i.due_date,
          case
            when i.status = 'paid' then 0
            else greatest(i.amount - coalesce(payments.paid_amount, 0), 0)
          end as balance_due
        from invoices i
        join projects p on p.id = i.project_id
        left join (
          select invoice_id, sum(amount) as paid_amount
          from payments
          where org_id = ${orgId}::uuid and status = 'recorded'
          group by invoice_id
        ) payments on payments.invoice_id = i.id
        where p.org_id = ${orgId}::uuid
      ), open_balances as (
        select *
        from balances
        where balance_due > 0
          and status not in ('paid', 'void', 'voided', 'cancelled')
      )
      select
        coalesce(sum(balance_due), 0) as open_amount,
        coalesce(sum(balance_due) filter (where due_date is not null and due_date < ${referenceInstant}), 0) as overdue_amount,
        count(*)::bigint as open_invoice_count,
        count(*) filter (where due_date is not null and due_date < ${referenceInstant})::bigint as overdue_invoice_count
      from open_balances
    `);
    const row = rows[0];

    return {
      openAmount: round2(Number(row?.open_amount ?? 0)),
      overdueAmount: round2(Number(row?.overdue_amount ?? 0)),
      openInvoiceCount: Number(row?.open_invoice_count ?? 0),
      overdueInvoiceCount: Number(row?.overdue_invoice_count ?? 0),
      coverage: { status: "complete", detail: "All open invoice balances after recorded payments." },
    };
  }

  private async loadUnsignedOpportunity(orgId: string): Promise<FinancialSummaryDTO["unsignedOpportunity"]> {
    const proposals = await this.db.proposal.findMany({
      where: { project: { orgId }, contracts: { none: {} } },
      select: { finalPrice: true },
    });
    const priced = proposals
      .map((proposal) => (proposal.finalPrice == null ? null : Number(proposal.finalPrice)))
      .filter((amount): amount is number => amount != null && Number.isFinite(amount));
    const complete = priced.length === proposals.length;

    return {
      amount: round2(priced.reduce((sum, amount) => sum + amount, 0)),
      proposalCount: proposals.length,
      pricedProposalCount: priced.length,
      coverage: complete
        ? { status: "complete", detail: "All unsigned proposals have a final price." }
        : { status: "partial", detail: `${proposals.length - priced.length} unsigned proposal${proposals.length - priced.length === 1 ? " has" : "s have"} no final price.` },
    };
  }

  private async loadProjectedCommittedMargin(orgId: string): Promise<FinancialSummaryDTO["projectedCommittedMargin"]> {
    const estimates = await this.db.estimate.findMany({
      where: { orgId, proposals: { some: { status: "accepted" } } },
      select: { subtotalCost: true, overheadPct: true, totalPrice: true, taxAmount: true },
    });

    const totals = estimates.reduce(
      (result, estimate) => {
        const subtotalCost = Number(estimate.subtotalCost);
        const cost = applyOverhead(subtotalCost, 0, Number(estimate.overheadPct));
        const sell = Number(estimate.totalPrice) - Number(estimate.taxAmount);
        return { cost: result.cost + cost, sell: result.sell + sell };
      },
      { cost: 0, sell: 0 }
    );
    const sellAmount = round2(totals.sell);
    const costAmount = round2(totals.cost);
    const grossProfit = round2(sellAmount - costAmount);
    const marginPct = sellAmount > 0 ? round2((grossProfit / sellAmount) * 100) : null;

    return {
      sellAmount,
      costAmount,
      grossProfit,
      marginPct,
      estimateCount: estimates.length,
      coverage: {
        status: "complete",
        detail: "Unique estimate snapshots linked to accepted proposals; excludes tax and does not represent actual job cost.",
      },
    };
  }
}
