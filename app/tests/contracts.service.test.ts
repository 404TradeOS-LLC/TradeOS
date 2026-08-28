const mockPrisma = {
  proposal: {
    findFirst: jest.fn(),
  },
  contract: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  contractEvent: {
    create: jest.fn(),
  },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));
jest.mock("../modules/contracts/pdf", () => ({
  renderContractPdf: jest.fn().mockResolvedValue(Buffer.from("pdf")),
}));
jest.mock("../modules/intelligence/service", () => ({
  ActivityTimelineService: jest.fn().mockImplementation(() => ({
    record: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { ContractsService } from "../modules/contracts/service";

describe("ContractsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a contract from an accepted proposal", async () => {
    mockPrisma.proposal.findFirst.mockResolvedValue({
      id: "proposal-1",
      projectId: "project-1",
      status: "accepted",
      termsAndConditions: "Custom terms",
      finalPrice: 8500,
      companyName: "Canonical Builders",
      scopeOfWork: "Build the agreed scope.",
      assumptions: "Normal site access.",
      exclusions: "Permits excluded.",
      timeline: "Four weeks",
      paymentScheduleJson: [{ label: "Deposit", amountPercent: 50 }],
    });
    mockPrisma.contract.create.mockResolvedValue({
      id: "contract-1",
      projectId: "project-1",
      proposalId: "proposal-1",
      status: "pending_signature",
      termsText: "Custom terms",
      contractAmount: 8500,
      snapshotJson: { contractAmount: 8500 },
      signerName: null,
      signerEmail: null,
      signatureDataUrl: null,
      signatureIpReported: null,
      signedAt: null,
      createdAt: new Date(),
    });
    mockPrisma.contract.findFirst.mockResolvedValue({
      id: "contract-1",
      projectId: "project-1",
      proposalId: "proposal-1",
      status: "pending_signature",
      termsText: "Custom terms",
      contractAmount: 8500,
      snapshotJson: { contractAmount: 8500, scopeOfWork: "Build the agreed scope." },
      signerName: null,
      signerEmail: null,
      signatureDataUrl: null,
      signatureIpReported: null,
      signatureUserAgentReported: null,
      signedAt: null,
      createdAt: new Date(),
      events: [{ id: "event-1", eventType: "contract.created", actorUserId: "user-1", recipientEmail: null, metadataJson: null, occurredAt: new Date(), createdAt: new Date() }],
      project: { id: "project-1", orgId: "org-1" },
    });

    const service = new ContractsService();
    const contract = await service.create({ orgId: "org-1", actorUserId: "user-1", actorRole: "admin", proposalId: "proposal-1" });

    expect(contract.status).toBe("sent");
    expect(contract.termsText).toBe("Custom terms");
    expect(contract.contractAmount).toBe(8500);
    expect(mockPrisma.contract.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ contractAmount: 8500, snapshotJson: expect.objectContaining({ scopeOfWork: "Build the agreed scope." }) }) })
    );
    expect(contract.events[0]?.eventType).toBe("contract.created");
  });

  it("normalizes a historical pending_signature row to canonical sent on read", async () => {
    mockPrisma.contract.findFirst.mockResolvedValue({
      id: "contract-1",
      projectId: "project-1",
      proposalId: "proposal-1",
      status: "pending_signature",
      termsText: "Custom terms",
      signerName: null,
      signerEmail: null,
      signatureDataUrl: null,
      signatureIpReported: null,
      signatureUserAgentReported: null,
      signedAt: null,
      createdAt: new Date(),
      events: [],
      project: { id: "project-1", orgId: "org-1" },
    });

    const service = new ContractsService();
    const contract = await service.getById("contract-1", "org-1");

    expect(contract.status).toBe("sent");
  });

  it("rejects creating a contract from a proposal that hasn't been accepted", async () => {
    mockPrisma.proposal.findFirst.mockResolvedValue({ id: "proposal-1", projectId: "project-1", status: "sent" });

    const service = new ContractsService();
    await expect(service.create({ orgId: "org-1", actorRole: "admin", proposalId: "proposal-1" })).rejects.toThrow("must be accepted");
  });

  it("rejects contract mutations for roles without documents.manage", async () => {
    const service = new ContractsService();

    await expect(service.create({ orgId: "org-1", actorRole: "technician", proposalId: "proposal-1" })).rejects.toThrow(
      "manage contracts"
    );
  });

  it("signs a pending contract and stamps signedAt", async () => {
    mockPrisma.contract.findFirst
      .mockResolvedValueOnce({
        id: "contract-1",
        projectId: "project-1",
        proposalId: "proposal-1",
        status: "pending_signature",
        signerEmail: null,
        events: [],
        project: { id: "project-1", orgId: "org-1" },
      })
      .mockResolvedValueOnce({
        id: "contract-1",
        projectId: "project-1",
        proposalId: "proposal-1",
        status: "signed",
        termsText: "Custom terms",
        signerName: "Jane Doe",
        signerEmail: "jane@example.com",
        signatureDataUrl: null,
        signatureIpReported: "127.0.0.1",
        signatureUserAgentReported: null,
        signedAt: new Date(),
        createdAt: new Date(),
        events: [{ id: "event-2", eventType: "contract.signed", actorUserId: "user-1", recipientEmail: "jane@example.com", metadataJson: null, occurredAt: new Date(), createdAt: new Date() }],
        project: { id: "project-1", orgId: "org-1" },
      });
    mockPrisma.contract.updateMany.mockResolvedValue({ count: 1 });

    const service = new ContractsService();
    const contract = await service.sign("contract-1", {
      orgId: "org-1",
      actorUserId: "user-1",
      actorRole: "admin",
      signerName: "Jane Doe",
      signerEmail: "jane@example.com",
      signatureIpReported: "127.0.0.1",
    });

    expect(contract.status).toBe("signed");
    expect(contract.signerName).toBe("Jane Doe");
    expect(mockPrisma.contractEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: "contract.signed", actorUserId: "user-1" }) })
    );
  });

  it("fails closed when a competing signer changes the contract after the read", async () => {
    mockPrisma.contract.findFirst.mockResolvedValue({
      id: "contract-1",
      projectId: "project-1",
      proposalId: "proposal-1",
      status: "pending_signature",
      signerEmail: null,
      events: [],
      project: { id: "project-1", orgId: "org-1" },
    });
    mockPrisma.contract.updateMany.mockResolvedValue({ count: 0 });

    const service = new ContractsService();
    await expect(service.sign("contract-1", { orgId: "org-1", actorRole: "admin", signerName: "Jane Doe" })).rejects.toThrow(
      "changed before it could be signed"
    );
    expect(mockPrisma.contractEvent.create).not.toHaveBeenCalled();
  });

  it("rejects signing a contract that is already signed", async () => {
    mockPrisma.contract.findFirst.mockResolvedValue({
      id: "contract-1",
      projectId: "project-1",
      status: "signed",
      events: [],
      project: { id: "project-1", orgId: "org-1" },
    });

    const service = new ContractsService();
    await expect(service.sign("contract-1", { orgId: "org-1", actorRole: "admin", signerName: "Jane Doe" })).rejects.toThrow("cannot be signed");
  });

  it("rejects voiding a signed contract", async () => {
    mockPrisma.contract.findFirst.mockResolvedValue({
      id: "contract-1",
      projectId: "project-1",
      status: "signed",
      signerEmail: "jane@example.com",
      events: [],
      project: { id: "project-1", orgId: "org-1" },
    });

    const service = new ContractsService();
    await expect(service.void("contract-1", "org-1", "user-1", "admin")).rejects.toThrow("already been signed");
  });

  it("rejects voiding an already voided contract", async () => {
    mockPrisma.contract.findFirst.mockResolvedValue({
      id: "contract-1",
      projectId: "project-1",
      status: "voided",
      signerEmail: "jane@example.com",
      events: [],
      project: { id: "project-1", orgId: "org-1" },
    });

    const service = new ContractsService();
    await expect(service.void("contract-1", "org-1", "user-1", "admin")).rejects.toThrow("already been voided");
  });

  it("fails closed when a competing void changes the contract after the read", async () => {
    mockPrisma.contract.findFirst.mockResolvedValue({
      id: "contract-1",
      projectId: "project-1",
      proposalId: "proposal-1",
      status: "pending_signature",
      signerEmail: null,
      events: [],
      project: { id: "project-1", orgId: "org-1" },
    });
    mockPrisma.contract.updateMany.mockResolvedValue({ count: 0 });

    const service = new ContractsService();
    await expect(service.void("contract-1", "org-1", "user-1", "admin")).rejects.toThrow(
      "changed before it could be voided"
    );
    expect(mockPrisma.contractEvent.create).not.toHaveBeenCalled();
  });
});
