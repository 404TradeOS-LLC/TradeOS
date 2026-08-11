import { Router } from "express";
import { costbookController as ctrl } from "../controllers/costbook.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const costbookRouter = Router();

costbookRouter.get("/workspace", asyncHandler(ctrl.workspace));
costbookRouter.get("/labor-rates", asyncHandler(ctrl.listLaborRates));
costbookRouter.get("/labor-rates/:id", asyncHandler(ctrl.getLaborRate));
costbookRouter.post("/labor-rates", asyncHandler(ctrl.createLaborRate));
costbookRouter.patch("/labor-rates/:id", asyncHandler(ctrl.updateLaborRate));
costbookRouter.delete("/labor-rates/:id", asyncHandler(ctrl.removeLaborRate));
costbookRouter.get("/materials", asyncHandler(ctrl.listMaterials));
costbookRouter.get("/materials/:id", asyncHandler(ctrl.getMaterial));
costbookRouter.post("/materials", asyncHandler(ctrl.createMaterial));
costbookRouter.patch("/materials/:id", asyncHandler(ctrl.updateMaterial));
