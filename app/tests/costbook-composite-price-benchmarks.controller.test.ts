import type { NextFunction, Request, Response } from "express";
import { costbookCompositeBenchmarksController } from "../backend/controllers/costbookCompositeBenchmarks.controller";
import { errorHandler } from "../backend/middleware/errorHandler";

function createResponseCapture() {
  const capture = { statusCode: 200, body: undefined as unknown };
  const res = {
    locals: {},
    status(code: number) {
      capture.statusCode = code;
      return this;
    },
    json(body: unknown) {
      capture.body = body;
      return this;
    },
  } as unknown as Response;
  return { res, capture };
}

async function runThroughErrorHandler(req: Request, res: Response): Promise<void> {
  try {
    await costbookCompositeBenchmarksController.importRows(req, res);
  } catch (error) {
    errorHandler(error, req, res, (() => undefined) as NextFunction);
  }
}

describe("Costbook composite benchmark controller contract", () => {
  it("returns the standard 403 envelope when a caller lacks costbook.manage", async () => {
    const req = {
      method: "POST",
      path: "/api/v1/costbook/benchmarks/composite/import",
      body: { rows: [{}] },
      auth: {
        userId: "61000000-0000-0000-0000-000000000011",
        orgId: "61000000-0000-0000-0000-000000000001",
        role: "viewer",
      },
    } as unknown as Request;
    const { res, capture } = createResponseCapture();

    await runThroughErrorHandler(req, res);

    expect(capture.statusCode).toBe(403);
    expect(capture.body).toEqual({ error: "You do not have permission to perform this action" });
  });

  it("returns the standard 400 validation envelope for a malformed bulk payload", async () => {
    const req = {
      method: "POST",
      path: "/api/v1/costbook/benchmarks/composite/import",
      body: { rows: [] },
      auth: {
        userId: "61000000-0000-0000-0000-000000000012",
        orgId: "61000000-0000-0000-0000-000000000001",
        role: "owner",
      },
    } as unknown as Request;
    const { res, capture } = createResponseCapture();

    await runThroughErrorHandler(req, res);

    expect(capture.statusCode).toBe(400);
    expect(capture.body).toMatchObject({ error: "Validation failed" });
    expect((capture.body as { details?: unknown[] }).details).toEqual(expect.any(Array));
  });
});
