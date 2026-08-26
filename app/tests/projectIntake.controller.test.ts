import { Request, Response } from "express";
import { projectIntakeController } from "../backend/controllers/projectIntake.controller";

function mockReqRes(body: unknown) {
  const req = { body } as unknown as Request;
  const res = { json: jest.fn() } as unknown as Response;
  return { req, res };
}

describe("projectIntakeController.classify", () => {
  it("returns a full IntakeResult for a valid scope", async () => {
    const { req, res } = mockReqRes({ scope: "Build a 16x20 treated deck with stairs." });

    await projectIntakeController.classify(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        trade: "Deck",
        projectType: "Outdoor Structure",
        category: "Exterior Improvements",
        missingInformation: expect.any(Array),
        followUpQuestions: expect.any(Array),
        confidenceScore: expect.objectContaining({ score: expect.any(Number), level: expect.any(String) }),
        proposalDraft: expect.objectContaining({ scopeOfWork: expect.any(String) }),
      })
    );
  });

  it("returns a null-trade result for an unrecognized scope rather than erroring", async () => {
    const { req, res } = mockReqRes({ scope: "Need someone to take a look at some general property work." });

    await projectIntakeController.classify(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ trade: null, projectType: "General Contracting" }));
  });

  it("rejects a missing scope field", async () => {
    const { req, res } = mockReqRes({});
    await expect(projectIntakeController.classify(req, res)).rejects.toThrow();
  });

  it("rejects an empty-string scope", async () => {
    const { req, res } = mockReqRes({ scope: "" });
    await expect(projectIntakeController.classify(req, res)).rejects.toThrow();
  });

  it("rejects a whitespace-only scope", async () => {
    const { req, res } = mockReqRes({ scope: "   " });
    await expect(projectIntakeController.classify(req, res)).rejects.toThrow();
  });

  it("rejects a non-string scope", async () => {
    const { req, res } = mockReqRes({ scope: 42 });
    await expect(projectIntakeController.classify(req, res)).rejects.toThrow();
  });
});
