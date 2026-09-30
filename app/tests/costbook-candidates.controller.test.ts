const mockService = {
  create: jest.fn(),
  listPage: jest.fn(),
  getById: jest.fn(),
  review: jest.fn(),
  promote: jest.fn(),
  summary: jest.fn(),
  knowledgeCorpusReport: jest.fn(),
  matchPreview: jest.fn(),
  createFromKnowledgeItem: jest.fn(),
};

jest.mock("../modules/costbook/candidateCostItemService", () => ({
  CostbookCandidateService: jest.fn().mockImplementation(() => mockService),
}));

import { costbookCandidatesController } from "../backend/controllers/costbookCandidates.controller";

const CANDIDATE_ID = "11111111-1111-4111-8111-111111111111";
const KNOWLEDGE_ITEM_ID = "22222222-2222-4222-8222-222222222222";

function response() {
  return { json: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() };
}

function authedRequest(options: { role?: string; body?: unknown; params?: Record<string, string>; query?: Record<string, string> } = {}) {
  return {
    body: options.body ?? {},
    params: options.params ?? {},
    query: options.query ?? {},
    orgId: "org-from-auth",
    auth: { userId: "user-1", orgId: "org-from-auth", role: options.role ?? "owner" },
  } as never;
}

describe("costbookCandidatesController authorization", () => {
  beforeEach(() => jest.clearAllMocks());

  // Only owner/admin hold costbook.write and costbook.manage today.
  const readOnlyRoles = ["dispatcher", "technician", "estimator"];

  it.each(readOnlyRoles)("denies %s from ingesting a Knowledge Engine item", async (role) => {
    await expect(
      costbookCandidatesController.ingestFromKnowledge(
        authedRequest({ role, body: { knowledgeItemId: KNOWLEDGE_ITEM_ID } }),
        response() as never
      )
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(mockService.createFromKnowledgeItem).not.toHaveBeenCalled();
  });

  it.each(readOnlyRoles)("denies %s from reviewing a candidate", async (role) => {
    await expect(
      costbookCandidatesController.review(
        authedRequest({ role, params: { id: CANDIDATE_ID }, body: { decision: "approved" } }),
        response() as never
      )
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(mockService.review).not.toHaveBeenCalled();
  });

  it.each(readOnlyRoles)("denies %s from promoting a candidate", async (role) => {
    await expect(
      costbookCandidatesController.promote(
        authedRequest({ role, params: { id: CANDIDATE_ID } }),
        response() as never
      )
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(mockService.promote).not.toHaveBeenCalled();
  });

  it("denies a viewer even read access to the review queue summary", async () => {
    await expect(
      costbookCandidatesController.summary(authedRequest({ role: "viewer" }), response() as never)
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(mockService.summary).not.toHaveBeenCalled();
  });

  it.each(readOnlyRoles)("allows %s to read the queue summary", async (role) => {
    mockService.summary.mockResolvedValue({ pendingReview: 0, total: 0 });

    await costbookCandidatesController.summary(authedRequest({ role }), response() as never);

    expect(mockService.summary).toHaveBeenCalled();
  });

  it.each(readOnlyRoles)("allows %s to read a read-only match preview", async (role) => {
    mockService.matchPreview.mockResolvedValue({ status: "new-candidate", bestMatch: null, comparisons: [], rationale: "" });

    await costbookCandidatesController.match(
      authedRequest({ role, params: { id: CANDIDATE_ID } }),
      response() as never
    );

    expect(mockService.matchPreview).toHaveBeenCalled();
  });
});

describe("costbookCandidatesController organization scoping", () => {
  beforeEach(() => jest.clearAllMocks());

  it("never accepts a caller-supplied organization id when ingesting", async () => {
    await expect(
      costbookCandidatesController.ingestFromKnowledge(
        authedRequest({ role: "owner", body: { knowledgeItemId: KNOWLEDGE_ITEM_ID, orgId: "org-someone-else" } }),
        response() as never
      )
    ).rejects.toThrow();

    expect(mockService.createFromKnowledgeItem).not.toHaveBeenCalled();
  });

  it("passes only the authenticated auth context to the service", async () => {
    mockService.createFromKnowledgeItem.mockResolvedValue({ id: CANDIDATE_ID });

    await costbookCandidatesController.ingestFromKnowledge(
      authedRequest({ role: "owner", body: { knowledgeItemId: KNOWLEDGE_ITEM_ID } }),
      response() as never
    );

    expect(mockService.createFromKnowledgeItem).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org-from-auth", userId: "user-1" }),
      KNOWLEDGE_ITEM_ID
    );
  });

  it("rejects a malformed Knowledge Engine item id at the edge", async () => {
    await expect(
      costbookCandidatesController.ingestFromKnowledge(
        authedRequest({ role: "owner", body: { knowledgeItemId: "not-a-uuid" } }),
        response() as never
      )
    ).rejects.toThrow();

    expect(mockService.createFromKnowledgeItem).not.toHaveBeenCalled();
  });

  it("rejects a review body that tries to smuggle a reviewer identity", async () => {
    await expect(
      costbookCandidatesController.review(
        authedRequest({
          role: "owner",
          params: { id: CANDIDATE_ID },
          body: { decision: "approved", reviewedBy: "AI" },
        }),
        response() as never
      )
    ).rejects.toThrow();

    expect(mockService.review).not.toHaveBeenCalled();
  });

  it("rejects a review decision outside the approved/rejected pair", async () => {
    await expect(
      costbookCandidatesController.review(
        authedRequest({ role: "owner", params: { id: CANDIDATE_ID }, body: { decision: "promoted" } }),
        response() as never
      )
    ).rejects.toThrow();

    expect(mockService.review).not.toHaveBeenCalled();
  });

  it("returns 201 for a successful ingestion", async () => {
    mockService.createFromKnowledgeItem.mockResolvedValue({ id: CANDIDATE_ID });
    const res = response();

    await costbookCandidatesController.ingestFromKnowledge(
      authedRequest({ role: "owner", body: { knowledgeItemId: KNOWLEDGE_ITEM_ID } }),
      res as never
    );

    expect(res.status).toHaveBeenCalledWith(201);
  });
});
