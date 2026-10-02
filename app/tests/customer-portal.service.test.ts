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

const mockSendCustomerPortalAccess = jest.fn();
const mockScheduleEmailInBackground = jest.fn((send: () => Promise<void>) => {
  void send();
});
jest.mock("../modules/email/service", () => ({
  emailService: { sendCustomerPortalAccess: mockSendCustomerPortalAccess },
  scheduleEmailInBackground: mockScheduleEmailInBackground,
}));

import { CustomerPortalService, hashPortalSecret } from "../modules/customer-portal/service";

describe("CustomerPortalService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses a one-way digest for portal secrets", () => {
    expect(hashPortalSecret("test-secret")).toBe("9caf06bb4436cdbfa20af9121a626bc1093c4f54b31c0fa937957856135345b6");
    expect(hashPortalSecret("test-secret")).not.toContain("test-secret");
  });

  it("schedules server-side delivery after issuing an access token", async () => {
    const expiresAt = new Date("2026-09-20T12:00:00.000Z");
    mockPrisma.customer.findFirst.mockResolvedValue({ id: "customer-a", email: "customer@example.com" });
    mockPrisma.customerPortalAccessToken.create.mockResolvedValue({
      id: "access-1",
      customerId: "customer-a",
      expiresAt,
    });
    mockSendCustomerPortalAccess.mockResolvedValue({ sent: true });

    const result = await new CustomerPortalService().issueAccessToken({
      orgId: "org-a",
      customerId: "customer-a",
      createdByUserId: "user-a",
    });

    expect(mockScheduleEmailInBackground).toHaveBeenCalledTimes(1);
    expect(mockSendCustomerPortalAccess).toHaveBeenCalledWith({
      to: "customer@example.com",
      token: result.token,
      expiresAt,
    });
    expect(mockPrisma.customerPortalAccessToken.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tokenHash: hashPortalSecret(result.token) }),
    }));
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

  it("denies revoked and expired links before attempting a session write", async () => {
    mockTransaction.customerPortalAccessToken.findFirst.mockResolvedValue(null);
    for (const token of ["D".repeat(43), "E".repeat(43)]) {
      await expect(new CustomerPortalService().redeemAccessToken(token)).rejects.toThrow("invalid, expired, or already used");
    }
    expect(mockTransaction.customerPortalAccessToken.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ redeemedAt: null, revokedAt: null, expiresAt: { gt: expect.any(Date) } }),
    }));
    expect(mockTransaction.customerPortalSession.create).not.toHaveBeenCalled();
  });

  it("rejects malformed access and session values before querying for their hashes", async () => {
    const service = new CustomerPortalService();
    for (const secret of ["short", "?".repeat(43), "x".repeat(129)]) {
      await expect(service.redeemAccessToken(secret)).rejects.toThrow("Invalid access token");
      await expect(service.resolveSession(secret)).rejects.toThrow("Invalid portal session");
    }
    expect(mockBasePrisma.$transaction).not.toHaveBeenCalled();
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

  it("checks both organization and customer for every document and PDF before reading", async () => {
    const service = new CustomerPortalService() as any;
    service.proposals = { getById: jest.fn(), getPdf: jest.fn() };
    service.invoices = { getById: jest.fn(), getPdf: jest.fn() };
    service.contracts = { getById: jest.fn(), getPdf: jest.fn(), signAsPortalCustomer: jest.fn() };
    const context = { sessionId: "s", accessTokenId: "a", orgId: "org-a", customerId: "customer-a" };
    mockPrisma.proposal.findFirst.mockResolvedValue(null);
    mockPrisma.invoice.findFirst.mockResolvedValue(null);
    mockPrisma.contract.findFirst.mockResolvedValue(null);

    for (const [resource, method] of [
      ["proposal", "getProposal"], ["proposal", "getProposalPdf"],
      ["invoice", "getInvoice"], ["invoice", "getInvoicePdf"],
      ["contract", "getContract"], ["contract", "getContractPdf"], ["contract", "signContract"],
    ] as const) {
      await expect(service[method](context, `${resource}-b`, { signerName: "Customer" })).rejects.toThrow("not found");
      expect(mockPrisma[resource].findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: `${resource}-b`, project: { orgId: "org-a", customerId: "customer-a" } }),
      }));
    }
    expect(service.proposals.getPdf).not.toHaveBeenCalled();
    expect(service.invoices.getPdf).not.toHaveBeenCalled();
    expect(service.contracts.getPdf).not.toHaveBeenCalled();
    expect(service.contracts.signAsPortalCustomer).not.toHaveBeenCalled();
  });

  it("denies draft proposal and invoice detail as well as PDF", async () => {
    const service = new CustomerPortalService() as any;
    service.proposals = { getById: jest.fn().mockResolvedValue({ status: "draft" }) };
    service.invoices = { getById: jest.fn().mockResolvedValue({ status: "draft" }) };
    mockPrisma.proposal.findFirst.mockResolvedValue({ id: "proposal-a", status: "draft" });
    mockPrisma.invoice.findFirst.mockResolvedValue({ id: "invoice-a", status: "draft" });
    const context = { sessionId: "s", accessTokenId: "a", orgId: "org-a", customerId: "customer-a" };
    await expect(service.getProposal(context, "proposal-a")).rejects.toThrow("not found");
    await expect(service.getInvoice(context, "invoice-a")).rejects.toThrow("not found");
  });

  it("denies expired and revoked sessions before loading customer records", async () => {
    mockTransaction.customerPortalSession.findFirst.mockResolvedValue(null);
    await expect(new CustomerPortalService().resolveSession("F".repeat(43))).rejects.toThrow("invalid or expired");
    expect(mockTransaction.customerPortalSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ revokedAt: null, expiresAt: { gt: expect.any(Date) } }),
    }));
    expect(mockTransaction.customer.findFirst).not.toHaveBeenCalled();
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

  it("rejects a session when the last-seen compare-and-set loses a revoke race", async () => {
    mockTransaction.customerPortalSession.findFirst.mockResolvedValue({
      id: "session-1",
      accessTokenId: "access-1",
      orgId: "org-a",
      customerId: "customer-a",
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockTransaction.customer.findFirst.mockResolvedValue({ id: "customer-a" });
    mockTransaction.customerPortalSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(new CustomerPortalService().resolveSession("C".repeat(43))).rejects.toThrow("revoked");
  });
});
