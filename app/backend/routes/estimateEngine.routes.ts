import { Router } from "express";
import { estimateEngineController as ctrl } from "../controllers/estimateEngine.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const estimateEngineRouter = Router();

estimateEngineRouter.post("/", asyncHandler(ctrl.create));
estimateEngineRouter.get("/", asyncHandler(ctrl.listOrganizationQueue));
estimateEngineRouter.get("/by-project/:projectId", asyncHandler(ctrl.listByProject));
estimateEngineRouter.get("/:id", asyncHandler(ctrl.getById));
estimateEngineRouter.post("/:id/line-items", asyncHandler(ctrl.addLineItem));
estimateEngineRouter.delete("/:id/line-items/:lineItemId", asyncHandler(ctrl.removeLineItem));
estimateEngineRouter.post("/:id/pricing-mode", asyncHandler(ctrl.setPricingMode));
estimateEngineRouter.post("/:id/finalize", asyncHandler(ctrl.finalize));
estimateEngineRouter.post("/:id/duplicate", asyncHandler(ctrl.duplicate));
