import { Router } from "express";
import { supplierDatabaseController as ctrl } from "../controllers/supplierDatabase.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const supplierDatabaseRouter = Router();

supplierDatabaseRouter.get("/", asyncHandler(ctrl.list));
supplierDatabaseRouter.get("/:id", asyncHandler(ctrl.getById));
supplierDatabaseRouter.post("/", asyncHandler(ctrl.create));
supplierDatabaseRouter.patch("/:id", asyncHandler(ctrl.update));
supplierDatabaseRouter.delete("/:id", asyncHandler(ctrl.remove));
