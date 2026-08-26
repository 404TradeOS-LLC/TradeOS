import { Router } from "express";
import { equipmentDatabaseController as ctrl } from "../controllers/equipmentDatabase.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const equipmentDatabaseRouter = Router();

equipmentDatabaseRouter.get("/", asyncHandler(ctrl.list));
equipmentDatabaseRouter.get("/:id", asyncHandler(ctrl.getById));
equipmentDatabaseRouter.post("/", asyncHandler(ctrl.create));
equipmentDatabaseRouter.patch("/:id", asyncHandler(ctrl.update));
equipmentDatabaseRouter.delete("/:id", asyncHandler(ctrl.remove));
equipmentDatabaseRouter.post("/calculate", asyncHandler(ctrl.calculate));
