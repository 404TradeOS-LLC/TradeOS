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
  invoiceLineItem: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
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

const mockExecuteRaw = jest.fn().mockResolvedValue(undefined);
jest.mock("../db/requestSession", () => ({
  runInDatabaseTransaction: (_client: unknown, operation: (tx: unknown) => unknown) => operation({ $executeRawUnsafe: mockExecuteRaw }),
}));

import { InvoicesService } from "../modules/invoices/service";

describe("InvoicesService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.proposal.findFirst.mockResolvedValue(null);
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
      lineItems: [{ id: "li-1", description: "Concrete pour", quantity: 10, unitOfMeasure: "sqft", unitPrice: 50, lineTotal: 500, sortOrder: 0 }],
      deliveries: [{ id: "delivery-1", eventType: "invoice.created", deliveryChannel: "app", recipientEmail: null, actorUserId: "user-1", metadataJson: { amount: 500 }, occurredAt: new Date(), createdAt: new Date() }],
    });

    const service = new InvoicesService();
    const invoice = await service.create({
      orgId: "org-1",
      actorUserId: "user-1",
      actorRole: "admin",
      projectId: "project-1",
      lineItems: [{ description: "Concrete pour", quantity: 10, unitOfMeasure: "sqft", unitPrice: 50 }],
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

  it("replays a committed invoice without repricing or recording another event", async () => {
    const service = new InvoicesService();
    const input = {
      orgId: "org-1", projectId: "project-1", actorRole: "admin",
      lineItems: [{ description: "Cleanup", quantity: 2, unitOfMeasure: "each", unitPrice: 25 }],
    };
    const key = "e47a0e13-431e-45dd-8bbf-f342c4ae32ca";
    mockPrisma.project.findFirst.mockResolvedValue({ id: input.projectId, orgId: input.orgId });
    mockPrisma.invoice.findFirst.mockResolvedValueOnce(null);
    const invoice = { id: "invoice-1" } as Awaited<ReturnType<InvoicesService["getById"]>>;
    const create = jest.spyOn(service, "create").mockResolvedValue(invoice);
    const read = jest.spyOn(service, "getById").mockResolvedValue(invoice);
    await expect(service.createWithIdempotency(input, key)).resolves.toEqual({ invoice, replayed: false });
    const hash = create.mock.calls[0][1]?.hash;
    expect(hash).toHaveLength(64);
    mockPrisma.invoice.findFirst.mockResolvedValue({ id: invoice.id, createRequestHash: hash });
    await expect(service.createWithIdempotency({ ...input, actorUserId: "retrying-user" }, key))
      .resolves.toEqual({ invoice, replayed: true });
    await expect(service.createWithIdempotency({ ...input, lineItems: [{ ...input.lineItems[0], unitPrice: 26 }] }, key))
      .rejects.toMatchObject({ message: expect.stringContaining("different details") });
    expect(create).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith(invoice.id, input.orgId);
    expect(mockPrisma.invoice.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId: input.projectId, project: { orgId: input.orgId }, createRequestKey: key },
    }));
  });

  it("looks up the concurrent winner after rolling back the failed insert", async () => {
    const service = new InvoicesService();
    const input = { orgId: "org-1", projectId: "project-1", actorRole: "admin" };
    const key = "0aa458d3-1834-4e22-9ba7-1c9aa59036bf";
    const invoice = { id: "winner" } as Awaited<ReturnType<InvoicesService["getById"]>>;
    mockPrisma.project.findFirst.mockResolvedValue({ id: input.projectId, orgId: input.orgId });
    mockPrisma.invoice.findFirst.mockResolvedValueOnce(null);
    jest.spyOn(service, "getById").mockResolvedValue(invoice);
    jest.spyOn(service, "create").mockImplementation(async (_input, request) => {
      mockPrisma.invoice.findFirst.mockImplementationOnce(async () => {
        expect(mockExecuteRaw).toHaveBeenCalledWith(expect.stringMatching(/^ROLLBACK TO SAVEPOINT/));
        return { id: invoice.id, createRequestHash: request?.hash };
      });
      throw Object.assign(new Error("unique constraint"), { code: "P2002" });
    });
    await expect(service.createWithIdempotency(input, key)).resolves.toEqual({ invoice, replayed: true });
  });

  it("scales line items from an estimate for a progress invoice", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });
    mockPrisma.estimate.findFirst.mockResolvedValue({
      id: "estimate-1",
      projectId: "project-1",
      status: "ready",
      subtotalCost: 1000,
      totalPrice: 1200,
      lineItems: [{ description: "Driveway", quantity: 100, unitOfMeasure: "sqft", unitCost: 10, lineCost: 1000 }],
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
      amount: 600,
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
      amount: 600,
      dueDate: null,
      sentAt: null,
      paidAt: null,
      createdAt: new Date(),
      lineItems: [{ id: "li-1", description: "Driveway", quantity: 50, unitOfMeasure: "sqft", unitPrice: 12, lineTotal: 600, sortOrder: 0 }],
      deliveries: [],
    });

    const service = new InvoicesService();
    await service.create({ orgId: "org-1", actorRole: "admin", projectId: "project-1", estimateId: "estimate-1", type: "progress", percentComplete: 50 });

    expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 600,
          lineItems: { create: [expect.objectContaining({ quantity: 50, lineTotal: 600 })] },
        }),
      })
    );
  });

  it("bills the persisted estimate sell total instead of raw direct cost", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });
    mockPrisma.estimate.findFirst.mockResolvedValue({
      id: "estimate-1",
      projectId: "project-1",
      status: "ready",
      subtotalCost: 35000,
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
        { id: "li-1", description: "Labor", quantity: 100, unitOfMeasure: "hr", unitPrice: 274.2857, lineTotal: 27428.57, sortOrder: 0 },
        { id: "li-2", description: "Materials", quantity: 100, unitOfMeasure: "sqft", unitPrice: 229.7143, lineTotal: 22971.43, sortOrder: 1 },
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
    expect(created.lineItems.create.map((line: { lineTotal: number }) => line.lineTotal)).toEqual([27428.57, 20571.43]);
    expect(created.lineItems.create.reduce((sum: number, line: { lineTotal: number }) => sum + line.lineTotal, 0)).toBe(48000);
    expect(created).toEqual(expect.objectContaining({ amount: 50400, subtotal: 48000, taxAmount: 2400 }));
  });

  it("bills the accepted proposal price when it differs from the estimate", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });
    mockPrisma.proposal.findFirst.mockResolvedValue({
      id: "proposal-1",
      projectId: "project-1",
      estimateId: "estimate-1",
      status: "accepted",
      finalPrice: 6800,
    });
    mockPrisma.estimate.findFirst.mockResolvedValue({
      id: "estimate-1",
      projectId: "project-1",
      orgId: "org-1",
      status: "ready",
      subtotalCost: 5100,
      totalPrice: 7105.07,
      lineItems: [
        { description: "Labor", quantity: 1, unitOfMeasure: "job", lineCost: 3000 },
        { description: "Materials", quantity: 1, unitOfMeasure: "job", lineCost: 2100 },
      ],
    });
    mockPrisma.invoice.aggregate.mockResolvedValue({ _max: { invoiceNumber: null } });
    mockPrisma.invoice.create.mockResolvedValue({
      id: "invoice-1", projectId: "project-1", estimateId: "estimate-1", proposalId: "proposal-1",
      invoiceNumber: 1, type: "full", status: "draft", percentComplete: null, amount: 6800,
      dueDate: null, sentAt: null, paidAt: null, createdAt: new Date(),
    });
    mockPrisma.invoice.findFirst.mockResolvedValue({
      id: "invoice-1", projectId: "project-1", estimateId: "estimate-1", proposalId: "proposal-1",
      invoiceNumber: 1, type: "full", status: "draft", percentComplete: null, amount: 6800,
      dueDate: null, sentAt: null, paidAt: null, createdAt: new Date(), lineItems: [], deliveries: [],
    });

    await new InvoicesService().create({ orgId: "org-1", actorRole: "admin", projectId: "project-1", estimateId: "estimate-1" });

    const created = mockPrisma.invoice.create.mock.calls[0][0].data;
    expect(created).toEqual(expect.objectContaining({ proposalId: "proposal-1", amount: 6800 }));
    expect(created.lineItems.create.reduce((sum: number, line: { lineTotal: number }) => sum + line.lineTotal, 0)).toBe(6800);
  });

  it("rejects invoice creation from a draft estimate", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });
    mockPrisma.estimate.findFirst.mockResolvedValue({
      id: "estimate-1", projectId: "project-1", orgId: "org-1", status: "draft", subtotalCost: 100, totalPrice: 120, lineItems: [],
    });

    await expect(
      new InvoicesService().create({ orgId: "org-1", actorRole: "admin", projectId: "project-1", estimateId: "estimate-1" })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
  });

  it("rejects a proposal that belongs to a different estimate", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });
    mockPrisma.proposal.findFirst.mockResolvedValue({
      id: "proposal-1", projectId: "project-1", estimateId: "estimate-other", status: "accepted", finalPrice: 6800,
    });

    await expect(
      new InvoicesService().create({
        orgId: "org-1", actorRole: "admin", projectId: "project-1", estimateId: "estimate-1", proposalId: "proposal-1",
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
  });

  it("scales the persisted sell total for progress invoices", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });
    mockPrisma.estimate.findFirst.mockResolvedValue({
      id: "estimate-1",
      projectId: "project-1",
      status: "ready",
      subtotalCost: 35000,
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
        { id: "li-1", description: "Labor", quantity: 50, unitOfMeasure: "hr", unitPrice: 288, lineTotal: 14400, sortOrder: 0 },
        { id: "li-2", description: "Materials", quantity: 50, unitOfMeasure: "sqft", unitPrice: 216, lineTotal: 10800, sortOrder: 1 },
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
    expect(created.lineItems.create.reduce((sum: number, line: { lineTotal: number }) => sum + line.lineTotal, 0)).toBe(24000);
    expect(created).toEqual(expect.objectContaining({ amount: 25200, subtotal: 24000, taxAmount: 1200 }));
  });

  it("bills a target-margin estimate from its persisted sell total", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });
    mockPrisma.estimate.findFirst.mockResolvedValue({
      id: "estimate-1",
      projectId: "project-1",
      status: "ready",
      subtotalCost: 1000,
      totalPrice: 1250,
      targetMarginPct: 20,
      overheadPct: 0,
      profitPct: 0,
      taxPct: 0,
      taxAmount: 0,
      lineItems: [
        { description: "Labor", quantity: 10, unitOfMeasure: "hr", unitCost: 60, lineCost: 600 },
        { description: "Materials", quantity: 10, unitOfMeasure: "ea", unitCost: 40, lineCost: 400 },
      ],
    });
    mockPrisma.invoice.aggregate.mockResolvedValue({ _max: { invoiceNumber: null } });
    mockPrisma.invoice.create.mockResolvedValue({
      id: "invoice-1", projectId: "project-1", estimateId: "estimate-1", proposalId: null,
      invoiceNumber: 1, type: "full", status: "draft", percentComplete: null, amount: 1250,
      dueDate: null, sentAt: null, paidAt: null, createdAt: new Date(),
    });
    mockPrisma.invoice.findFirst.mockResolvedValue({
      id: "invoice-1", projectId: "project-1", estimateId: "estimate-1", proposalId: null,
      invoiceNumber: 1, type: "full", status: "draft", percentComplete: null, amount: 1250,
      dueDate: null, sentAt: null, paidAt: null, createdAt: new Date(), lineItems: [], deliveries: [],
    });

    await new InvoicesService().create({ orgId: "org-1", actorRole: "admin", projectId: "project-1", estimateId: "estimate-1" });

    const created = mockPrisma.invoice.create.mock.calls[0][0].data;
    expect(created.amount).toBe(1250);
    expect(created.lineItems.create.map((line: { lineTotal: number }) => line.lineTotal)).toEqual([750, 500]);
  });

  it("allocates rounding residual to the largest direct-cost line", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });
    mockPrisma.estimate.findFirst.mockResolvedValue({
      id: "estimate-1", projectId: "project-1", status: "ready", subtotalCost: 5, totalPrice: 100.01,
      lineItems: [
        { description: "Largest (tie winner)", quantity: 1, unitOfMeasure: "ea", unitCost: 2, lineCost: 2 },
        { description: "Second largest", quantity: 1, unitOfMeasure: "ea", unitCost: 2, lineCost: 2 },
        { description: "Third", quantity: 1, unitOfMeasure: "ea", unitCost: 1, lineCost: 1 },
      ],
    });
    mockPrisma.invoice.aggregate.mockResolvedValue({ _max: { invoiceNumber: null } });
    mockPrisma.invoice.create.mockResolvedValue({
      id: "invoice-1", projectId: "project-1", estimateId: "estimate-1", proposalId: null,
      invoiceNumber: 1, type: "full", status: "draft", percentComplete: null, amount: 100.01,
      dueDate: null, sentAt: null, paidAt: null, createdAt: new Date(),
    });
    mockPrisma.invoice.findFirst.mockResolvedValue({
      id: "invoice-1", projectId: "project-1", estimateId: "estimate-1", proposalId: null,
      invoiceNumber: 1, type: "full", status: "draft", percentComplete: null, amount: 100.01,
      dueDate: null, sentAt: null, paidAt: null, createdAt: new Date(), lineItems: [], deliveries: [],
    });

    await new InvoicesService().create({ orgId: "org-1", actorRole: "admin", projectId: "project-1", estimateId: "estimate-1" });

    const created = mockPrisma.invoice.create.mock.calls[0][0].data;
    expect(created.lineItems.create.map((line: { lineTotal: number }) => line.lineTotal)).toEqual([40.01, 40, 20]);
    expect(Math.round(created.lineItems.create.reduce((sum: number, line: { lineTotal: number }) => sum + line.lineTotal, 0) * 100)).toBe(10001);
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
        lineItems: [{ description: "Concrete pour", quantity: 10, unitOfMeasure: "sqft", unitPrice: 50 }],
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
        { id: "li-1", description: "Concrete pour", quantity: 10, unitOfMeasure: "sqft", unitPrice: 50, lineTotal: 500, sortOrder: 0 },
      ],
      deliveries: [{ id: "delivery-1", eventType: "invoice.created", deliveryChannel: "app", recipientEmail: null, actorUserId: null, metadataJson: null, occurredAt: new Date(), createdAt: new Date() }],
    });

    const service = new InvoicesService();
    const invoice = await service.getById("invoice-1", "org-1");

    expect(invoice.lineItems).toHaveLength(1);
    expect(invoice.lineItems[0]).toMatchObject({ description: "Concrete pour", quantity: 10, lineTotal: 500 });
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

  it("derives overdue status from an expired due date and positive balance", async () => {
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
      dueDate: new Date(Date.now() - 86_400_000),
      sentAt: new Date(Date.now() - 172_800_000),
      paidAt: null,
      createdAt: new Date(Date.now() - 172_800_000),
      lineItems: [],
      payments: [{ id: "payment-1", amount: 400, paymentDate: new Date(), method: "check", createdAt: new Date() }],
      deliveries: [],
    });

    await expect(new InvoicesService().getById("invoice-1", "org-1")).resolves.toMatchObject({
      status: "overdue",
      paidAmount: 400,
      balanceDue: 600,
    });
  });

  describe("update", () => {
    function draftRow(overrides: Record<string, unknown> = {}) {
      return {
        id: "invoice-1",
        projectId: "project-1",
        estimateId: null,
        proposalId: null,
        invoiceNumber: 1,
        type: "full",
        status: "draft",
        percentComplete: null,
        amount: 150,
        subtotal: 150,
        taxPct: 0,
        taxAmount: 0,
        dueDate: null,
        sentAt: null,
        paidAt: null,
        createdAt: new Date(),
        project: { orgId: "org-1", customer: { email: "billing@example.com" } },
        deliveries: [],
        ...overrides,
      };
    }

    function updatedRow(overrides: Record<string, unknown> = {}) {
      return {
        ...draftRow(),
        lineItems: [],
        payments: [],
        deliveries: [],
        ...overrides,
      };
    }

    it("replaces lines and recomputes the total when a manual full draft is edited", async () => {
      mockPrisma.invoice.findFirst
        .mockResolvedValueOnce(draftRow())
        .mockResolvedValueOnce(
          updatedRow({
            amount: 200,
            subtotal: 200,
            dueDate: new Date("2026-12-01"),
            lineItems: [{ id: "li-2", description: "Revised scope", quantity: 1, unitOfMeasure: "each", unitPrice: 200, lineTotal: 200, sortOrder: 0 }],
          })
        );
      mockPrisma.invoice.update.mockResolvedValue({});

      const invoice = await new InvoicesService().update({
        id: "invoice-1",
        orgId: "org-1",
        actorUserId: "user-1",
        actorRole: "admin",
        lineItems: [{ description: "Revised scope", quantity: 1, unitOfMeasure: "each", unitPrice: 200 }],
        dueDate: "2026-12-01",
      });

      expect(mockPrisma.invoiceLineItem.deleteMany).toHaveBeenCalledWith({ where: { invoiceId: "invoice-1" } });
      expect(mockPrisma.invoiceLineItem.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ description: "Revised scope", quantity: 1, unitPrice: 200, lineTotal: 200, sortOrder: 0 }),
        ],
      });
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "invoice-1" }, data: expect.objectContaining({ amount: 200, subtotal: 200, taxPct: 0, taxAmount: 0 }) })
      );
      expect(mockPrisma.invoiceDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ eventType: "invoice.updated", actorUserId: "user-1" }) })
      );
      expect(invoice.amount).toBe(200);
    });

    it("rejects editing an invoice that has left draft", async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(draftRow({ status: "sent" }));

      await expect(
        new InvoicesService().update({ id: "invoice-1", orgId: "org-1", actorRole: "admin", dueDate: "2026-12-01" })
      ).rejects.toThrow("leaves draft");
      expect(mockPrisma.invoiceLineItem.deleteMany).not.toHaveBeenCalled();
    });

    it("rejects line replacement on an estimate-linked draft", async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(draftRow({ estimateId: "estimate-1" }));

      await expect(
        new InvoicesService().update({
          id: "invoice-1",
          orgId: "org-1",
          actorRole: "admin",
          lineItems: [{ description: "Changed", quantity: 1, unitOfMeasure: "each", unitPrice: 10 }],
        })
      ).rejects.toThrow("priced from an estimate");
    });

    it("rejects line replacement on a progress draft", async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(draftRow({ type: "progress", percentComplete: 25 }));

      await expect(
        new InvoicesService().update({
          id: "invoice-1",
          orgId: "org-1",
          actorRole: "admin",
          lineItems: [{ description: "Changed", quantity: 1, unitOfMeasure: "each", unitPrice: 10 }],
        })
      ).rejects.toThrow("progress invoice");
    });

    it("edits only the due date when no lines are supplied", async () => {
      mockPrisma.invoice.findFirst
        .mockResolvedValueOnce(draftRow())
        .mockResolvedValueOnce(updatedRow({ dueDate: new Date("2026-12-15") }));
      mockPrisma.invoice.update.mockResolvedValue({});

      const invoice = await new InvoicesService().update({ id: "invoice-1", orgId: "org-1", actorRole: "admin", dueDate: "2026-12-15" });

      expect(mockPrisma.invoiceLineItem.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.invoiceLineItem.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.not.objectContaining({ amount: expect.anything() }) })
      );
      expect(invoice.amount).toBe(150);
    });

    it("clears the due date when null is supplied", async () => {
      mockPrisma.invoice.findFirst
        .mockResolvedValueOnce(draftRow({ dueDate: new Date("2026-12-01") }))
        .mockResolvedValueOnce(updatedRow({ dueDate: null }));
      mockPrisma.invoice.update.mockResolvedValue({});

      await new InvoicesService().update({ id: "invoice-1", orgId: "org-1", actorRole: "admin", dueDate: null });

      expect(mockPrisma.invoice.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ dueDate: null }) }));
    });

    it("rejects an update that changes nothing", async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(draftRow());

      await expect(new InvoicesService().update({ id: "invoice-1", orgId: "org-1", actorRole: "admin" })).rejects.toThrow(
        "Nothing to update"
      );
      expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
      expect(mockPrisma.invoiceDelivery.create).not.toHaveBeenCalled();
    });

    it("rejects invoice updates for roles without billing.write", async () => {
      await expect(
        new InvoicesService().update({ id: "invoice-1", orgId: "org-1", actorRole: "technician", dueDate: "2026-12-01" })
      ).rejects.toThrow("manage invoices");
    });
  });

  describe("finite-value and due-date validation", () => {
    const validManualLine = { description: "Labor", quantity: 2, unitOfMeasure: "hr", unitPrice: 100 };

    it("rejects a NaN percentComplete on a progress invoice instead of persisting NaN amounts", async () => {
      mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });

      await expect(
        new InvoicesService().create({
          orgId: "org-1",
          actorRole: "admin",
          projectId: "project-1",
          type: "progress",
          percentComplete: Number.NaN,
          lineItems: [validManualLine],
        })
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
    });

    it("rejects manual line items with a NaN quantity, unit price, or line total", async () => {
      mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });

      for (const lineItems of [
        [{ ...validManualLine, quantity: Number.NaN }],
        [{ ...validManualLine, unitPrice: Number.NaN }],
        [{ ...validManualLine, lineTotal: Number.NaN }],
      ]) {
        await expect(
          new InvoicesService().create({ orgId: "org-1", actorRole: "admin", projectId: "project-1", lineItems })
        ).rejects.toThrow("finite");
      }
      expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
    });

    it("rejects an unparseable due date on create instead of failing with a 500", async () => {
      mockPrisma.project.findFirst.mockResolvedValue({ id: "project-1", orgId: "org-1" });

      await expect(
        new InvoicesService().create({
          orgId: "org-1",
          actorRole: "admin",
          projectId: "project-1",
          lineItems: [validManualLine],
          dueDate: "not-a-date",
        })
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
    });

    it("rejects NaN line items and an unparseable due date on update", async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue({
        id: "invoice-1",
        projectId: "project-1",
        estimateId: null,
        type: "full",
        status: "draft",
        amount: 150,
        subtotal: 150,
        taxPct: 0,
        taxAmount: 0,
        project: { orgId: "org-1", customer: { email: "billing@example.com" } },
      });

      await expect(
        new InvoicesService().update({
          id: "invoice-1",
          orgId: "org-1",
          actorRole: "admin",
          lineItems: [{ ...validManualLine, quantity: Number.NaN }],
        })
      ).rejects.toThrow("finite");
      await expect(
        new InvoicesService().update({ id: "invoice-1", orgId: "org-1", actorRole: "admin", dueDate: "not-a-date" })
      ).rejects.toThrow("dueDate must be a valid date");
      expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
      expect(mockPrisma.invoiceLineItem.deleteMany).not.toHaveBeenCalled();
    });
  });
});
