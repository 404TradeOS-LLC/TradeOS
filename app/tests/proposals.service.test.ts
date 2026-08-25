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
    updateMany: jest.fn(),
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
    project: { orgId: "org-1", customer: { id: "customer-1", email: "customer@example.com" } },
  };
}

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

describe("ProposalsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAthenaEventService.publish.mockResolvedValue({
      event: {},
      deliveriesCreated: 0,
      deduplicated: false,
    });
  });

  it("creates a draft proposal scoped to the estimate's project", async () => {
    mockPrisma.estimate.findFirst.mockResolvedValue({ id: "estimate-1", projectId: "project-1", orgId: "org-1" });
    mockPrisma.proposal.create.mockResolvedValue({
      id: "proposal-1",
      projectId: "project-1",
      estimateId: "estimate-1",
      status: "draft",
      companyName: null,
      showLineItemDetail: false,
      termsAndConditions: null,
      sentAt: null,
      viewedAt: null,
      respondedAt: null,
      createdAt: new Date(),
      deliveries: [],
    });

    const service = new ProposalsService();
    const proposal = await service.create({ orgId: "org-1", estimateId: "estimate-1" });

    expect(proposal.status).toBe("draft");
    expect(mockPrisma.proposal.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ projectId: "project-1", estimateId: "estimate-1" }) })
    );
  });

  it("sends a draft proposal and stamps sentAt", async () => {
    mockPrisma.proposal.findFirst
      .mockResolvedValueOnce({
        id: "proposal-1",
        projectId: "project-1",
        status: "draft",
        paymentScheduleJson: [
          { label: "Deposit", amountPercent: 50 },
          { label: "Final", amountPercent: 50 },
        ],
        deliveries: [],
        project: { orgId: "org-1", customer: { email: "customer@example.com" } },
      })
      .mockResolvedValueOnce({
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
        paymentScheduleJson: [{ label: "Deposit", amountPercent: 50 }, { label: "Final", amountPercent: 50 }],
        pdfUrl: null,
        termsAndConditions: null,
        sentAt: new Date(),
        viewedAt: null,
        respondedAt: null,
        createdAt: new Date(),
        deliveries: [
          {
            id: "delivery-1",
            proposalId: "proposal-1",
            eventType: "proposal.sent",
            deliveryChannel: "app",
            recipientEmail: "customer@example.com",
            actorUserId: "owner-1",
            metadataJson: { previousStatus: "draft", newStatus: "sent" },
            occurredAt: new Date(),
            createdAt: new Date(),
          },
        ],
        project: { orgId: "org-1", customer: { email: "customer@example.com" } },
      });
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

    const service = new ProposalsService();
    const proposal = await service.send("proposal-1", "org-1", "owner-1");

    expect(proposal.status).toBe("sent");
    expect(proposal.sentAt).not.toBeNull();
    expect(proposal.deliveries[0]?.eventType).toBe("proposal.sent");
    expect(mockPrisma.proposalDelivery.create).toHaveBeenCalled();
    expect(mockPrisma.project.update).toHaveBeenCalledWith({ where: { id: "project-1" }, data: { status: "estimating" } });
  });

  it("rejects sending a proposal that has already been sent", async () => {
    mockPrisma.proposal.findFirst.mockResolvedValue({ id: "proposal-1", status: "sent" });

    const service = new ProposalsService();
    await expect(service.send("proposal-1", "org-1")).rejects.toThrow("already been sent");
  });

  it("accepts a sent proposal", async () => {
    mockPrisma.proposal.findFirst
      .mockResolvedValueOnce({
        id: "proposal-1",
        projectId: "project-1",
        status: "sent",
        deliveries: [],
        project: { orgId: "org-1", customer: { email: "customer@example.com" } },
      })
      .mockResolvedValueOnce({
        id: "proposal-1",
        projectId: "project-1",
        estimateId: "estimate-1",
        status: "accepted",
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
        respondedAt: new Date(),
        createdAt: new Date(),
        deliveries: [],
        project: { orgId: "org-1", customer: { email: "customer@example.com" } },
      });
    mockPrisma.proposal.updateMany.mockResolvedValue({ count: 1 });

    const service = new ProposalsService();
    const proposal = await service.accept("proposal-1", "org-1", "owner-1");

    expect(proposal.status).toBe("accepted");
    expect(mockPrisma.proposalDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "proposal.accepted",
        }),
      })
    );
    expect(mockPrisma.project.update).toHaveBeenCalledWith({ where: { id: "project-1" }, data: { status: "awarded" } });
  });

  it("marks a sent proposal viewed with an organization-scoped conditional transition", async () => {
    mockPrisma.proposal.findFirst
      .mockResolvedValueOnce(proposalRow("sent"))
      .mockResolvedValueOnce(proposalRow("viewed"));
    mockPrisma.proposal.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.proposalDelivery.create.mockResolvedValue({});

    const service = new ProposalsService();
    const proposal = await service.markViewed("proposal-1", "org-1", "owner-1");

    expect(proposal.status).toBe("viewed");
    expect(mockPrisma.proposal.updateMany).toHaveBeenCalledWith({
      where: { id: "proposal-1", status: "sent", project: { orgId: "org-1" } },
      data: expect.objectContaining({ status: "viewed", viewedAt: expect.any(Date) }),
    });
    expect(mockPrisma.proposalDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "proposal.viewed", actorUserId: "owner-1" }),
      })
    );
  });

  it("uses the observed status as the compare-and-swap value for acceptance", async () => {
    mockPrisma.proposal.findFirst
      .mockResolvedValueOnce(proposalRow("viewed"))
      .mockResolvedValueOnce(proposalRow("accepted"));
    mockPrisma.proposal.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.proposalDelivery.create.mockResolvedValue({});

    const service = new ProposalsService();
    await service.accept("proposal-1", "org-1", "owner-1");

    expect(mockPrisma.proposal.updateMany).toHaveBeenCalledWith({
      where: { id: "proposal-1", status: "viewed", project: { orgId: "org-1" } },
      data: expect.objectContaining({ status: "accepted", respondedAt: expect.any(Date) }),
    });
    expect(mockPrisma.proposalDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "proposal.accepted",
          metadataJson: { previousStatus: "viewed", newStatus: "accepted" },
        }),
      })
    );
  });

  it("rejects accepting a proposal still in draft", async () => {
    mockPrisma.proposal.findFirst.mockResolvedValue({ id: "proposal-1", status: "draft" });

    const service = new ProposalsService();
    await expect(service.accept("proposal-1", "org-1")).rejects.toThrow("cannot be accepted");
  });

  it("persists a canonical declined status and emits a canonical decline event", async () => {
    mockPrisma.proposal.findFirst
      .mockResolvedValueOnce(proposalRow("sent"))
      .mockResolvedValueOnce(proposalRow("declined"));
    mockPrisma.proposal.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.proposalDelivery.create.mockResolvedValue({});

    const service = new ProposalsService();
    const proposal = await service.reject("proposal-1", "org-1", "owner-1");

    expect(proposal.status).toBe("declined");
    expect(mockPrisma.proposal.updateMany).toHaveBeenCalledWith({
      where: { id: "proposal-1", status: "sent", project: { orgId: "org-1" } },
      data: expect.objectContaining({ status: "declined", respondedAt: expect.any(Date) }),
    });
    expect(mockPrisma.proposalDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "proposal.declined",
          metadataJson: { previousStatus: "sent", newStatus: "declined" },
        }),
      })
    );
  });

  it("keeps historical rejected rows terminal while returning canonical declined", async () => {
    mockPrisma.proposal.findFirst.mockResolvedValue(proposalRow("rejected"));

    const service = new ProposalsService();
    const proposal = await service.markViewed("proposal-1", "org-1");

    expect(proposal.status).toBe("declined");
    expect(mockPrisma.proposal.update).not.toHaveBeenCalled();
  });

  it("fails closed when a competing acceptance wins the conditional transition", async () => {
    mockPrisma.proposal.findFirst.mockResolvedValueOnce(proposalRow("sent"));
    mockPrisma.proposal.updateMany.mockResolvedValue({ count: 0 });

    const service = new ProposalsService();
    await expect(service.accept("proposal-1", "org-1", "owner-1")).rejects.toMatchObject({ statusCode: 409 });
    expect(mockPrisma.proposalDelivery.create).not.toHaveBeenCalled();
    expect(mockPrisma.project.update).not.toHaveBeenCalled();
  });

  it("resends a viewed proposal and stamps a fresh sentAt timestamp", async () => {
    mockPrisma.proposal.findFirst
      .mockResolvedValueOnce({
        id: "proposal-1",
        projectId: "project-1",
        status: "viewed",
        deliveries: [],
        project: { orgId: "org-1", customer: { email: "customer@example.com" } },
      })
      .mockResolvedValueOnce({
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
        paymentScheduleJson: null,
        pdfUrl: null,
        termsAndConditions: null,
        sentAt: new Date(),
        viewedAt: new Date(),
        respondedAt: null,
        createdAt: new Date(),
        deliveries: [],
        project: { orgId: "org-1", customer: { email: "customer@example.com" } },
      });
    mockPrisma.proposal.update.mockResolvedValue({
      id: "proposal-1",
      projectId: "project-1",
      estimateId: "estimate-1",
      status: "sent",
      companyName: null,
      showLineItemDetail: false,
      termsAndConditions: null,
      sentAt: new Date(),
      viewedAt: new Date(),
      respondedAt: null,
      createdAt: new Date(),
      deliveries: [],
    });

    const service = new ProposalsService();
    const proposal = await service.resend("proposal-1", "org-1", "owner-1");

    expect(proposal.status).toBe("sent");
    expect(mockPrisma.proposalDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "proposal.resent",
        }),
      })
    );
    expect(mockPrisma.project.update).toHaveBeenCalledWith({ where: { id: "project-1" }, data: { status: "estimating" } });
  });

  it("duplicates an existing proposal back into draft status", async () => {
    mockPrisma.proposal.findFirst.mockResolvedValue({
      id: "proposal-1",
      projectId: "project-1",
      estimateId: "estimate-1",
      status: "sent",
      companyName: "Acme Co",
      showLineItemDetail: true,
      scopeOfWork: "Scope",
      assumptions: "Assumptions",
      exclusions: "Exclusions",
      timeline: "2 weeks",
      priceLow: 1000,
      priceHigh: 1200,
      finalPrice: 1150,
      paymentScheduleJson: [{ label: "Deposit", amountPercent: 50 }, { label: "Completion", amountPercent: 50 }],
      termsAndConditions: "Terms",
    });
    mockPrisma.proposal.create.mockResolvedValue({
      id: "proposal-2",
      projectId: "project-1",
      estimateId: "estimate-1",
      status: "draft",
      companyName: "Acme Co",
      showLineItemDetail: true,
      scopeOfWork: "Scope",
      assumptions: "Assumptions",
      exclusions: "Exclusions",
      timeline: "2 weeks",
      priceLow: 1000,
      priceHigh: 1200,
      finalPrice: 1150,
      paymentScheduleJson: [{ label: "Deposit", amountPercent: 50 }, { label: "Completion", amountPercent: 50 }],
      pdfUrl: null,
      termsAndConditions: "Terms",
      sentAt: null,
      viewedAt: null,
      respondedAt: null,
      createdAt: new Date(),
      deliveries: [],
    });

    const service = new ProposalsService();
    const proposal = await service.duplicate("proposal-1", "org-1");

    expect(proposal.status).toBe("draft");
    expect(mockPrisma.proposal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project-1",
          estimateId: "estimate-1",
          companyName: "Acme Co",
          scopeOfWork: "Scope",
        }),
      })
    );
  });

  it("generates a PDF using the proposal's stored options", async () => {
    mockPrisma.proposal.findFirst.mockResolvedValue({
      id: "proposal-1",
      estimateId: "estimate-1",
      status: "draft",
      companyName: "Acme Co",
      showLineItemDetail: true,
      termsAndConditions: "Custom terms",
      scopeOfWork: undefined,
      assumptions: undefined,
      exclusions: undefined,
      timeline: undefined,
      priceLow: null,
      priceHigh: null,
      finalPrice: null,
      paymentScheduleJson: undefined,
    });
    mockProposalGenerator.generateProposal.mockResolvedValue({ buffer: Buffer.from("pdf"), filename: "p.pdf", contentType: "application/pdf" });

    const service = new ProposalsService();
    await service.getPdf("proposal-1", "org-1");

    expect(mockProposalGenerator.generateProposal).toHaveBeenCalledWith({
      estimateId: "estimate-1",
      orgId: "org-1",
      companyName: "Acme Co",
      showLineItemDetail: true,
      termsAndConditions: "Custom terms",
      scopeOfWork: undefined,
      assumptions: undefined,
      exclusions: undefined,
      timeline: undefined,
      priceLow: null,
      priceHigh: null,
      finalPrice: null,
      paymentScheduleJson: undefined,
    });
  });

  it("generates a project-first PDF when the proposal has no estimate", async () => {
    mockPrisma.proposal.findFirst.mockResolvedValueOnce({
      id: "proposal-project-1",
      estimateId: null,
      status: "draft",
      companyName: "Acme Co",
      showLineItemDetail: false,
      termsAndConditions: "Custom terms",
    });
    mockProposalGenerator.generateProjectProposal.mockResolvedValue({
      buffer: Buffer.from("pdf"),
      filename: "project-draft.pdf",
      contentType: "application/pdf",
    });

    const service = new ProposalsService();
    await service.getPdf("proposal-project-1", "org-1");

    expect(mockProposalGenerator.generateProjectProposal).toHaveBeenCalledWith({
      proposalId: "proposal-project-1",
      orgId: "org-1",
    });
  });

  it("creates a project-first proposal draft from site visit context", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "project-1",
      name: "Smith Residence Roof Replacement",
      orgId: "org-1",
      jobType: "roofing",
      simpleScope: "Replace existing shingle roof and haul away debris.",
      siteAddress: "123 Main St",
      organization: { name: "Acme Roofing" },
      customer: { name: "Jane Smith" },
      siteVisits: [
        {
          notes: "Visible leak near chimney. Approx 2200 square feet.",
          transcript: null,
          measurementsJson: { squareFeet: 2200 },
        },
      ],
    });
    mockPrisma.proposal.create.mockResolvedValue({
      id: "proposal-2",
      projectId: "project-1",
      estimateId: null,
      status: "draft",
      companyName: "Acme Roofing",
      showLineItemDetail: false,
      scopeOfWork: "draft scope",
      assumptions: "draft assumptions",
      exclusions: "draft exclusions",
      timeline: "draft timeline",
      priceLow: "9900.00",
      priceHigh: "18700.00",
      finalPrice: null,
      paymentScheduleJson: [],
      pdfUrl: null,
      termsAndConditions: null,
      sentAt: null,
      viewedAt: null,
      respondedAt: null,
      createdAt: new Date(),
    });

    const service = new ProposalsService();
    const proposal = await service.create({ orgId: "org-1", projectId: "project-1" });

    expect(proposal.projectId).toBe("project-1");
    expect(proposal.estimateId).toBeNull();
    expect(mockPrisma.project.findFirst).toHaveBeenCalled();
    expect(mockPrisma.project.update).toHaveBeenCalledWith({ where: { id: "project-1" }, data: { status: "estimating" } });
    expect(mockPrisma.proposal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project-1",
          estimateId: null,
          companyName: "Acme Roofing",
        }),
      })
    );
  });

  it("previews a project-first draft with AI context from the latest site visit", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "project-1",
      name: "Smith Residence Roof Replacement",
      orgId: "org-1",
      jobType: "roofing",
      simpleScope: "Replace existing shingle roof and haul away debris.",
      siteAddress: "123 Main St",
      organization: { name: "Acme Roofing" },
      customer: { name: "Jane Smith" },
      siteVisits: [
        {
          notes: "Visible leak near chimney. Approx 2200 square feet.",
          transcript: null,
          measurementsJson: { squareFeet: 2200 },
          confidenceScore: "90",
          missingInfoJson: ["project address"],
          aiQuestionsJson: ["Will tear-off and disposal be included in the base proposal?"],
        },
      ],
    });

    const service = new ProposalsService();
    const preview = await service.previewProjectDraft("project-1", "org-1");

    expect(preview.companyName).toBe("Acme Roofing");
    expect(preview.normalizedJobType).toBe("roofing");
    expect(preview.confidenceScore).toBe(90);
    expect(preview.aiQuestions).toContain("Will tear-off and disposal be included in the base proposal?");
    expect(preview.paymentSchedule).toHaveLength(3);
  });

  it("rejects sending a proposal when the payment schedule does not total 100 percent", async () => {
    mockPrisma.proposal.findFirst.mockResolvedValue({
      id: "proposal-1",
      projectId: "project-1",
      status: "draft",
      paymentScheduleJson: [{ label: "Deposit", amountPercent: 60 }],
    });

    const service = new ProposalsService();
    await expect(service.send("proposal-1", "org-1")).rejects.toThrow("Payment schedule must total 100%");
    expect(mockPrisma.proposal.update).not.toHaveBeenCalled();
  });

  it("uses a valid custom payment schedule when creating a proposal", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "project-1",
      name: "Smith Residence Roof Replacement",
      orgId: "org-1",
      jobType: "roofing",
      simpleScope: "Replace existing shingle roof and haul away debris.",
      siteAddress: "123 Main St",
      organization: { name: "Acme Roofing" },
      customer: { name: "Jane Smith" },
      siteVisits: [],
    });
    mockPrisma.proposal.create.mockResolvedValue({
      id: "proposal-3",
      projectId: "project-1",
      estimateId: null,
      status: "draft",
      companyName: "Acme Roofing",
      showLineItemDetail: false,
      scopeOfWork: "draft scope",
      assumptions: "draft assumptions",
      exclusions: "draft exclusions",
      timeline: "draft timeline",
      priceLow: null,
      priceHigh: null,
      finalPrice: null,
      paymentScheduleJson: [],
      pdfUrl: null,
      termsAndConditions: null,
      sentAt: null,
      viewedAt: null,
      respondedAt: null,
      createdAt: new Date(),
    });

    const service = new ProposalsService();
    await service.create({
      orgId: "org-1",
      projectId: "project-1",
      paymentScheduleJson: [
        { label: "Deposit", amountPercent: 40 },
        { label: "Completion", amountPercent: 60 },
      ],
    });

    expect(mockPrisma.proposal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentScheduleJson: [
            { label: "Deposit", amountPercent: 40 },
            { label: "Completion", amountPercent: 60 },
          ],
        }),
      })
    );
  });
});
