const mockTransaction = {
  $queryRaw: jest.fn(),
  customerPortalAccessToken: {
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
  customerPortalSession: {
    create: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
  customer: { findFirst: jest.fn() },
};

const mockBasePrisma = {
  $transaction: jest.fn(async (callback: (transaction: typeof mockTransaction) => unknown) => callback(mockTransaction)),
};

const mockPrisma = {
  customer: { findFirst: jest.fn() },
  project: { findFirst: jest.fn(), findMany: jest.fn() },
  proposal: { findFirst: jest.fn() },
  invoice: { findFirst: jest.fn() },
  contract: { findFirst: jest.fn() },
  customerPortalAccessToken: { create: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
  customerPortalSession: { updateMany: jest.fn() },
};

jest.mock("../db/client", () => ({ basePrisma: mockBasePrisma, prisma: mockPrisma }));
jest.mock("../modules/proposals/service", () => ({ ProposalsService: jest.fn().mockImplementation(() => ({})) }));
jest.mock("../modules/invoices/service", () => ({ InvoicesService: jest.fn().mockImplementation(() => ({})) }));
jest.mock("../modules/contracts/service", () => ({ ContractsService: jest.fn().mockImplementation(() => ({})) }));

import { CustomerPortalService, hashPortalSecret } from "../modules/customer-portal/service";

describe("CustomerPortalService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses a one-way digest for portal secrets", () => {
    expect(hashPortalSecret("test-secret")).toBe("9caf06bb4436cdbfa20af9121a626bc1093c4f54b31c0fa937957856135345b6");
    expect(hashPortalSecret("test-secret")).not.toContain("test-secret");
  });

  it("atomically consumes an unused access token before creating a session", async () => {
    const now = new Date();
    mockTransaction.customerPortalAccessToken.findFirst.mockResolvedValue({ id: "access-1", orgId: "org-a", customerId: "customer-a", expiresAt: now });
    mockTransaction.customerPortalAccessToken.updateMany.mockResolvedValue({ count: 1 });
    mockTransaction.customerPortalSession.create.mockResolvedValue({ id: "session-1", orgId: "org-a", customerId: "customer-a", expiresAt: now });

    const result = await new CustomerPortalService().redeemAccessToken("A".repeat(43));

    expect(mockTransaction.customerPortalAccessToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "access-1", redeemedAt: null, revokedAt: null }),
    }));
    expect(mockTransaction.customerPortalSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ accessTokenId: "access-1", customerId: "customer-a", orgId: "org-a" }),
    }));
    expect(result.sessionToken).toEqual(expect.any(String));
  });

  it("rejects a second redemption when the compare-and-set update loses the race", async () => {
    mockTransaction.customerPortalAccessToken.findFirst.mockResolvedValue({ id: "access-1", orgId: "org-a", customerId: "customer-a", expiresAt: new Date() });
    mockTransaction.customerPortalAccessToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(new CustomerPortalService().redeemAccessToken("B".repeat(43))).rejects.toThrow("already used");
    expect(mockTransaction.customerPortalSession.create).not.toHaveBeenCalled();
  });

  it("revokes an access token and all sessions redeemed from it", async () => {
    mockPrisma.customerPortalAccessToken.findFirst.mockResolvedValue({ id: "access-1" });
    mockPrisma.customerPortalAccessToken.updateMany.mockResolvedValue({ count: 1 });

    await new CustomerPortalService().revokeAccessToken("org-a", "access-1");

    expect(mockPrisma.customerPortalAccessToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "access-1", orgId: "org-a", revokedAt: null },
    }));
    expect(mockPrisma.customerPortalSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { accessTokenId: "access-1", orgId: "org-a", revokedAt: null },
    }));
  });

  it("denies a project outside the portal customer's tenant and customer scope", async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);
    await expect(new CustomerPortalService().getProject({ sessionId: "s", accessTokenId: "a", orgId: "org-a", customerId: "customer-a" }, "project-b")).rejects.toThrow("Project project-b not found");
    expect(mockPrisma.project.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "project-b", orgId: "org-a", customerId: "customer-a" },
    }));
  });

  it("does not expose draft proposal or invoice PDFs", async () => {
    const service = new CustomerPortalService() as any;
    service.proposals = { getPdf: jest.fn() };
    service.invoices = { getPdf: jest.fn() };
    mockPrisma.proposal.findFirst.mockResolvedValue({ id: "proposal-1", status: "draft" });
    mockPrisma.invoice.findFirst.mockResolvedValue({ id: "invoice-1", status: "draft" });
    const context = { sessionId: "s", accessTokenId: "a", orgId: "org-a", customerId: "customer-a" };

    await expect(service.getProposalPdf(context, "proposal-1")).rejects.toThrow("Proposal proposal-1 not found");
    await expect(service.getInvoicePdf(context, "invoice-1")).rejects.toThrow("Invoice invoice-1 not found");
    expect(service.proposals.getPdf).not.toHaveBeenCalled();
    expect(service.invoices.getPdf).not.toHaveBeenCalled();
  });
});
