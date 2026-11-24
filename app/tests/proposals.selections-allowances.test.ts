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
    aggregate: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  proposalAllowance: {
    create: jest.fn(),
    createMany: jest.fn(),
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  proposalDelivery: {
    create: jest.fn(),
  },
  // Transaction/lock wiring: the service runs child mutations through
  // runInDatabaseTransaction and locks the parent proposal row with
  // SELECT ... FOR UPDATE. The mock transaction invokes the callback with
  // the same mock client, mirroring the request-scoped transaction routing.
  $transaction: jest.fn(),
  $queryRaw: jest.fn().mockResolvedValue([]),
};

mockPrisma.$transaction.mockImplementation(async (operation: (client: typeof mockPrisma) => Promise<unknown>) =>
  operation(mockPrisma)
);

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
    mockPrisma.proposalSelection.aggregate.mockResolvedValue({ _max: { sortOrder: 1 } });
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

  it("allocates sortOrder after the highest surviving row, not the row count", async () => {
    // Rows 0,1,2,3 existed; rows 1 and 2 were deleted. A count-based
    // allocation would reuse slot 2 and land before the surviving row 3.
    mockPrisma.proposal.findFirst.mockResolvedValue(proposalRow("draft"));
    mockPrisma.proposalSelection.aggregate.mockResolvedValue({ _max: { sortOrder: 3 } });
    mockPrisma.proposalSelection.create.mockResolvedValue(selectionRow({ label: "FAUCETS", sortOrder: 4 }));

    const created = await new ProposalsService().createSelection("proposal-1", { label: "FAUCETS" }, "org-1");

    expect(mockPrisma.proposalSelection.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sortOrder: 4 }) })
    );
    expect(created.sortOrder).toBe(4);

    mockPrisma.proposalAllowance.aggregate.mockResolvedValue({ _max: { sortOrder: 3 } });
    mockPrisma.proposalAllowance.create.mockResolvedValue(allowanceRow({ description: "FAUCETS", sortOrder: 4 }));
    const allowance = await new ProposalsService().createAllowance(
      "proposal-1",
      { description: "FAUCETS", amount: 900 },
      "org-1"
    );
    expect(mockPrisma.proposalAllowance.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sortOrder: 4 }) })
    );
    expect(allowance.sortOrder).toBe(4);
  });

  it("locks the parent proposal inside one transaction before any child write, so acceptance cannot commit mid-mutation", async () => {
    mockPrisma.proposal.findFirst.mockResolvedValue(proposalRow("draft"));
    mockPrisma.proposalSelection.aggregate.mockResolvedValue({ _max: { sortOrder: null } });
    mockPrisma.proposalSelection.create.mockResolvedValue(selectionRow());
    mockPrisma.proposalAllowance.aggregate.mockResolvedValue({ _max: { sortOrder: null } });
    mockPrisma.proposalAllowance.create.mockResolvedValue(allowanceRow());
    mockPrisma.proposalSelection.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.proposalSelection.findFirstOrThrow.mockResolvedValue(selectionRow({ detail: "Brass dome" }));

    const service = new ProposalsService();
    await service.createSelection("proposal-1", { label: "PENDANTS" }, "org-1");
    await service.createAllowance("proposal-1", { description: "PENDANT LIGHTING", amount: 1200 }, "org-1");
    await service.updateSelection("selection-1", "proposal-1", { detail: "Brass dome" }, "org-1");

    // Every child mutation takes the same parent row lock inside the same
    // transaction as its write: acceptance's conditional update on the
    // proposal row blocks on that lock, and a committed acceptance is seen
    // by the re-check instead of raced past.
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(3);
    for (const call of mockPrisma.$queryRaw.mock.calls) {
      expect(JSON.stringify(call[0])).toContain("FOR UPDATE");
    }
    const lockOrder = mockPrisma.$queryRaw.mock.invocationCallOrder;
    expect(lockOrder[0]).toBeLessThan(mockPrisma.proposalSelection.create.mock.invocationCallOrder[0]);
    expect(lockOrder[1]).toBeLessThan(mockPrisma.proposalAllowance.create.mock.invocationCallOrder[0]);
    expect(lockOrder[2]).toBeLessThan(mockPrisma.proposalSelection.updateMany.mock.invocationCallOrder[0]);
  });

  it("every child mutation advances the parent proposal revision", async () => {
    mockPrisma.proposal.findFirst.mockResolvedValue(proposalRow("draft"));
    mockPrisma.proposalSelection.aggregate.mockResolvedValue({ _max: { sortOrder: null } });
    mockPrisma.proposalSelection.create.mockResolvedValue(selectionRow());
    mockPrisma.proposalSelection.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.proposalSelection.findFirstOrThrow.mockResolvedValue(selectionRow({ detail: "Brass dome" }));
    mockPrisma.proposalSelection.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.proposalAllowance.aggregate.mockResolvedValue({ _max: { sortOrder: null } });
    mockPrisma.proposalAllowance.create.mockResolvedValue(allowanceRow());
    mockPrisma.proposalAllowance.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.proposalAllowance.findFirstOrThrow.mockResolvedValue(allowanceRow({ amount: 1350 }));
    mockPrisma.proposalAllowance.deleteMany.mockResolvedValue({ count: 1 });

    const service = new ProposalsService();
    await service.createSelection("proposal-1", { label: "PENDANTS" }, "org-1");
    await service.updateSelection("selection-1", "proposal-1", { detail: "Brass dome" }, "org-1");
    await service.deleteSelection("selection-1", "proposal-1", "org-1");
    await service.createAllowance("proposal-1", { description: "PENDANT LIGHTING", amount: 1200 }, "org-1");
    await service.updateAllowance("allowance-1", "proposal-1", { amount: 1350 }, "org-1");
    await service.deleteAllowance("allowance-1", "proposal-1", "org-1");

    // A customer holding the approval page rendered before any of these
    // changes must see a 409 on accept: the parent's updatedAt is the
    // revision the portal binds the answer to.
    expect(mockPrisma.proposal.update).toHaveBeenCalledTimes(6);
    for (const call of mockPrisma.proposal.update.mock.calls) {
      expect(call[0]).toEqual({
        where: { id: "proposal-1" },
        data: { updatedAt: expect.any(Date) },
      });
    }
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
    mockPrisma.proposalAllowance.aggregate.mockResolvedValue({ _max: { sortOrder: null } });
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
    mockPrisma.proposal.findFirst
      .mockResolvedValueOnce(
        proposalRow("draft", {
          selections: [selectionRow()],
          allowances: [allowanceRow()],
        })
      )
      // The duplicate reloads the copy after copying the children: the
      // bare create result carries no relations, so without the reload
      // the returned DTO would report empty selections and a zero total.
      .mockResolvedValueOnce(
        proposalRow("draft", {
          id: "proposal-2",
          selections: [selectionRow({ proposalId: "proposal-2" })],
          allowances: [allowanceRow({ proposalId: "proposal-2" })],
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
    expect(duplicated.selections).toHaveLength(1);
    expect(duplicated.selections[0]).toMatchObject({ label: "PENDANTS" });
    expect(duplicated.allowances).toHaveLength(1);
    expect(duplicated.allowancesTotal).toBe(1200);
  });
});
