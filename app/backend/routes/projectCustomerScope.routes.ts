import { NextFunction, Request, Response, Router } from "express";
import { requireProjectCustomerScope } from "../middleware/projectCustomerScope";

// Mounted immediately before projectsRouter. Only the two project relation
// write shapes pass through this guard; nested project routes keep their
// existing permission and validation behavior.
export const projectCustomerScopeRouter = Router();

function projectCustomerScopeHandler(req: Request, res: Response, next: NextFunction): void {
  requireProjectCustomerScope(req, res, next).catch(next);
}

projectCustomerScopeRouter.post("/", projectCustomerScopeHandler);
projectCustomerScopeRouter.patch("/:id", projectCustomerScopeHandler);
