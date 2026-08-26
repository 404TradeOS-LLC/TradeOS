import { Router } from "express";
import { contractsController as ctrl } from "../controllers/contracts.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const contractsRouter = Router();

contractsRouter.get("/by-project/:projectId", asyncHandler(ctrl.listByProject));
contractsRouter.post("/", asyncHandler(ctrl.create));
contractsRouter.get("/:id", asyncHandler(ctrl.getById));
contractsRouter.get("/:id/pdf", asyncHandler(ctrl.getPdf));
contractsRouter.post("/:id/sign", asyncHandler(ctrl.sign));
contractsRouter.post("/:id/void", asyncHandler(ctrl.void));
