import { Router } from "express";
import { laborDatabaseController as ctrl } from "../controllers/laborDatabase.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const laborDatabaseRouter = Router();

laborDatabaseRouter.get("/", asyncHandler(ctrl.list));
laborDatabaseRouter.get("/:id", asyncHandler(ctrl.getById));
laborDatabaseRouter.post("/", asyncHandler(ctrl.create));
laborDatabaseRouter.patch("/:id", asyncHandler(ctrl.update));
laborDatabaseRouter.delete("/:id", asyncHandler(ctrl.remove));
laborDatabaseRouter.post("/calculate", asyncHandler(ctrl.calculate));
