const mockPrisma = {
  proposal: {
    findFirst: jest.fn(),
  },
  contract: {
    create: jest.fn(),
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

describe("ContractsService duplicate proposal protection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects creating a second contract for the same accepted proposal", async () => {
    mockPrisma.proposal.findFirst.mockResolvedValue({
      id: "proposal-1",
      projectId: "project-1",
      status: "accepted",
      finalPrice: 8500,
      contracts: [{ id: "contract-existing" }],
    });

    const service = new ContractsService();

    await expect(
      service.create({ orgId: "org-1", actorUserId: "user-1", actorRole: "admin", proposalId: "proposal-1" })
    ).rejects.toThrow("already has contract contract-existing");

    expect(mockPrisma.proposal.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "proposal-1", project: { orgId: "org-1" } },
        include: { contracts: { select: { id: true }, take: 1 } },
      })
    );
    expect(mockPrisma.contract.create).not.toHaveBeenCalled();
    expect(mockPrisma.contractEvent.create).not.toHaveBeenCalled();
  });
});
