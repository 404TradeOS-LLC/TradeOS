import { Router } from "express";
import { materialDatabaseController as ctrl } from "../controllers/materialDatabase.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const materialDatabaseRouter = Router();

materialDatabaseRouter.get("/stale", asyncHandler(ctrl.stale));
materialDatabaseRouter.get("/", asyncHandler(ctrl.list));
materialDatabaseRouter.get("/:id", asyncHandler(ctrl.getById));
materialDatabaseRouter.post("/", asyncHandler(ctrl.create));
materialDatabaseRouter.patch("/:id", asyncHandler(ctrl.update));
materialDatabaseRouter.delete("/:id", asyncHandler(ctrl.remove));
materialDatabaseRouter.post("/calculate", asyncHandler(ctrl.calculate));
materialDatabaseRouter.post("/bulk-import", asyncHandler(ctrl.bulkImport));
