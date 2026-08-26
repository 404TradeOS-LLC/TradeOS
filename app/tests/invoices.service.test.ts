const mockPrisma = {
  project: {
    findFirst: jest.fn(),
  },
  estimate: {
    findFirst: jest.fn(),
  },
  proposal: {
    findFirst: jest.fn(),
  },
  invoice: {
    aggregate: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  invoiceDelivery: {
    create: jest.fn(),
  },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));
jest.mock("../modules/intelligence/service", () => ({
  ActivityTimelineService: jest.fn().mockImplementation(() => ({
    record: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { InvoicesService } from "../modules/invoices/service";

describe("InvoicesService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a full invoice from custom line items and numbers it sequentially", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });
    mockPrisma.invoice.aggregate.mockResolvedValue({ _max: { invoiceNumber: 1 } });
    mockPrisma.invoice.create.mockResolvedValue({
      id: "invoice-1",
      projectId: "project-1",
      estimateId: null,
      proposalId: null,
      invoiceNumber: 2,
      type: "full",
      status: "draft",
      percentComplete: null,
      amount: 500,
      dueDate: null,
      sentAt: null,
      paidAt: null,
      createdAt: new Date(),
    });
    mockPrisma.invoice.findFirst.mockResolvedValue({
      id: "invoice-1",
      projectId: "project-1",
      estimateId: null,
      proposalId: null,
      invoiceNumber: 2,
      type: "full",
      status: "draft",
      percentComplete: null,
      amount: 500,
      dueDate: null,
      sentAt: null,
      paidAt: null,
      createdAt: new Date(),
      lineItems: [{ id: "li-1", description: "Concrete pour", quantity: 10, unitOfMeasure: "sqft", unitCost: 50, lineCost: 500, sortOrder: 0 }],
      deliveries: [{ id: "delivery-1", eventType: "invoice.created", deliveryChannel: "app", recipientEmail: null, actorUserId: "user-1", metadataJson: { amount: 500 }, occurredAt: new Date(), createdAt: new Date() }],
    });

    const service = new InvoicesService();
    const invoice = await service.create({
      orgId: "org-1",
      actorUserId: "user-1",
      actorRole: "admin",
      projectId: "project-1",
      lineItems: [{ description: "Concrete pour", quantity: 10, unitOfMeasure: "sqft", unitCost: 50 }],
    });

    expect(invoice.invoiceNumber).toBe(2);
    expect(invoice.deliveries[0]?.eventType).toBe("invoice.created");
    expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ invoiceNumber: 2, amount: 500 }) })
    );
    expect(mockPrisma.invoiceDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: "invoice.created", actorUserId: "user-1" }) })
    );
  });

  it("scales line items from an estimate for a progress invoice", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });
    mockPrisma.estimate.findFirst.mockResolvedValue({
      id: "estimate-1",
      projectId: "project-1",
      lineItems: [{ description: "Driveway", quantity: 100, unitOfMeasure: "sqft", unitCost: 10 }],
    });
    mockPrisma.invoice.aggregate.mockResolvedValue({ _max: { invoiceNumber: null } });
    mockPrisma.invoice.create.mockResolvedValue({
      id: "invoice-1",
      projectId: "project-1",
      estimateId: "estimate-1",
      proposalId: null,
      invoiceNumber: 1,
      type: "progress",
      status: "draft",
      percentComplete: 50,
      amount: 500,
      dueDate: null,
      sentAt: null,
      paidAt: null,
      createdAt: new Date(),
    });
    mockPrisma.invoice.findFirst.mockResolvedValue({
      id: "invoice-1",
      projectId: "project-1",
      estimateId: "estimate-1",
      proposalId: null,
      invoiceNumber: 1,
      type: "progress",
      status: "draft",
      percentComplete: 50,
      amount: 500,
      dueDate: null,
      sentAt: null,
      paidAt: null,
      createdAt: new Date(),
      lineItems: [{ id: "li-1", description: "Driveway", quantity: 50, unitOfMeasure: "sqft", unitCost: 10, lineCost: 500, sortOrder: 0 }],
      deliveries: [],
    });

    const service = new InvoicesService();
    await service.create({ orgId: "org-1", actorRole: "admin", projectId: "project-1", estimateId: "estimate-1", type: "progress", percentComplete: 50 });

    expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lineItems: { create: [expect.objectContaining({ quantity: 50, lineCost: 500 })] },
        }),
      })
    );
  });

  it("bills the persisted estimate sell total instead of raw direct cost", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });
    mockPrisma.estimate.findFirst.mockResolvedValue({
      id: "estimate-1",
      projectId: "project-1",
      totalPrice: 50400,
      taxAmount: 2400,
      lineItems: [
        { description: "Labor", quantity: 100, unitOfMeasure: "hr", unitCost: 200, lineCost: 20000, taxable: false },
        { description: "Materials", quantity: 100, unitOfMeasure: "sqft", unitCost: 150, lineCost: 15000, taxable: true },
      ],
    });
    mockPrisma.invoice.aggregate.mockResolvedValue({ _max: { invoiceNumber: null } });
    mockPrisma.invoice.create.mockResolvedValue({
      id: "invoice-1",
      projectId: "project-1",
      estimateId: "estimate-1",
      proposalId: null,
      invoiceNumber: 1,
      type: "full",
      status: "draft",
      percentComplete: null,
      amount: 50400,
      dueDate: null,
      sentAt: null,
      paidAt: null,
      createdAt: new Date(),
    });
    mockPrisma.invoice.findFirst.mockResolvedValue({
      id: "invoice-1",
      projectId: "project-1",
      estimateId: "estimate-1",
      proposalId: null,
      invoiceNumber: 1,
      type: "full",
      status: "draft",
      percentComplete: null,
      amount: 50400,
      dueDate: null,
      sentAt: null,
      paidAt: null,
      createdAt: new Date(),
      lineItems: [
        { id: "li-1", description: "Labor", quantity: 100, unitOfMeasure: "hr", unitCost: 274.2857, lineCost: 27428.57, sortOrder: 0 },
        { id: "li-2", description: "Materials", quantity: 100, unitOfMeasure: "sqft", unitCost: 229.7143, lineCost: 22971.43, sortOrder: 1 },
      ],
      deliveries: [],
    });

    await new InvoicesService().create({
      orgId: "org-1",
      actorRole: "admin",
      projectId: "project-1",
      estimateId: "estimate-1",
    });

    const created = mockPrisma.invoice.create.mock.calls[0][0].data;
    expect(created.amount).toBe(50400);
    expect(created.lineItems.create.map((line: { lineCost: number }) => line.lineCost)).toEqual([27428.57, 22971.43]);
    expect(created.lineItems.create.reduce((sum: number, line: { lineCost: number }) => sum + line.lineCost, 0)).toBe(50400);
  });

  it("scales the persisted sell total for progress invoices", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });
    mockPrisma.estimate.findFirst.mockResolvedValue({
      id: "estimate-1",
      projectId: "project-1",
      totalPrice: 50400,
      taxAmount: 2400,
      lineItems: [
        { description: "Labor", quantity: 100, unitOfMeasure: "hr", unitCost: 200, lineCost: 20000, taxable: false },
        { description: "Materials", quantity: 100, unitOfMeasure: "sqft", unitCost: 150, lineCost: 15000, taxable: true },
      ],
    });
    mockPrisma.invoice.aggregate.mockResolvedValue({ _max: { invoiceNumber: null } });
    mockPrisma.invoice.create.mockResolvedValue({
      id: "invoice-1",
      projectId: "project-1",
      estimateId: "estimate-1",
      proposalId: "estimate-1",
      invoiceNumber: 1,
      type: "progress",
      status: "draft",
      percentComplete: 50,
      amount: 25200,
      dueDate: null,
      sentAt: null,
      paidAt: null,
      createdAt: new Date(),
    });
    mockPrisma.invoice.findFirst.mockResolvedValue({
      id: "invoice-1",
      projectId: "project-1",
      estimateId: "estimate-1",
      proposalId: null,
      invoiceNumber: 1,
      type: "progress",
      status: "draft",
      percentComplete: 50,
      amount: 25200,
      dueDate: null,
      sentAt: null,
      paidAt: null,
      createdAt: new Date(),
      lineItems: [
        { id: "li-1", description: "Labor", quantity: 50, unitOfMeasure: "hr", unitCost: 274.2857, lineCost: 13714.29, sortOrder: 0 },
        { id: "li-2", description: "Materials", quantity: 50, unitOfMeasure: "sqft", unitCost: 229.7143, lineCost: 11485.71, sortOrder: 1 },
      ],
      deliveries: [],
    });

    await new InvoicesService().create({
      orgId: "org-1",
      actorRole: "admin",
      projectId: "project-1",
      estimateId: "estimate-1",
      type: "progress",
      percentComplete: 50,
    });

    const created = mockPrisma.invoice.create.mock.calls[0][0].data;
    expect(created.amount).toBe(25200);
    expect(created.lineItems.create.reduce((sum: number, line: { lineCost: number }) => sum + line.lineCost, 0)).toBe(25200);
  });

  it("rejects a progress invoice without percentComplete", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });

    const service = new InvoicesService();
    await expect(
      service.create({ orgId: "org-1", actorRole: "admin", projectId: "project-1", estimateId: "estimate-1", type: "progress" })
    ).rejects.toThrow("percentComplete");
  });

  it("rejects invoice mutations for roles without billing.write", async () => {
    const service = new InvoicesService();

    await expect(
      service.create({
        orgId: "org-1",
        actorRole: "technician",
        projectId: "project-1",
        lineItems: [{ description: "Concrete pour", quantity: 10, unitOfMeasure: "sqft", unitCost: 50 }],
      })
    ).rejects.toThrow("manage invoices");
  });

  it("marks a sent invoice paid", async () => {
    mockPrisma.invoice.findFirst
      .mockResolvedValueOnce({
        id: "invoice-1",
        projectId: "project-1",
        status: "sent",
        invoiceNumber: 1,
        project: { orgId: "org-1", customer: { email: "billing@example.com" } },
        deliveries: [],
      })
      .mockResolvedValueOnce({
        id: "invoice-1",
        projectId: "project-1",
        estimateId: null,
        proposalId: null,
        invoiceNumber: 1,
        type: "full",
        status: "paid",
        percentComplete: null,
        amount: 500,
        dueDate: null,
        sentAt: new Date(),
        paidAt: new Date(),
        createdAt: new Date(),
        lineItems: [],
        deliveries: [{ id: "delivery-1", eventType: "invoice.paid", deliveryChannel: "app", recipientEmail: "billing@example.com", actorUserId: "user-1", metadataJson: null, occurredAt: new Date(), createdAt: new Date() }],
      });
    mockPrisma.invoice.update.mockResolvedValue({
      id: "invoice-1",
      projectId: "project-1",
      estimateId: null,
      proposalId: null,
      invoiceNumber: 1,
      type: "full",
      status: "paid",
      percentComplete: null,
      amount: 500,
      dueDate: null,
      sentAt: new Date(),
      paidAt: new Date(),
      createdAt: new Date(),
    });

    const service = new InvoicesService();
    const invoice = await service.markPaid("invoice-1", "org-1", "user-1", "admin");

    expect(invoice.status).toBe("paid");
    expect(mockPrisma.invoiceDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: "invoice.paid", actorUserId: "user-1" }) })
    );
  });

  it("rejects voiding a paid invoice", async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue({
      id: "invoice-1",
      projectId: "project-1",
      status: "paid",
      project: { orgId: "org-1", customer: { email: "billing@example.com" } },
      deliveries: [],
    });

    const service = new InvoicesService();
    await expect(service.void("invoice-1", "org-1", "user-1", "admin")).rejects.toThrow("already been paid");
  });

  it("returns line items with the invoice on getById", async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue({
      id: "invoice-1",
      projectId: "project-1",
      estimateId: null,
      proposalId: null,
      invoiceNumber: 1,
      type: "full",
      status: "draft",
      percentComplete: null,
      amount: 500,
      dueDate: null,
      sentAt: null,
      paidAt: null,
      createdAt: new Date(),
      lineItems: [
        { id: "li-1", description: "Concrete pour", quantity: 10, unitOfMeasure: "sqft", unitCost: 50, lineCost: 500, sortOrder: 0 },
      ],
      deliveries: [{ id: "delivery-1", eventType: "invoice.created", deliveryChannel: "app", recipientEmail: null, actorUserId: null, metadataJson: null, occurredAt: new Date(), createdAt: new Date() }],
    });

    const service = new InvoicesService();
    const invoice = await service.getById("invoice-1", "org-1");

    expect(invoice.lineItems).toHaveLength(1);
    expect(invoice.lineItems[0]).toMatchObject({ description: "Concrete pour", quantity: 10, lineCost: 500 });
    expect(invoice.deliveries[0]?.eventType).toBe("invoice.created");
  });

  it("returns recorded payment history and server-derived financials on getById", async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue({
      id: "invoice-1",
      projectId: "project-1",
      estimateId: null,
      proposalId: null,
      invoiceNumber: 1,
      type: "full",
      status: "sent",
      percentComplete: null,
      amount: 1000,
      dueDate: new Date("2026-09-01T00:00:00.000Z"),
      sentAt: new Date("2026-08-01T00:00:00.000Z"),
      paidAt: null,
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      lineItems: [],
      payments: [
        {
          id: "payment-1",
          amount: 400,
          paymentDate: new Date("2026-08-10T00:00:00.000Z"),
          method: "card",
          createdAt: new Date("2026-08-10T00:01:00.000Z"),
        },
      ],
      deliveries: [],
    });

    const invoice = await new InvoicesService().getById("invoice-1", "org-1");

    expect(invoice).toMatchObject({ paidAmount: 400, balanceDue: 600 });
    expect(invoice.payments).toEqual([
      expect.objectContaining({ id: "payment-1", amount: 400, method: "card" }),
    ]);
    expect(mockPrisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "invoice-1", project: { orgId: "org-1" } },
        include: expect.objectContaining({
          payments: {
            where: { status: "recorded" },
            orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
          },
        }),
      })
    );
  });
});
