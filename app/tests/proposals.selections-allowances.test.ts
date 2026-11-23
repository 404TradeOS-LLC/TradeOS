const mockPrisma = {
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
  proposalSelection: {
    create: jest.fn(),
    createMany: jest.fn(),
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  proposalAllowance: {
    create: jest.fn(),
    createMany: jest.fn(),
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  proposalDelivery: {
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

import { ProposalsService } from "../modules/proposals/service";

function selectionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "selection-1",
    orgId: "org-1",
    proposalId: "proposal-1",
    label: "PENDANTS",
    detail: null,
    status: "action_required",
    dueDate: new Date("2026-10-09T00:00:00.000Z"),
    sortOrder: 0,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    ...overrides,
  };
}

function allowanceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "allowance-1",
    orgId: "org-1",
    proposalId: "proposal-1",
    description: "PENDANT LIGHTING",
    amount: 1200,
    sortOrder: 0,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    ...overrides,
  };
}

function proposalRow(status: string, overrides: Record<string, unknown> = {}) {
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
    finalPrice: 42680,
    paymentScheduleJson: null,
    pdfUrl: null,
    termsAndConditions: null,
    sentAt: null,
    viewedAt: null,
    respondedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deliveries: [],
    selections: [],
    allowances: [],
    project: { orgId: "org-1", customer: { id: "customer-1", email: "customer@example.com" } },
    contracts: [],
    ...overrides,
  };
}

