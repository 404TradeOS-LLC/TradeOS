/**
 * Codes jurisdiction / assessment / hints controller tests (issue #946, TODO 4).
 * Mocked-service tests for permission gates, strict queries, fail-closed
 * jurisdiction responses, and the read-only hints path.
 */
const create = jest.fn();
const listForProject = jest.fn();
const listForEstimate = jest.fn();
const signOff = jest.fn();
const getById = jest.fn();

jest.mock("../modules/costbook/codes/assessment", () => ({
  CodesJobAssessmentService: jest.fn().mockImplementation(() => ({ create, listForProject, listForEstimate, signOff })),
}));
jest.mock("../modules/estimate-engine/service", () => ({
  EstimateEngineService: jest.fn().mockImplementation(() => ({ getById })),
}));

const projectFindFirst = jest.fn();
jest.mock("../db/client", () => ({
  prisma: { project: { findFirst: (...args: unknown[]) => projectFindFirst(...args) } },
}));

import { costbookCodesJurisdictionController as ctrl } from "../backend/controllers/costbookCodesJurisdiction.controller";

const ORG = "10000000-0000-0000-0000-000000000001";
const PROJECT = "10000000-0000-4000-8000-000000000081";
const ESTIMATE = "10000000-0000-4000-8000-000000000091";

function responseDouble() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
}

function baseReq(overrides: Record<string, unknown> = {}) {
  return {
    params: {},
    query: {},
    body: {},
    orgId: ORG,
    auth: { userId: "user-1", orgId: ORG, role: "owner" },
    ...overrides,
  } as any;
}

describe("costbookCodesJurisdictionController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    projectFindFirst.mockResolvedValue({ id: PROJECT, siteAddress: "4050 S. State Road 63, Terre Haute, IN 47802" });
  });

  it("resolves jurisdiction fail-closed when no records exist, and never guesses", async () => {
    const res = responseDouble();
    await ctrl.getJurisdiction(
      baseReq({ query: { projectId: PROJECT, state: "IN", county: "Vigo", workType: "sign replacement" } }),
      res,
    );
    const body = res.json.mock.calls[0][0];
    expect(body.projectId).toBe(PROJECT);
    expect(body.outcome).toBe("needs_verification");
    expect(body.matched).toEqual([]);
    expect(body.reasons).toContain("no_reviewed_current_records");
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
    expect(JSON.stringify(body)).not.toMatch(/"setback"|"footingDiameter"|"permitFee"/);
  });

  it("returns 404 for a project outside the caller's org", async () => {
    projectFindFirst.mockResolvedValue(null);
    const res = responseDouble();
    await expect(
      ctrl.getJurisdiction(baseReq({ query: { projectId: PROJECT } }), res),
    ).rejects.toThrow(/not found/);
  });

  it("rejects unknown query keys and non-UUID project ids", async () => {
    const res = responseDouble();
    await expect(
      ctrl.getJurisdiction(baseReq({ query: { projectId: PROJECT, surprise: "1" } }), res),
    ).rejects.toThrow();
    await expect(
      ctrl.getJurisdiction(baseReq({ query: { projectId: "not-a-uuid" } }), res),
    ).rejects.toThrow();
  });

  it("denies jurisdiction reads to roles without costbook.read", async () => {
    const res = responseDouble();
    await expect(
      ctrl.getJurisdiction(
        baseReq({
          query: { projectId: PROJECT },
          auth: { userId: "user-2", orgId: ORG, role: "viewer" },
        }),
        res,
      ),
    ).rejects.toThrow(/do not have permission/);
  });

  it("creates an assessment with 201 and the caller's org and user", async () => {
    create.mockResolvedValue({ id: "assessment-1", status: "needs_review" });
    const res = responseDouble();
    await ctrl.createAssessment(
      baseReq({
        body: {
          projectId: PROJECT,
          estimateId: ESTIMATE,
          workType: "sign replacement",
          citations: [{ source_id: "vigo-zoning-signs", rationale: "County sign rules." }],
          unknowns: ["Confirm the zoning district."],
        },
      }),
      res,
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: ORG, projectId: PROJECT, estimateId: ESTIMATE, createdBy: "user-1" }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("refuses assessment creation with owner_approved in the body", async () => {
    const res = responseDouble();
    await expect(
      ctrl.createAssessment(
        baseReq({
          body: {
            projectId: PROJECT,
            workType: "sign replacement",
            status: "owner_approved",
            citations: [],
            unknowns: [],
          },
        }),
        res,
      ),
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it("requires exactly one of projectId or estimateId when listing assessments", async () => {
    const res = responseDouble();
    await expect(
      ctrl.listAssessments(baseReq({ query: { projectId: PROJECT, estimateId: ESTIMATE } }), res),
    ).rejects.toThrow(/exactly one/);
    await expect(ctrl.listAssessments(baseReq({ query: {} }), res)).rejects.toThrow(/exactly one/);
  });

  it("signs off only for owner/admin roles", async () => {
    signOff.mockResolvedValue({ id: "assessment-1", status: "owner_approved" });
    const res = responseDouble();
    await ctrl.signOffAssessment(
      baseReq({ params: { id: "30000000-0000-0000-0000-000000000001" } }),
      res,
    );
    expect(signOff).toHaveBeenCalledWith("30000000-0000-0000-0000-000000000001", ORG, "user-1");

    await expect(
      ctrl.signOffAssessment(
        baseReq({
          params: { id: "30000000-0000-0000-0000-000000000001" },
          auth: { userId: "user-3", orgId: ORG, role: "technician" },
        }),
        res,
      ),
    ).rejects.toThrow(/do not have permission/);
  });

  it("returns read-only hints with the saved total echoed and financialEffect none", async () => {
    getById.mockResolvedValue({ id: ESTIMATE, projectId: PROJECT, totalPrice: 975 });
    listForEstimate.mockResolvedValue([]);
    listForProject.mockResolvedValue([]);
    const res = responseDouble();
    await ctrl.getEstimateHints(baseReq({ params: { estimateId: ESTIMATE } }), res);
    const body = res.json.mock.calls[0][0];
    expect(body.estimateId).toBe(ESTIMATE);
    expect(body.estimateTotal).toBe(975);
    expect(body.financialEffect).toBe("none");
    expect(body.jurisdiction.outcome).toBe("needs_verification");
    expect(body.hints.join(" ")).toMatch(/Jurisdiction needs verification/);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
  });

  it("returns 404 hints for a foreign estimate", async () => {
    getById.mockRejectedValue(Object.assign(new Error("Estimate not found"), { status: 404 }));
    const res = responseDouble();
    await expect(
      ctrl.getEstimateHints(baseReq({ params: { estimateId: ESTIMATE } }), res),
    ).rejects.toThrow(/not found/);
  });
});
