/**
 * Regression coverage for the beta contractor vertical's price/scope transfer
 * contract: estimate -> proposal -> contract. Existing suites
 * (proposals.service.test.ts, contracts.service.test.ts) each verify their
 * own module in isolation with independently authored fixtures; neither
 * proves that a *real* proposal produced by ProposalsService.create() still
 * carries the correct amount and scope once it flows into
 * ContractsService.create(). This file chains the two real service calls so
 * a regression in either module's field mapping fails loudly here even if
 * each module's own isolated fixtures still pass.
 *
 * Known limitation (see PR): Proposal has no subtotal/tax fields in the
 * Prisma schema, so only the single collapsed `finalPrice` transfers from
 * estimate to proposal to contract. Fixing that requires a schema
 * migration, which is out of scope for this change.
 */
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
    findFirst: jest.fn(),
  },
  contract: {
    create: jest.fn(),
    findFirst: jest.fn(),
  },
  contractEvent: {
    create: jest.fn(),
  },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));
jest.mock("../modules/proposal-generator/service", () => ({
  ProposalGeneratorService: jest.fn().mockImplementation(() => ({
    generateProposal: jest.fn(),
    generateProjectProposal: jest.fn(),
  })),
}));
jest.mock("../modules/intelligence/service", () => ({
  ActivityTimelineService: jest.fn().mockImplementation(() => ({
    record: jest.fn().mockResolvedValue(undefined),
  })),
}));
jest.mock("../modules/athena-events/service", () => ({
  getDefaultAthenaEventService: jest.fn(() => ({ publish: jest.fn() })),
}));
jest.mock("../modules/contracts/pdf", () => ({
  renderContractPdf: jest.fn().mockResolvedValue(Buffer.from("pdf")),
}));

import { ProposalsService } from "../modules/proposals/service";
import { ContractsService } from "../modules/contracts/service";

