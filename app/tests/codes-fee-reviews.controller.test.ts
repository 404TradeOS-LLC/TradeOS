const list = jest.fn();
const get = jest.fn();
const create = jest.fn();
const review = jest.fn();
const selectCostItem = jest.fn();
const remove = jest.fn();

jest.mock("../modules/costbook/codes/feeReviews.service", () => ({
  CodesFeeReviewsService: jest.fn().mockImplementation(() => ({ list, get, create, review, selectCostItem, remove })),
}));

import { codesFeeReviewsController } from "../backend/controllers/costbookCodesFeeReviews.controller";

const ORG = "org-1";
const PROJECT = "10000000-0000-0000-0000-000000000081";
const FEE = "20000000-0000-0000-0000-000000000002";
const COST_ITEM = "10000000-0000-0000-0000-000000000061";

function responseDouble() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

function baseReq(overrides: Record<string, unknown> = {}) {
  return {
    params: { feeReviewId: FEE },
    query: { projectId: PROJECT },
    orgId: ORG,
    auth: { userId: "user-1", orgId: ORG, role: "owner" },
    ...overrides,
  } as any;
}

describe("codesFeeReviewsController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists fee reviews for the requested project", async () => {
    list.mockResolvedValue([]);
    const res = responseDouble();
    await codesFeeReviewsController.list(baseReq(), res);
    expect(list).toHaveBeenCalledWith(ORG, PROJECT);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it("rejects listing without a projectId", async () => {
    await expect(codesFeeReviewsController.list(baseReq({ query: {} }), responseDouble())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("creates a pending fee review and never accepts a costItemId at creation", async () => {
    create.mockResolvedValue({ id: FEE, status: "pending", costItemId: null });
    const res = responseDouble();
    await codesFeeReviewsController.create(
      baseReq({ body: { projectId: PROJECT, feeCents: 12500, feeSource: "quoted" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: ORG, feeCents: 12500, feeSource: "quoted" }),
    );
    // Unknown keys (including any costItemId smuggled into create) fail validation.
    await expect(
      codesFeeReviewsController.create(
        baseReq({ body: { projectId: PROJECT, feeCents: 12500, feeSource: "quoted", costItemId: COST_ITEM } }),
        responseDouble(),
      ),
    ).rejects.toThrow();
  });

  it("rejects negative fees and unknown fee sources at the controller boundary", async () => {
    await expect(
      codesFeeReviewsController.create(baseReq({ body: { projectId: PROJECT, feeCents: -5, feeSource: "quoted" } }), responseDouble()),
    ).rejects.toThrow();
    await expect(
      codesFeeReviewsController.create(baseReq({ body: { projectId: PROJECT, feeCents: 100, feeSource: "guessed" } }), responseDouble()),
    ).rejects.toThrow();
  });

  it("passes review decisions and explicit CostItem selection through", async () => {
    review.mockResolvedValue({ id: FEE, status: "approved" });
    const res = responseDouble();
    await codesFeeReviewsController.review(
      baseReq({ body: { expectedUpdatedAt: "2026-11-09T12:00:00.000Z", decision: "approved" } }),
      res,
    );
    expect(review).toHaveBeenCalledWith(
      expect.objectContaining({ feeReviewId: FEE, decision: "approved" }),
    );

    selectCostItem.mockResolvedValue({ id: FEE, status: "approved", costItemId: COST_ITEM });
    await codesFeeReviewsController.selectCostItem(
      baseReq({ body: { expectedUpdatedAt: "2026-11-09T12:00:00.000Z", costItemId: COST_ITEM } }),
      res,
    );
    expect(selectCostItem).toHaveBeenCalledWith(
      expect.objectContaining({ feeReviewId: FEE, costItemId: COST_ITEM }),
    );
  });
});
