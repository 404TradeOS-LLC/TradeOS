import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import { expensesController } from "../controllers/expenses.controller";
import { asyncHandler } from "../middleware/asyncHandler";

const uuidPathParam = (_req: Request, _res: Response, next: NextFunction, value: string) => {
  try {
    z.guid().parse(value);
    next();
  } catch (error) {
    next(error);
  }
};

// Mounted at /api/v1/jobs/:jobId/expenses, so mergeParams is required for
// req.params.jobId to survive into this router. Kept separate from
// jobs.routes.ts so job-lifecycle and expense changes never collide in one
// file (see also the in-flight proposal->job handoff work on jobs.routes).
export const expensesRouter = Router({ mergeParams: true });
expensesRouter.param("jobId", uuidPathParam);
expensesRouter.param("expenseId", uuidPathParam);
expensesRouter.get("/", asyncHandler(expensesController.list));
expensesRouter.post("/", asyncHandler(expensesController.create));
expensesRouter.get("/summary", asyncHandler(expensesController.getSummary));
expensesRouter.get("/:expenseId", asyncHandler(expensesController.getById));
expensesRouter.patch("/:expenseId", asyncHandler(expensesController.update));
expensesRouter.delete("/:expenseId", asyncHandler(expensesController.remove));
