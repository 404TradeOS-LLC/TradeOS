const mockPrisma = {
  estimate: { findFirst: jest.fn() },
  project: { update: jest.fn() },
  proposal: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  proposalDelivery: { create: jest.fn() },
};

const mockActivityRecord = jest.fn();

jest.mock("../db/client", () => ({ prisma: mockPrisma }));
jest.mock("../modules/intelligence/service", () => ({
  ActivityTimelineService: jest.fn().mockImplementation(() => ({ record: mockActivityRecord })),
}));
jest.mock("../modules/proposal-generator/service", () => ({
  ProposalGeneratorService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../modules/athena-events/service", () => ({
  getDefaultAthenaEventService: jest.fn(() => ({ publish: jest.fn() })),
}));

import { ProposalsService } from "../modules/proposals/service";

function proposalRow(status: string) {
  return {
    id: "proposal-1",
    projectId: "project-1",
    estimateId: "estimate-1",
    status,
    companyName: null,
    showLineItemDetail: false,
    scopeOfWork: null,
    assumptions: null,
    exclusions: null,
    timeline: null,
    priceLow: null,
    priceHigh: null,
    finalPrice: null,
    paymentScheduleJson: null,
    pdfUrl: null,
    termsAndConditions: null,
    sentAt: new Date(),
    viewedAt: null,
    respondedAt: null,
    createdAt: new Date(),
    deliveries: [],
    project: { orgId: "org-1", customer: { email: "customer@example.com" } },
  };
}

describe("proposal-driven Project lifecycle behavior", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActivityRecord.mockResolvedValue(undefined);
  });

  it("moves estimate-backed proposal creation to canonical estimating", async () => {
    mockPrisma.estimate.findFirst.mockResolvedValue({ id: "estimate-1", projectId: "project-1", orgId: "org-1" });
    mockPrisma.proposal.create.mockResolvedValue(proposalRow("draft"));

    const service = new ProposalsService();
    await service.create({ orgId: "org-1", estimateId: "estimate-1" });

    expect(mockPrisma.project.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { status: "estimating" },
    });
  });

  it("moves declined proposals back to canonical estimating", async () => {
    mockPrisma.proposal.findFirst
      .mockResolvedValueOnce(proposalRow("sent"))
      .mockResolvedValueOnce(proposalRow("declined"));
    mockPrisma.proposal.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.proposalDelivery.create.mockResolvedValue({});

    const service = new ProposalsService();
    await service.reject("proposal-1", "org-1", "owner-1");

    expect(mockPrisma.project.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { status: "estimating" },
    });
  });

  it("moves duplicated proposals to canonical estimating", async () => {
    mockPrisma.proposal.findFirst.mockResolvedValueOnce(proposalRow("sent"));
    mockPrisma.proposal.create.mockResolvedValue({ ...proposalRow("draft"), id: "proposal-2" });

    const service = new ProposalsService();
    await service.duplicate("proposal-1", "org-1");

    expect(mockPrisma.project.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { status: "estimating" },
    });
  });
});

