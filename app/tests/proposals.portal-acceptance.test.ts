const mockPrisma = {
  project: {
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  proposal: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  proposalDelivery: {
    create: jest.fn().mockResolvedValue({ id: "delivery-1" }),
  },
  proposalSelection: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
  proposalAllowance: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
  contract: {
    findFirst: jest.fn(),
  },
};

const mockProposalGenerator = {
  generateProposal: jest.fn(),
  generateProjectProposal: jest.fn(),
};

const mockAthenaEventService = {
  publish: jest.fn(),
};

function proposalRow(status: string, overrides: Record<string, unknown> = {}) {
  return {
    id: "proposal-1",
    projectId: "project-1",
    estimateId: "estimate-1",
    status,
    companyName: null,
    showLineItemDetail: false,
    scopeOfWork: "Replace the deck",
    assumptions: null,
    exclusions: null,
    timeline: null,
    priceLow: null,
    priceHigh: null,
    finalPrice: 975,
    paymentScheduleJson: null,
    pdfUrl: null,
    termsAndConditions: null,
    sentAt: new Date(),
    viewedAt: null,
    respondedAt: null,
    signerName: null,
    signerEmail: null,
    signatureDataUrl: null,
    signatureIpReported: null,
    signatureUserAgentReported: null,
    signedAt: null,
    declinedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deliveries: [],
    selections: [],
    allowances: [],
    project: { orgId: "org-1", customer: { id: "customer-1", email: "customer@example.com" } },
    ...overrides,
  };
}

const acceptInput = {
  orgId: "org-1",
  customerId: "customer-1",
  portalSessionId: "session-1",
  signerName: "Sarah Johnson",
  signerEmail: "customer@example.com",
  signatureDataUrl: "data:image/png;base64,iVBORw0KGgo=",
  signatureIpReported: "203.0.113.7",
  signatureUserAgentReported: "TestAgent/1.0",
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));
jest.mock("../modules/proposal-generator/service", () => ({
  ProposalGeneratorService: jest.fn().mockImplementation(() => mockProposalGenerator),
}));
jest.mock("../modules/intelligence/service", () => ({
  ActivityTimelineService: jest.fn().mockImplementation(() => ({
    record: jest.fn().mockResolvedValue(undefined),
  })),
}));
jest.mock("../modules/athena-events/service", () => ({
  getDefaultAthenaEventService: jest.fn(() => mockAthenaEventService),
}));

import { ProposalsService } from "../modules/proposals/service";

