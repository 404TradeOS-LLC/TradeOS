type MockPrisma = {
  organizationSettings: { findUnique: jest.Mock };
  payment: { findMany: jest.Mock };
};

const mockPrisma: MockPrisma = {
  organizationSettings: { findUnique: jest.fn() },
  payment: { findMany: jest.fn() },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { PaymentLedgerService } from "../modules/payments/service";

describe("PaymentLedgerService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns recorded payments for the current organization week with invoice context", async () => {
    mockPrisma.organizationSettings.findUnique.mockResolvedValue({ settingsJson: { timezone: "America/Indiana/Indianapolis" } });
    mockPrisma.payment.findMany.mockResolvedValue([
      {
        id: "payment-1",
        invoiceId: "invoice-1",
        amount: 125.5,
        paymentDate: new Date("2026-08-10T14:30:00.000Z"),
        method: "check",
        status: "recorded",
        reference: "CHK-100",
        notes: null,
        createdAt: new Date("2026-08-10T14:31:00.000Z"),
        invoice: {
          id: "invoice-1",
          invoiceNumber: 42,
          amount: 500,
          status: "partially_paid",
          project: { id: "project-1", name: "Roof repair", customer: { id: "customer-1", name: "Acme" } },
        },
      },
      {
        id: "payment-2",
        invoiceId: "invoice-2",
        amount: 74.5,
        paymentDate: new Date("2026-08-09T16:00:00.000Z"),
        method: "card",
        status: "recorded",
        reference: null,
        notes: null,
        createdAt: new Date("2026-08-09T16:01:00.000Z"),
        invoice: {
          id: "invoice-2",
          invoiceNumber: 43,
          amount: 74.5,
          status: "paid",
          project: { id: "project-2", name: "Service call", customer: null },
        },
      },
    ]);

    const result = await new PaymentLedgerService().listCurrentWeek("org-1", new Date("2026-08-10T20:00:00.000Z"));

    expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          orgId: "org-1",
          status: "recorded",
          paymentDate: {
            gte: new Date("2026-08-09T04:00:00.000Z"),
            lt: new Date("2026-08-16T04:00:00.000Z"),
          },
        },
      })
    );
    expect(result.timezone).toEqual({ timezone: "America/Indiana/Indianapolis", isFallback: false });
    expect(result.totalAmount).toBe(200);
    expect(result.paymentCount).toBe(2);
    expect(result.payments[0]).toEqual(expect.objectContaining({ id: "payment-1", amount: 125.5, method: "check" }));
  });

  it("falls back to UTC when organization timezone is invalid", async () => {
    mockPrisma.organizationSettings.findUnique.mockResolvedValue({ settingsJson: { timezone: "not/a-zone" } });
    mockPrisma.payment.findMany.mockResolvedValue([]);

    const result = await new PaymentLedgerService().listCurrentWeek("org-1", new Date("2026-08-10T20:00:00.000Z"));

    expect(result.timezone).toEqual({ timezone: "UTC", isFallback: true });
    expect(result.totalAmount).toBe(0);
  });
});
