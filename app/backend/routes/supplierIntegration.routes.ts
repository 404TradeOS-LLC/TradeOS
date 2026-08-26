import { Router } from "express";
import { supplierIntegrationController as ctrl } from "../controllers/supplierIntegration.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const supplierIntegrationRouter = Router();

supplierIntegrationRouter.get("/queue", asyncHandler(ctrl.listQueue));
supplierIntegrationRouter.post("/queue", asyncHandler(ctrl.enqueue));
supplierIntegrationRouter.post("/queue/:id/approve", asyncHandler(ctrl.approve));
supplierIntegrationRouter.post("/queue/:id/reject", asyncHandler(ctrl.reject));
