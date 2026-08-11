const mockPrisma = {
  estimate: {
    findFirst: jest.fn(),
  },
  project: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  proposal: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  proposalDelivery: {
    create: jest.fn(),
  },
};

const mockProposalGenerator = {
  generateProposal: jest.fn(),
  generateProjectProposal: jest.fn(),
};

const mockAthenaEventService = {
  publish: jest.fn(),
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

function draftProposalRow() {
  return {
    id: "proposal-1",
    projectId: "project-1",
    status: "draft",
    paymentScheduleJson: [
      { label: "Deposit", amountPercent: 50 },
      { label: "Final", amountPercent: 50 },
    ],
    deliveries: [],
    project: {
      orgId: "org-1",
      customer: { id: "customer-1", email: "customer@example.com" },
    },
  };
}

function sentProposalDTORow() {
  return {
    id: "proposal-1",
    projectId: "project-1",
    estimateId: "estimate-1",
    status: "sent",
    companyName: null,
    showLineItemDetail: false,
    scopeOfWork: null,
    assumptions: null,
    exclusions: null,
    timeline: null,
    priceLow: null,
    priceHigh: null,
    finalPrice: null,
    paymentScheduleJson: [
      { label: "Deposit", amountPercent: 50 },
      { label: "Final", amountPercent: 50 },
    ],
    pdfUrl: null,
    termsAndConditions: null,
    sentAt: new Date(),
    viewedAt: null,
    respondedAt: null,
    createdAt: new Date(),
    deliveries: [],
    project: {
      orgId: "org-1",
      customer: { id: "customer-1", email: "customer@example.com" },
    },
  };
}

describe("ProposalsService athena-events integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("publishes exactly one ProposalSent event with the correct shape when sending a draft proposal", async () => {
    mockPrisma.proposal.findFirst
      .mockResolvedValueOnce(draftProposalRow())
      .mockResolvedValueOnce(sentProposalDTORow());
    mockPrisma.proposal.update.mockResolvedValue({
      id: "proposal-1",
      projectId: "project-1",
      estimateId: "estimate-1",
      status: "sent",
      companyName: null,
      showLineItemDetail: false,
      termsAndConditions: null,
      sentAt: new Date(),
      viewedAt: null,
      respondedAt: null,
      createdAt: new Date(),
      deliveries: [],
    });
    mockAthenaEventService.publish.mockResolvedValue({
      event: {},
      deliveriesCreated: 0,
      deduplicated: false,
    });

    const service = new ProposalsService();
    const proposal = await service.send("proposal-1", "org-1", "owner-1");

    expect(proposal.status).toBe("sent");
    expect(mockAthenaEventService.publish).toHaveBeenCalledTimes(1);
    expect(mockAthenaEventService.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org-1",
        type: "ProposalSent",
        version: "1.0.0",
        entity: { type: "proposal", id: "proposal-1" },
        actor: { type: "user", id: "owner-1" },
        payload: { projectId: "project-1", customerId: "customer-1" },
        idempotencyKey: expect.stringMatching(/^proposal:proposal-1:sent:v1$/),
      })
    );
  });

  it("still completes send() and returns the updated proposal when publish() rejects", async () => {
    mockPrisma.proposal.findFirst
      .mockResolvedValueOnce(draftProposalRow())
      .mockResolvedValueOnce(sentProposalDTORow());
    mockPrisma.proposal.update.mockResolvedValue({
      id: "proposal-1",
      projectId: "project-1",
      estimateId: "estimate-1",
      status: "sent",
      companyName: null,
      showLineItemDetail: false,
      termsAndConditions: null,
      sentAt: new Date(),
      viewedAt: null,
      respondedAt: null,
      createdAt: new Date(),
      deliveries: [],
    });
    mockAthenaEventService.publish.mockRejectedValue(new Error("athena-events unavailable"));
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const service = new ProposalsService();
    const proposal = await service.send("proposal-1", "org-1", "owner-1");

    expect(proposal.status).toBe("sent");
    expect(proposal.sentAt).not.toBeNull();
    expect(mockAthenaEventService.publish).toHaveBeenCalledTimes(1);
    expect(mockPrisma.proposal.update).toHaveBeenCalledWith({
      where: { id: "proposal-1" },
      data: { status: "sent", sentAt: expect.any(Date) },
    });

    consoleErrorSpy.mockRestore();
  });
});
