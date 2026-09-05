const invoiceFindFirstMock = jest.fn();
const invoiceUpdateMock = jest.fn();
const invoiceDeliveryCreateMock = jest.fn();
const activityRecordMock = jest.fn();

const mockPrisma = {
  invoice: {
    findFirst: invoiceFindFirstMock,
    update: invoiceUpdateMock,
  },
  invoiceDelivery: {
    create: invoiceDeliveryCreateMock,
  },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));
jest.mock("../modules/intelligence/service", () => ({
  ActivityTimelineService: jest.fn().mockImplementation(() => ({ record: activityRecordMock })),
}));
jest.mock("../domain/contracts", () => ({
  hasPermission: jest.fn(() => true),
  legacyInvoiceStatusMap: {},
  normalizeInvoiceStatus: jest.fn((status: string) => (status === "void" ? "voided" : status)),
}));
jest.mock("../modules/invoices/pdf", () => ({ renderInvoicePdf: jest.fn() }));

import { InvoicesService } from "../modules/invoices/service";

const baseInvoice = {
  id: "invoice-1",
  projectId: "project-1",
  estimateId: null,
  proposalId: null,
  invoiceNumber: 7,
  type: "full",
  status: "sent",
  percentComplete: null,
  amount: 500,
  dueDate: null,
  sentAt: new Date("2026-08-01T00:00:00.000Z"),
  paidAt: null,
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  lineItems: [],
  deliveries: [],
  project: {
    orgId: "org-1",
    customer: { email: "customer@example.com" },
  },
};

describe("InvoicesService.void", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("persists raw 'void' while returning canonical voided status and activity metadata", async () => {
    invoiceFindFirstMock
      .mockResolvedValueOnce(baseInvoice)
      .mockResolvedValueOnce({ ...baseInvoice, status: "void", project: undefined });
    invoiceUpdateMock.mockResolvedValue({ ...baseInvoice, status: "void" });
    invoiceDeliveryCreateMock.mockResolvedValue({ id: "delivery-1" });
    activityRecordMock.mockResolvedValue(undefined);

    const result = await new InvoicesService().void("invoice-1", "org-1", "user-1", "owner");

    expect(invoiceUpdateMock).toHaveBeenCalledWith({
      where: { id: "invoice-1" },
      data: { status: "void" },
    });
    expect(invoiceDeliveryCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: "org-1",
        invoiceId: "invoice-1",
        eventType: "invoice.voided",
        metadataJson: expect.objectContaining({ previousStatus: "sent", newStatus: "voided" }),
      }),
    });
    expect(result.status).toBe("voided");
  });
});
