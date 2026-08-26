import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { aiEstimateRateLimit } from "../middleware/aiEstimateRateLimit";
import { aiEstimateAssistController as ctrl } from "../controllers/aiEstimateAssist.controller";

export const aiEstimateAssistRouter = Router();

aiEstimateAssistRouter.post("/:id/ai-suggestions", asyncHandler(ctrl.generate));
aiEstimateAssistRouter.post("/:id/ai-suggestions/apply", asyncHandler(ctrl.apply));
aiEstimateAssistRouter.post("/:id/ai-estimator/draft", aiEstimateRateLimit, asyncHandler(ctrl.draftStructuredEstimate));
aiEstimateAssistRouter.post("/:id/ai-estimator/apply", aiEstimateRateLimit, asyncHandler(ctrl.applyStructuredEstimate));
