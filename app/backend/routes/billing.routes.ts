import { Router } from "express";
import { billingController as ctrl } from "../controllers/billing.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const billingRouter = Router();

billingRouter.get("/", asyncHandler(ctrl.summary));
billingRouter.post("/checkout", asyncHandler(ctrl.checkout));
billingRouter.post("/portal", asyncHandler(ctrl.portal));
