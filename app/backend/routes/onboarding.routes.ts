import { Router } from "express";
import { onboardingController as ctrl } from "../controllers/onboarding.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const onboardingRouter = Router();

// DES-3 slice 2: persisted onboarding state (one row per organization).
// GET returns { state: OnboardingStateDTO | null } — no row yet is normal.
onboardingRouter.get("/state", asyncHandler(ctrl.getState));
onboardingRouter.patch("/state", asyncHandler(ctrl.saveProgress));
onboardingRouter.post("/skip", asyncHandler(ctrl.skip));
onboardingRouter.post("/complete", asyncHandler(ctrl.complete));
