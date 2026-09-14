const mockPrisma = {
  $queryRaw: jest.fn(),
  proposal: { findMany: jest.fn() },
  estimate: { findMany: jest.fn() },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { FinancialSummaryService } from "../modules/intelligence/financialSummary";

const paymentLedger = {
  listCurrentWeek: jest.fn(),
};

describe("FinancialSummaryService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    paymentLedger.listCurrentWeek.mockResolvedValue({
      period: "current_week",
      timezone: { timezone: "America/Indiana/Indianapolis", isFallback: false },
      rangeUtc: { start: "2026-09-13T04:00:00.000Z", end: "2026-09-20T04:00:00.000Z" },
      totalAmount: 1250.5,
      paymentCount: 3,
      payments: [],
    });
    mockPrisma.$queryRaw.mockResolvedValue([
      { open_amount: "4200.25", overdue_amount: "1200.25", open_invoice_count: 4n, overdue_invoice_count: 1n },
    ]);
    mockPrisma.proposal.findMany.mockResolvedValue([{ finalPrice: 5000 }, { finalPrice: null }, { finalPrice: 2500.25 }]);
    mockPrisma.estimate.findMany.mockResolvedValue([
      { subtotalCost: 1000, overheadPct: 10, totalPrice: 1600, taxAmount: 100 },
      { subtotalCost: 500, overheadPct: 0, totalPrice: 800, taxAmount: 0 },
    ]);
  });

  it("returns exact organization-wide sources and projected accepted-estimate margin", async () => {
    const now = new Date("2026-09-14T12:00:00.000Z");
    const result = await new FinancialSummaryService(mockPrisma as never, paymentLedger).getOrganizationSummary("org-1", now);

    expect(paymentLedger.listCurrentWeek).toHaveBeenCalledWith("org-1", now);
    expect(mockPrisma.$queryRaw.mock.calls[0][0].values).toEqual(["org-1", "org-1", now, now]);
    expect(mockPrisma.proposal.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { project: { orgId: "org-1" }, contracts: { none: {} } } }));
    expect(mockPrisma.estimate.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { orgId: "org-1", proposals: { some: { status: "accepted" } } } }));
    expect(result.cashCollected).toMatchObject({ amount: 1250.5, paymentCount: 3, coverage: { status: "complete" } });
    expect(result.receivables).toMatchObject({ openAmount: 4200.25, overdueAmount: 1200.25, openInvoiceCount: 4, overdueInvoiceCount: 1 });
    expect(result.unsignedOpportunity).toMatchObject({ amount: 7500.25, proposalCount: 3, pricedProposalCount: 2, coverage: { status: "partial" } });
    expect(result.projectedCommittedMargin).toMatchObject({ sellAmount: 2300, costAmount: 1600, grossProfit: 700, marginPct: 30.43, estimateCount: 2 });
    expect(result.actualJobCosts).toMatchObject({ amount: null, coverage: { status: "unavailable" } });
  });

  it("fails each source closed without replacing unknown financial values with zero", async () => {
    paymentLedger.listCurrentWeek.mockRejectedValue(new Error("payments unavailable"));
    mockPrisma.$queryRaw.mockRejectedValue(new Error("invoices unavailable"));
    mockPrisma.proposal.findMany.mockRejectedValue(new Error("proposals unavailable"));
    mockPrisma.estimate.findMany.mockRejectedValue(new Error("estimates unavailable"));

    const result = await new FinancialSummaryService(mockPrisma as never, paymentLedger).getOrganizationSummary("org-1");

    expect(result.cashCollected.amount).toBeNull();
    expect(result.receivables.openAmount).toBeNull();
    expect(result.unsignedOpportunity.amount).toBeNull();
    expect(result.projectedCommittedMargin.marginPct).toBeNull();
    expect(result.cashCollected.coverage.status).toBe("unavailable");
    expect(result.receivables.coverage.status).toBe("unavailable");
  });

  it("does not invent a percentage when committed sell value is zero", async () => {
    mockPrisma.proposal.findMany.mockResolvedValue([]);
    mockPrisma.estimate.findMany.mockResolvedValue([{ subtotalCost: 100, overheadPct: 0, totalPrice: 0, taxAmount: 0 }]);

    const result = await new FinancialSummaryService(mockPrisma as never, paymentLedger).getOrganizationSummary("org-1");

    expect(result.projectedCommittedMargin).toMatchObject({ sellAmount: 0, costAmount: 100, grossProfit: -100, marginPct: null });
  });
});
