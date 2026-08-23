type MockPrisma = {
  customer: {
    findMany: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  comment: {
    findMany: jest.Mock;
    create: jest.Mock;
  };
  project: {
    findFirst: jest.Mock;
  };
  invoice: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  serviceAddress: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  serviceAgreement: {
    findMany: jest.Mock;
    create: jest.Mock;
  };
  customerEquipment: {
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  organization: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  organizationSettings: {
    findUnique: jest.Mock;
    upsert: jest.Mock;
  };
  payment: {
    findMany: jest.Mock;
    create: jest.Mock;
    aggregate: jest.Mock;
  };
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
};

const mockPrisma: MockPrisma = {
  customer: {
    findMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  comment: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  project: {
    findFirst: jest.fn(),
  },
  invoice: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  serviceAddress: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  serviceAgreement: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  customerEquipment: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  organization: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  organizationSettings: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  payment: {
    findMany: jest.fn(),
    create: jest.fn(),
    aggregate: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $transaction: jest.fn(async (callback: (tx: MockPrisma) => unknown) => callback(mockPrisma)),
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));
const recordPaidEventMock = jest.fn().mockResolvedValue(undefined);
jest.mock("../modules/invoices/service", () => ({
  InvoicesService: jest.fn().mockImplementation(() => ({ recordPaidEvent: recordPaidEventMock })),
}));

import { CrmService } from "../modules/crm/service";

describe("CrmService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates org-scoped customers", async () => {
    mockPrisma.customer.create.mockResolvedValue({ id: "customer-1", name: "Acme", orgId: "org-1" });

    const result = await new CrmService().createCustomer("org-1", { name: "Acme", email: "hello@example.com" });

    expect(result.id).toBe("customer-1");
    expect(mockPrisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: "org-1", name: "Acme", email: "hello@example.com" }),
      })
    );
  });

  it("soft deletes customers", async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({ id: "customer-1", orgId: "org-1", deletedAt: null });

    await new CrmService().removeCustomer("org-1", "customer-1");

    expect(mockPrisma.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "customer-1" },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    );
  });

  it("reports duplicate and malformed CSV rows", async () => {
    mockPrisma.customer.findMany.mockResolvedValue([{ email: "dup@example.com", phone: "3175550100" }]);
    mockPrisma.customer.create.mockResolvedValue({ id: "customer-2" });

    const result = await new CrmService().importCustomers(
      "org-1",
      [
        "name,phone,email,address",
        "Existing,317-555-0100,dup@example.com,1 Main",
        "Fresh,317-555-0101,new@example.com,2 Main",
        "\"Bad Row\",too,few",
        ",317-555-0102,missing@example.com,3 Main",
      ].join("\n")
    );

    expect(result.successCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
    expect(result.malformedRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rowNumber: 4 }),
        expect.objectContaining({ rowNumber: 5 }),
      ])
    );
  });

  it("returns an error payload for empty CSV imports", async () => {
    const result = await new CrmService().importCustomers("org-1", "");

    expect(result.successCount).toBe(0);
    expect(result.malformedRows[0].message).toContain("no data rows");
  });

  it("creates service agreements scoped to a customer and project", async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({ id: "customer-1", orgId: "org-1", deletedAt: null });
    mockPrisma.serviceAddress.findFirst.mockResolvedValue({ id: "address-1", orgId: "org-1", customerId: "customer-1", deletedAt: null });
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1", customerId: "customer-1" });
    mockPrisma.serviceAgreement.create.mockResolvedValue({ id: "agreement-1", name: "PMA" });

    const result = await new CrmService().createServiceAgreement("org-1", "customer-1", {
      serviceAddressId: "address-1",
      projectId: "project-1",
      name: "PMA",
      amount: 99,
    });

    expect(result.id).toBe("agreement-1");
    expect(mockPrisma.serviceAgreement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: "org-1", customerId: "customer-1", projectId: "project-1", amount: 99 }),
      })
    );
  });

  it("creates payments only for invoices inside the current org", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        id: "invoice-1",
        project_id: "project-1",
        invoice_number: 1,
        status: "sent",
        amount: "500.00",
        recipient_email: null,
      },
    ]);
    mockPrisma.payment.create.mockResolvedValue({ id: "payment-1", amount: 150 });
    mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amount: "150.00" } });

    const result = await new CrmService().createPayment("org-1", "invoice-1", {
      amount: 150,
      paymentDate: "2026-07-01T00:00:00.000Z",
      method: "card",
    });

    expect(result.id).toBe("payment-1");
    expect(mockPrisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: "org-1", invoiceId: "invoice-1", amount: 150, method: "card" }),
      })
    );
  });

  it("leaves a partially paid invoice persisted as sent while deriving the partial state from recorded payments", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { id: "invoice-1", project_id: "project-1", invoice_number: 1, status: "sent", amount: "500.00", recipient_email: null },
    ]);
    mockPrisma.payment.create.mockResolvedValue({ id: "payment-1", amount: 200 });
    mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amount: "200.00" } });

    await new CrmService().createPayment("org-1", "invoice-1", {
      amount: 200,
      paymentDate: "2026-07-01T00:00:00.000Z",
      method: "card",
    });

    expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
    expect(recordPaidEventMock).not.toHaveBeenCalled();
  });

  it("persists paid and records one audit event when recorded payments fully cover a sent invoice", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        id: "invoice-1",
        project_id: "project-1",
        invoice_number: 1,
        status: "sent",
        amount: "500.00",
        recipient_email: "billing@example.com",
      },
    ]);
    mockPrisma.payment.create.mockResolvedValue({ id: "payment-2", amount: 300 });
    mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amount: "500.00" } });

    await new CrmService().createPayment(
      "org-1",
      "invoice-1",
      { amount: 300, paymentDate: "2026-07-02T00:00:00.000Z", method: "card" },
      "user-1"
    );

    expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
      where: { id: "invoice-1" },
      data: { status: "paid", paidAt: expect.any(Date) },
    });
    expect(recordPaidEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org-1",
        invoiceId: "invoice-1",
        actorUserId: "user-1",
        paymentId: "payment-2",
        recordedPaymentTotal: "500.00",
      })
    );
  });

  it("does not count a non-recorded payment toward reconciliation", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { id: "invoice-1", project_id: "project-1", invoice_number: 1, status: "sent", amount: "500.00", recipient_email: null },
    ]);
    mockPrisma.payment.create.mockResolvedValue({ id: "payment-pending", amount: 500 });
    mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });

    await new CrmService().createPayment("org-1", "invoice-1", {
      amount: 500,
      paymentDate: "2026-07-03T00:00:00.000Z",
      method: "card",
      status: "pending",
    });

    expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
  });

  it("rejects zero, negative, and non-finite payment amounts before opening a transaction", async () => {
    for (const amount of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(
        new CrmService().createPayment("org-1", "invoice-1", {
          amount,
          paymentDate: "2026-07-03T00:00:00.000Z",
          method: "card",
        })
      ).rejects.toMatchObject({ statusCode: 400 });
    }
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
