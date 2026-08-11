import { Router } from "express";
import { costbookController as ctrl } from "../controllers/costbook.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const costbookRouter = Router();

costbookRouter.get("/workspace", asyncHandler(ctrl.workspace));
costbookRouter.get("/materials", asyncHandler(ctrl.listMaterials));
costbookRouter.get("/materials/:id", asyncHandler(ctrl.getMaterial));
costbookRouter.post("/materials", asyncHandler(ctrl.createMaterial));
costbookRouter.patch("/materials/:id", asyncHandler(ctrl.updateMaterial));