describe("beta contractor vertical: estimate -> proposal -> contract price/scope transfer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("carries a finalized estimate's total price and the proposal's scope through into the contract snapshot", async () => {
    mockPrisma.estimate.findFirst.mockResolvedValue({
      id: "estimate-1",
      projectId: "project-1",
      orgId: "org-1",
      status: "ready",
      totalPrice: 9450.25,
    });
    mockPrisma.proposal.create.mockResolvedValue({
      id: "proposal-1",
      projectId: "project-1",
      estimateId: "estimate-1",
      status: "draft",
      companyName: "Acme Roofing",
      scopeOfWork: "Replace roof decking and shingles",
      assumptions: "Weather permitting",
      exclusions: "Gutter replacement",
      timeline: "2 weeks",
      priceLow: null,
      priceHigh: null,
      finalPrice: 9450.25,
      paymentScheduleJson: [{ label: "Deposit", amountPercent: 50 }],
      termsAndConditions: "Net 30",
      pdfUrl: null,
      sentAt: null,
      viewedAt: null,
      respondedAt: null,
      createdAt: new Date(),
      deliveries: [],
    });

    const proposalsService = new ProposalsService();
    const proposal = await proposalsService.create({ orgId: "org-1", estimateId: "estimate-1" });

    // Assert on the actual write, not just the (independently stubbed)
    // return value: this is what proves ProposalsService itself computed
    // finalPrice from the estimate's total, rather than the mock simply
    // echoing back whatever createFromEstimate happened to be given.
    expect(mockPrisma.proposal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estimateId: "estimate-1", finalPrice: 9450.25 }),
      })
    );

    // The estimate's total price must survive into the proposal unchanged.
    expect(proposal.finalPrice).toBe(9450.25);

    // Now feed that real proposal DTO into contract creation, the way the
    // API does: ContractsService re-reads the accepted proposal by id. Honor
    // where.id here instead of returning the row unconditionally, so this
    // proves ContractsService.create() actually looks up the *created*
    // proposal rather than any id it happens to be passed.
    mockPrisma.proposal.findFirst.mockImplementation(({ where }) => {
      if (where?.id !== proposal.id) return Promise.resolve(null);
      return Promise.resolve({
        id: proposal.id,
        projectId: proposal.projectId,
        status: "accepted",
        finalPrice: proposal.finalPrice,
        companyName: proposal.companyName,
        scopeOfWork: proposal.scopeOfWork,
        assumptions: proposal.assumptions,
        exclusions: proposal.exclusions,
        timeline: proposal.timeline,
        paymentScheduleJson: proposal.paymentScheduleJson,
        termsAndConditions: proposal.termsAndConditions,
        contracts: [],
      });
    });
    mockPrisma.contract.create.mockResolvedValue({
      id: "contract-1",
      projectId: proposal.projectId,
      proposalId: proposal.id,
      status: "pending_signature",
      termsText: proposal.termsAndConditions,
      contractAmount: proposal.finalPrice,
      snapshotJson: {
        proposalId: proposal.id,
        projectId: proposal.projectId,
        contractAmount: proposal.finalPrice,
        companyName: proposal.companyName,
        scopeOfWork: proposal.scopeOfWork,
        assumptions: proposal.assumptions,
        exclusions: proposal.exclusions,
        timeline: proposal.timeline,
        paymentSchedule: proposal.paymentScheduleJson,
        termsText: proposal.termsAndConditions,
      },
      signerName: null,
      signerEmail: null,
      signatureDataUrl: null,
      signatureIpReported: null,
      signatureUserAgentReported: null,
      signedAt: null,
      createdAt: new Date(),
    });
    mockPrisma.contract.findFirst.mockResolvedValue({
      id: "contract-1",
      projectId: proposal.projectId,
      proposalId: proposal.id,
      status: "pending_signature",
      termsText: proposal.termsAndConditions,
      contractAmount: proposal.finalPrice,
      snapshotJson: {
        scopeOfWork: proposal.scopeOfWork,
        assumptions: proposal.assumptions,
        exclusions: proposal.exclusions,
        timeline: proposal.timeline,
        contractAmount: proposal.finalPrice,
      },
      signerName: null,
      signerEmail: null,
      signatureDataUrl: null,
      signatureIpReported: null,
      signatureUserAgentReported: null,
      signedAt: null,
      createdAt: new Date(),
      events: [],
      project: { id: proposal.projectId, name: "Roof replacement" },
    });

    const contractsService = new ContractsService();
    const contract = await contractsService.create({
      orgId: "org-1",
      proposalId: proposal.id,
      actorRole: "owner",
    });

    // Prove the contract was built from the proposal *this call* created,
    // not just any proposal id the findFirst mock would have answered.
    expect(mockPrisma.proposal.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: proposal.id }) })
    );

    // The contract must be created with the accepted proposal's exact final
    // price -- not the estimate's price re-derived independently, and not a
    // priceLow/priceHigh range. Asserted against the actual write, same as
    // above, not the independently stubbed contract.create return value.
    expect(mockPrisma.contract.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contractAmount: 9450.25,
          snapshotJson: expect.objectContaining({
            contractAmount: 9450.25,
            scopeOfWork: "Replace roof decking and shingles",
            assumptions: "Weather permitting",
          }),
        }),
      })
    );
    expect(contract.contractAmount).toBe(proposal.finalPrice);
    expect(contract.contractAmount).toBe(9450.25);

    // Scope of work frozen into the immutable snapshot must be the same
    // scope the beta contractor actually wrote into the proposal, not a
    // regenerated or blank value.
    expect(contract.snapshot?.scopeOfWork).toBe("Replace roof decking and shingles");
  });

  it("refuses to create a contract from a proposal that has no final price yet", async () => {
    mockPrisma.proposal.findFirst.mockResolvedValue({
      id: "proposal-2",
      projectId: "project-1",
      status: "accepted",
      finalPrice: null,
      contracts: [],
    });

    const contractsService = new ContractsService();
    await expect(
      contractsService.create({ orgId: "org-1", proposalId: "proposal-2", actorRole: "owner" })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mockPrisma.contract.create).not.toHaveBeenCalled();
  });

  it("returns 404 and creates no contract when the proposal belongs to a different org", async () => {
    // The real query scopes the lookup through project.orgId (see
    // ContractsService.create); honor that here instead of returning a
    // fixed row regardless of orgId, so this test actually guards tenant
    // isolation rather than always finding the proposal.
    mockPrisma.proposal.findFirst.mockImplementation(({ where }) => {
      if (where?.project?.orgId !== "org-1") return Promise.resolve(null);
      return Promise.resolve({ id: "proposal-3", projectId: "project-1", status: "accepted", finalPrice: 500, contracts: [] });
    });

    const contractsService = new ContractsService();
    await expect(
      contractsService.create({ orgId: "org-2", proposalId: "proposal-3", actorRole: "owner" })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockPrisma.contract.create).not.toHaveBeenCalled();
  });

  it("rejects a role without documents.manage before it ever looks up the proposal or writes a contract", async () => {
    const contractsService = new ContractsService();
    await expect(
      contractsService.create({ orgId: "org-1", proposalId: "proposal-4", actorRole: "technician" })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mockPrisma.proposal.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.contract.create).not.toHaveBeenCalled();
  });
});
