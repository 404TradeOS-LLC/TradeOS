const mockPrisma = {
  project: { findFirst: jest.fn() },
  estimate: { findFirst: jest.fn(), update: jest.fn() },
  costItem: { findFirst: jest.fn() },
  codesFeeReview: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { CodesFeeReviewsService, mayAffectEstimate } from "../modules/costbook/codes/feeReviews.service";

const ORG = "10000000-0000-0000-0000-000000000001";
const PROJECT = "10000000-0000-0000-0000-000000000081";
const ESTIMATE = "10000000-0000-0000-0000-000000000091";
const OWNER = "10000000-0000-0000-0000-000000000011";
const TECH = "10000000-0000-0000-0000-000000000014";
const COST_ITEM = "10000000-0000-0000-0000-000000000061";
const REVISION = new Date("2026-11-09T12:00:00.000Z");

function feeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "fee-1",
    orgId: ORG,
    projectId: PROJECT,
    estimateId: ESTIMATE,
    assessmentId: null,
    feeCents: 12500,
    feeSource: "quoted",
    currency: "USD",
    status: "pending",
    costItemId: null,
    note: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date("2026-11-09T12:00:00.000Z"),
    updatedAt: REVISION,
    ...overrides,
  };
}

describe("CodesFeeReviewsService (price-neutral by construction)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.project.findFirst.mockResolvedValue({ id: PROJECT, orgId: ORG });
    mockPrisma.estimate.findFirst.mockResolvedValue({ id: ESTIMATE, orgId: ORG, projectId: PROJECT });
  });

  it("creates a pending fee review with no CostItem and no estimate effect", async () => {
    mockPrisma.codesFeeReview.create.mockResolvedValue(feeRow());
    const service = new CodesFeeReviewsService();
    const review = await service.create({
      orgId: ORG, role: "owner", actorId: OWNER, projectId: PROJECT,
      estimateId: ESTIMATE, feeCents: 12500, feeSource: "quoted",
    });
    expect(review.status).toBe("pending");
    expect(review.costItemId).toBeNull();
    expect(review.mayAffectEstimate).toBe(false);
    expect(mockPrisma.codesFeeReview.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "pending", costItemId: null }) }),
    );
    // The fee-review service never writes to an estimate.
    expect(mockPrisma.estimate.update).not.toHaveBeenCalled();
  });

  it("rejects negative fees, unknown fee sources, and estimates outside the project", async () => {
    const service = new CodesFeeReviewsService();
    await expect(
      service.create({ orgId: ORG, role: "owner", actorId: OWNER, projectId: PROJECT, feeCents: -1, feeSource: "quoted" }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      service.create({ orgId: ORG, role: "owner", actorId: OWNER, projectId: PROJECT, feeCents: 100, feeSource: "guessed" as never }),
    ).rejects.toMatchObject({ statusCode: 400 });
    mockPrisma.estimate.findFirst.mockResolvedValue(null);
    await expect(
      service.create({ orgId: ORG, role: "owner", actorId: OWNER, projectId: PROJECT, estimateId: ESTIMATE, feeCents: 100, feeSource: "verified" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("refuses fee-review creation and review by technicians", async () => {
    const service = new CodesFeeReviewsService();
    await expect(
      service.create({ orgId: ORG, role: "technician", actorId: TECH, projectId: PROJECT, feeCents: 100, feeSource: "quoted" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    mockPrisma.codesFeeReview.findFirst.mockResolvedValue(feeRow());
    await expect(
      service.review({ orgId: ORG, role: "technician", actorId: TECH, feeReviewId: "fee-1", expectedUpdatedAt: REVISION, decision: "approved" }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mockPrisma.codesFeeReview.update).not.toHaveBeenCalled();
  });

  it("approving a fee without a selected CostItem is still a financial no-op", async () => {
    mockPrisma.codesFeeReview.findFirst.mockResolvedValue(feeRow());
    mockPrisma.codesFeeReview.update.mockResolvedValue(
      feeRow({ status: "approved", reviewedBy: OWNER, reviewedAt: new Date("2026-11-09T12:00:01.000Z"), updatedAt: new Date("2026-11-09T12:00:01.000Z") }),
    );
    const service = new CodesFeeReviewsService();
    const approved = await service.review({
      orgId: ORG, role: "owner", actorId: OWNER, feeReviewId: "fee-1", expectedUpdatedAt: REVISION, decision: "approved",
    });
    expect(approved.status).toBe("approved");
    expect(approved.mayAffectEstimate).toBe(false);
    expect(mockPrisma.estimate.update).not.toHaveBeenCalled();
  });

  it("rejecting a fee is a financial no-op, and only pending fees can be reviewed", async () => {
    mockPrisma.codesFeeReview.findFirst.mockResolvedValue(feeRow({ status: "approved" }));
    const service = new CodesFeeReviewsService();
    await expect(
      service.review({ orgId: ORG, role: "owner", actorId: OWNER, feeReviewId: "fee-1", expectedUpdatedAt: REVISION, decision: "rejected" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    mockPrisma.codesFeeReview.findFirst.mockResolvedValue(feeRow());
    mockPrisma.codesFeeReview.update.mockResolvedValue(
      feeRow({ status: "rejected", reviewedBy: OWNER, reviewedAt: new Date("2026-11-09T12:00:01.000Z"), updatedAt: new Date("2026-11-09T12:00:01.000Z") }),
    );
    const rejected = await service.review({
      orgId: ORG, role: "owner", actorId: OWNER, feeReviewId: "fee-1", expectedUpdatedAt: REVISION, decision: "rejected",
    });
    expect(rejected.status).toBe("rejected");
    expect(rejected.mayAffectEstimate).toBe(false);
    expect(mockPrisma.estimate.update).not.toHaveBeenCalled();
  });

  it("selecting a CostItem requires an approved fee and an in-org CostItem, and still writes no estimate", async () => {
    const service = new CodesFeeReviewsService();
    mockPrisma.codesFeeReview.findFirst.mockResolvedValue(feeRow());
    await expect(
      service.selectCostItem({ orgId: ORG, role: "owner", actorId: OWNER, feeReviewId: "fee-1", expectedUpdatedAt: REVISION, costItemId: COST_ITEM }),
    ).rejects.toMatchObject({ statusCode: 409 });

    mockPrisma.codesFeeReview.findFirst.mockResolvedValue(feeRow({ status: "approved" }));
    mockPrisma.costItem.findFirst.mockResolvedValue(null);
    await expect(
      service.selectCostItem({ orgId: ORG, role: "owner", actorId: OWNER, feeReviewId: "fee-1", expectedUpdatedAt: REVISION, costItemId: COST_ITEM }),
    ).rejects.toMatchObject({ statusCode: 404 });

    mockPrisma.costItem.findFirst.mockResolvedValue({ id: COST_ITEM, orgId: ORG });
    mockPrisma.codesFeeReview.update.mockResolvedValue(
      feeRow({ status: "approved", costItemId: COST_ITEM, updatedAt: new Date("2026-11-09T12:00:01.000Z") }),
    );
    const selected = await service.selectCostItem({
      orgId: ORG, role: "owner", actorId: OWNER, feeReviewId: "fee-1", expectedUpdatedAt: REVISION, costItemId: COST_ITEM,
    });
    expect(selected.costItemId).toBe(COST_ITEM);
    expect(selected.mayAffectEstimate).toBe(true);
    // Even here: the flag is advisory. The service performed no estimate write.
    expect(mockPrisma.estimate.update).not.toHaveBeenCalled();
  });

  it("mayAffectEstimate is true only for approved + explicitly selected", () => {
    expect(mayAffectEstimate("pending", COST_ITEM)).toBe(false);
    expect(mayAffectEstimate("rejected", COST_ITEM)).toBe(false);
    expect(mayAffectEstimate("approved", null)).toBe(false);
    expect(mayAffectEstimate("approved", COST_ITEM)).toBe(true);
  });

  it("rejects stale revisions with 409", async () => {
    mockPrisma.codesFeeReview.findFirst.mockResolvedValue(feeRow());
    const service = new CodesFeeReviewsService();
    await expect(
      service.review({ orgId: ORG, role: "owner", actorId: OWNER, feeReviewId: "fee-1", expectedUpdatedAt: new Date("2026-11-08T00:00:00.000Z"), decision: "approved" }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