describe("ProposalsService portal acceptance (DES-10-F7)", () => {
  afterEach(() => jest.restoreAllMocks());

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.project.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.proposal.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.proposalDelivery.create.mockResolvedValue({ id: "delivery-1" });
    mockAthenaEventService.publish.mockResolvedValue({
      event: {},
      deliveriesCreated: 0,
      deduplicated: false,
    });
  });

  describe("acceptAsPortalCustomer", () => {
    it("accepts a sent proposal and records the drawn signature with the portal audit trail", async () => {
      mockPrisma.proposal.findFirst
        .mockResolvedValueOnce(proposalRow("sent"))
        .mockResolvedValueOnce(proposalRow("accepted", { respondedAt: new Date(), signerName: "Sarah Johnson", signedAt: new Date() }));
      const service = new ProposalsService();

      const result = await service.acceptAsPortalCustomer("proposal-1", acceptInput);

      expect(result.status).toBe("accepted");
      expect(mockPrisma.proposal.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "proposal-1",
            status: "sent",
            project: { orgId: "org-1", customerId: "customer-1" },
          }),
          data: expect.objectContaining({
            status: "accepted",
            signerName: "Sarah Johnson",
            signerEmail: "customer@example.com",
            signatureDataUrl: "data:image/png;base64,iVBORw0KGgo=",
            signatureIpReported: "203.0.113.7",
          }),
        })
      );
      expect(mockPrisma.proposalDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: "proposal.accepted",
            deliveryChannel: "portal",
            actorUserId: undefined,
            metadataJson: expect.objectContaining({
              actorType: "customer_portal",
              customerId: "customer-1",
              portalSessionId: "session-1",
              signerName: "Sarah Johnson",
            }),
          }),
        })
      );
      expect(mockPrisma.project.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "project-1", status: "estimating" }),
          data: { status: "awarded" },
        })
      );
    });

    it("rejects a typed name with no drawn signature", async () => {
      mockPrisma.proposal.findFirst.mockResolvedValue(proposalRow("sent"));
      const service = new ProposalsService();

      await expect(
        service.acceptAsPortalCustomer("proposal-1", { ...acceptInput, signatureDataUrl: "" })
      ).rejects.toMatchObject({ statusCode: 400 });
      await expect(
        service.acceptAsPortalCustomer("proposal-1", { ...acceptInput, signatureDataUrl: "Sarah Johnson" })
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(mockPrisma.proposal.updateMany).not.toHaveBeenCalled();
    });

    it("rejects a signature data URL with no decodable image", async () => {
      mockPrisma.proposal.findFirst.mockResolvedValue(proposalRow("sent"));
      const service = new ProposalsService();

      for (const signatureDataUrl of [
        "data:image/",
        "data:image/png;base64,",
        "data:image/png;base64,!!!",
        "data:image/svg+xml;base64,PHN2Zz4=",
        "data:image/png;base64,A",
      ]) {
        await expect(
          service.acceptAsPortalCustomer("proposal-1", { ...acceptInput, signatureDataUrl })
        ).rejects.toMatchObject({ statusCode: 400 });
      }
      expect(mockPrisma.proposal.updateMany).not.toHaveBeenCalled();
    });

    it("rejects an accept of a revision the customer did not review", async () => {
      mockPrisma.proposal.findFirst.mockResolvedValue(
        proposalRow("sent", { updatedAt: new Date("2026-11-24T12:00:00.000Z") })
      );
      const service = new ProposalsService();

      await expect(
        service.acceptAsPortalCustomer("proposal-1", { ...acceptInput, expectedUpdatedAt: "2026-11-24T11:00:00.000Z" })
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(mockPrisma.proposal.updateMany).not.toHaveBeenCalled();
    });

    it("accepts when the reviewed revision matches and predicates the write on it", async () => {
      mockPrisma.proposal.findFirst
        .mockResolvedValueOnce(proposalRow("sent", { updatedAt: new Date("2026-11-24T12:00:00.000Z") }))
        .mockResolvedValueOnce(
          proposalRow("accepted", { updatedAt: new Date("2026-11-24T12:00:00.000Z"), respondedAt: new Date(), signerName: "Sarah Johnson", signedAt: new Date() })
        );
      const service = new ProposalsService();

      const result = await service.acceptAsPortalCustomer("proposal-1", {
        ...acceptInput,
        expectedUpdatedAt: "2026-11-24T12:00:00.000Z",
      });

      expect(result.status).toBe("accepted");
      expect(mockPrisma.proposal.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ updatedAt: new Date("2026-11-24T12:00:00.000Z") }),
        })
      );
    });

    it("rejects an unparseable expectedUpdatedAt", async () => {
      mockPrisma.proposal.findFirst.mockResolvedValue(proposalRow("sent"));
      const service = new ProposalsService();

      await expect(
        service.acceptAsPortalCustomer("proposal-1", { ...acceptInput, expectedUpdatedAt: "not-a-date" })
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(mockPrisma.proposal.updateMany).not.toHaveBeenCalled();
    });

    it("rejects an empty signer name", async () => {
      mockPrisma.proposal.findFirst.mockResolvedValue(proposalRow("sent"));
      const service = new ProposalsService();

      await expect(
        service.acceptAsPortalCustomer("proposal-1", { ...acceptInput, signerName: "   " })
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(mockPrisma.proposal.updateMany).not.toHaveBeenCalled();
    });

    it("rejects a draft proposal before any write", async () => {
      mockPrisma.proposal.findFirst.mockResolvedValue(proposalRow("draft"));
      const service = new ProposalsService();

      await expect(service.acceptAsPortalCustomer("proposal-1", acceptInput)).rejects.toMatchObject({ statusCode: 409 });
      expect(mockPrisma.proposal.updateMany).not.toHaveBeenCalled();
    });

    it("rejects a second accept of an already-accepted proposal", async () => {
      mockPrisma.proposal.findFirst.mockResolvedValue(proposalRow("accepted"));
      const service = new ProposalsService();

      await expect(service.acceptAsPortalCustomer("proposal-1", acceptInput)).rejects.toMatchObject({ statusCode: 409 });
      expect(mockPrisma.proposal.updateMany).not.toHaveBeenCalled();
    });

    it("maps a proposal owned by another customer to 404", async () => {
      mockPrisma.proposal.findFirst.mockResolvedValue(
        proposalRow("sent", { project: { orgId: "org-1", customer: { id: "customer-2", email: "other@example.com" } } })
      );
      const service = new ProposalsService();

      await expect(service.acceptAsPortalCustomer("proposal-1", acceptInput)).rejects.toMatchObject({ statusCode: 404 });
      expect(mockPrisma.proposal.updateMany).not.toHaveBeenCalled();
    });

    it("fails closed when the row changes between read and write", async () => {
      mockPrisma.proposal.findFirst.mockResolvedValue(proposalRow("sent"));
      mockPrisma.proposal.updateMany.mockResolvedValue({ count: 0 });
      const service = new ProposalsService();

      await expect(service.acceptAsPortalCustomer("proposal-1", acceptInput)).rejects.toMatchObject({ statusCode: 409 });
      expect(mockPrisma.proposalDelivery.create).not.toHaveBeenCalled();
    });
  });

  describe("declineAsPortalCustomer", () => {
    const declineInput = { orgId: "org-1", customerId: "customer-1", portalSessionId: "session-1", reason: "Timing no longer works" };

    it("declines a viewed proposal, records the reason, and leaves the project untouched", async () => {
      mockPrisma.proposal.findFirst
        .mockResolvedValueOnce(proposalRow("viewed"))
        .mockResolvedValueOnce(proposalRow("declined", { respondedAt: new Date(), declinedReason: "Timing no longer works" }));
      const service = new ProposalsService();

      const result = await service.declineAsPortalCustomer("proposal-1", declineInput);

      expect(result.status).toBe("declined");
      expect(mockPrisma.proposal.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "declined", declinedReason: "Timing no longer works" }),
        })
      );
      expect(mockPrisma.proposalDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: "proposal.declined",
            deliveryChannel: "portal",
            metadataJson: expect.objectContaining({ actorType: "customer_portal", declinedReason: "Timing no longer works" }),
          }),
        })
      );
      expect(mockPrisma.project.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.project.update).not.toHaveBeenCalled();
    });

    it("rejects a decline reason over 500 characters", async () => {
      mockPrisma.proposal.findFirst.mockResolvedValue(proposalRow("sent"));
      const service = new ProposalsService();

      await expect(
        service.declineAsPortalCustomer("proposal-1", { ...declineInput, reason: "x".repeat(501) })
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(mockPrisma.proposal.updateMany).not.toHaveBeenCalled();
    });

    it("rejects a decline of a draft proposal", async () => {
      mockPrisma.proposal.findFirst.mockResolvedValue(proposalRow("draft"));
      const service = new ProposalsService();

      await expect(service.declineAsPortalCustomer("proposal-1", declineInput)).rejects.toMatchObject({ statusCode: 409 });
      expect(mockPrisma.proposal.updateMany).not.toHaveBeenCalled();
    });

    it("rejects a decline of a revision the customer did not review", async () => {
      mockPrisma.proposal.findFirst.mockResolvedValue(
        proposalRow("sent", { updatedAt: new Date("2026-11-24T12:00:00.000Z") })
      );
      const service = new ProposalsService();

      await expect(
        service.declineAsPortalCustomer("proposal-1", { ...declineInput, expectedUpdatedAt: "2026-11-24T11:00:00.000Z" })
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(mockPrisma.proposal.updateMany).not.toHaveBeenCalled();
    });

    it("maps a proposal owned by another customer to 404", async () => {
      mockPrisma.proposal.findFirst.mockResolvedValue(
        proposalRow("sent", { project: { orgId: "org-1", customer: { id: "customer-2", email: "other@example.com" } } })
      );
      const service = new ProposalsService();

      await expect(service.declineAsPortalCustomer("proposal-1", declineInput)).rejects.toMatchObject({ statusCode: 404 });
      expect(mockPrisma.proposal.updateMany).not.toHaveBeenCalled();
    });
  });
});
