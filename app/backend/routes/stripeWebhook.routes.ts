import { Router } from "express";
import { billingController as ctrl } from "../controllers/billing.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const stripeWebhookRouter = Router();

stripeWebhookRouter.post("/", asyncHandler(ctrl.webhook));