describe("ProposalsService selections and allowances (DES-10-F8)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns selections and allowances on getById with the display-only allowances total", async () => {
    mockPrisma.proposal.findFirst.mockResolvedValue(
      proposalRow("draft", {
        selections: [
          selectionRow({ id: "selection-1", label: "CABINET FINISH", detail: "Rift white oak · clear matte", status: "confirmed", dueDate: null }),
          selectionRow({ id: "selection-2", label: "PENDANTS", detail: null, status: "action_required", dueDate: new Date("2026-10-09T00:00:00.000Z") }),
        ],
        allowances: [
          allowanceRow({ id: "allowance-1", description: "PENDANT LIGHTING", amount: 1200 }),
          allowanceRow({ id: "allowance-2", description: "CABINET HARDWARE", amount: 1600 }),
        ],
      })
    );

    const dto = await new ProposalsService().getById("proposal-1", "org-1");

    expect(dto.selections).toHaveLength(2);
    expect(dto.selections[0]).toMatchObject({ label: "CABINET FINISH", status: "confirmed", dueDate: null });
    expect(dto.selections[1]).toMatchObject({ label: "PENDANTS", status: "action_required", dueDate: "2026-10-09T00:00:00.000Z" });
    expect(dto.allowancesTotal).toBe(2800);
    // The allowances total is display-only: it never rewrites the proposal price.
    expect(dto.finalPrice).toBe(42680);
  });

  it("creates a selection with the org from the owning proposal and action_required by default", async () => {
    mockPrisma.proposal.findFirst.mockResolvedValue(proposalRow("draft"));
    mockPrisma.proposalSelection.count.mockResolvedValue(2);
    mockPrisma.proposalSelection.create.mockResolvedValue(
      selectionRow({ label: "PENDANTS", detail: null, status: "action_required", sortOrder: 2 })
    );

    const created = await new ProposalsService().createSelection(
      "proposal-1",
      { label: "PENDANTS", dueDate: "2026-10-09T00:00:00.000Z" },
      "org-1"
    );

    expect(mockPrisma.proposalSelection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orgId: "org-1",
          proposalId: "proposal-1",
          label: "PENDANTS",
          status: "action_required",
          sortOrder: 2,
        }),
      })
    );
    expect(created.status).toBe("action_required");
  });

  it("rejects a selection with an empty label or an unknown status", async () => {
    mockPrisma.proposal.findFirst.mockResolvedValue(proposalRow("draft"));

    const service = new ProposalsService();
    await expect(service.createSelection("proposal-1", { label: "  " }, "org-1")).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      service.createSelection("proposal-1", { label: "PENDANTS", status: "decided" as never }, "org-1")
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockPrisma.proposalSelection.create).not.toHaveBeenCalled();
  });

  it("rejects selection writes on an accepted proposal and on a foreign proposal", async () => {
    mockPrisma.proposal.findFirst
      .mockResolvedValueOnce(proposalRow("accepted"))
      .mockResolvedValueOnce(null);

    const service = new ProposalsService();
    await expect(service.createSelection("proposal-1", { label: "PENDANTS" }, "org-1")).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.createSelection("proposal-1", { label: "PENDANTS" }, "org-2")).rejects.toMatchObject({ statusCode: 404 });
    expect(mockPrisma.proposalSelection.create).not.toHaveBeenCalled();
  });

  it("updates a selection through the guarded write and distinguishes a missing row from an immutable proposal", async () => {
    mockPrisma.proposalSelection.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.proposalSelection.findFirstOrThrow.mockResolvedValue(
      selectionRow({ label: "PENDANTS", detail: "Brass dome", status: "confirmed", dueDate: null })
    );

    const updated = await new ProposalsService().updateSelection(
      "selection-1",
      "proposal-1",
      { detail: "Brass dome", status: "confirmed", dueDate: null },
      "org-1"
    );
    expect(updated).toMatchObject({ detail: "Brass dome", status: "confirmed" });
    expect(mockPrisma.proposalSelection.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "selection-1",
          proposal: expect.objectContaining({ id: "proposal-1", status: { not: "accepted" }, contracts: { none: {} } }),
        }),
      })
    );

    mockPrisma.proposalSelection.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.proposalSelection.findFirst.mockResolvedValue(null);
    await expect(
      new ProposalsService().updateSelection("selection-missing", "proposal-1", { detail: "x" }, "org-1")
    ).rejects.toMatchObject({ statusCode: 404 });

    mockPrisma.proposalSelection.findFirst.mockResolvedValue({
      ...selectionRow(),
      proposal: { ...proposalRow("accepted"), contracts: [{ id: "contract-1" }] },
    });
    await expect(
      new ProposalsService().updateSelection("selection-1", "proposal-1", { detail: "x" }, "org-1")
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("deletes a selection through the guarded write", async () => {
    mockPrisma.proposalSelection.deleteMany.mockResolvedValue({ count: 1 });

    await new ProposalsService().deleteSelection("selection-1", "proposal-1", "org-1");
    expect(mockPrisma.proposalSelection.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "selection-1",
          proposal: expect.objectContaining({ id: "proposal-1", status: { not: "accepted" } }),
        }),
      })
    );
  });

  it("creates an allowance with the org from the owning proposal and rejects a negative amount", async () => {
    mockPrisma.proposal.findFirst.mockResolvedValue(proposalRow("draft"));
    mockPrisma.proposalAllowance.count.mockResolvedValue(0);
    mockPrisma.proposalAllowance.create.mockResolvedValue(allowanceRow());

    const created = await new ProposalsService().createAllowance(
      "proposal-1",
      { description: "PENDANT LIGHTING", amount: 1200 },
      "org-1"
    );
    expect(mockPrisma.proposalAllowance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: "org-1", proposalId: "proposal-1", description: "PENDANT LIGHTING", amount: 1200 }),
      })
    );
    expect(created.amount).toBe(1200);

    await expect(
      new ProposalsService().createAllowance("proposal-1", { description: "PENDANT LIGHTING", amount: -5 }, "org-1")
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockPrisma.proposalAllowance.create).toHaveBeenCalledTimes(1);
  });

  it("updates and deletes an allowance through the guarded writes", async () => {
    mockPrisma.proposalAllowance.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.proposalAllowance.findFirstOrThrow.mockResolvedValue(allowanceRow({ amount: 1350 }));
    mockPrisma.proposalAllowance.deleteMany.mockResolvedValue({ count: 1 });

    const service = new ProposalsService();
    const updated = await service.updateAllowance("allowance-1", "proposal-1", { amount: 1350 }, "org-1");
    expect(updated.amount).toBe(1350);
    await service.deleteAllowance("allowance-1", "proposal-1", "org-1");
    expect(mockPrisma.proposalAllowance.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "allowance-1",
          proposal: expect.objectContaining({ id: "proposal-1", status: { not: "accepted" } }),
        }),
      })
    );
  });

  it("duplicating a proposal carries its selections and allowances to the copy", async () => {
    mockPrisma.proposal.findFirst.mockResolvedValue(
      proposalRow("draft", {
        selections: [selectionRow()],
        allowances: [allowanceRow()],
      })
    );
    mockPrisma.proposal.create.mockResolvedValue({ ...proposalRow("draft"), id: "proposal-2" });
    mockPrisma.proposalSelection.findMany.mockResolvedValue([selectionRow()]);
    mockPrisma.proposalAllowance.findMany.mockResolvedValue([allowanceRow()]);
    mockPrisma.proposalSelection.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.proposalAllowance.createMany.mockResolvedValue({ count: 1 });

    const duplicated = await new ProposalsService().duplicate("proposal-1", "org-1");

    expect(duplicated.id).toBe("proposal-2");
    expect(mockPrisma.proposalSelection.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ proposalId: "proposal-2", label: "PENDANTS", orgId: "org-1" })],
      })
    );
    expect(mockPrisma.proposalAllowance.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ proposalId: "proposal-2", description: "PENDANT LIGHTING", amount: 1200 })],
      })
    );
  });
});
