import { Router } from "express";
import { costbookController as ctrl } from "../controllers/costbook.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const costbookRouter = Router();

costbookRouter.get("/workspace", asyncHandler(ctrl.workspace));
