import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireProjectCustomerScope } from "../middleware/projectCustomerScope";

// Mounted immediately before projectsRouter. Only the two project relation
// write shapes pass through this guard; nested project routes keep their
// existing permission and validation behavior.
export const projectCustomerScopeRouter = Router();
projectCustomerScopeRouter.post("/", asyncHandler(requireProjectCustomerScope));
projectCustomerScopeRouter.patch("/:id", asyncHandler(requireProjectCustomerScope));
