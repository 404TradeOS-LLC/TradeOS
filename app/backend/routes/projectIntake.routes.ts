import { Router } from "express";
import { projectIntakeController as ctrl } from "../controllers/projectIntake.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const projectIntakeRouter = Router();

projectIntakeRouter.post("/classify", asyncHandler(ctrl.classify));
