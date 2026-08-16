import { Router } from "express";
import { assembliesDatabaseController as ctrl } from "../controllers/assembliesDatabase.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const assembliesDatabaseRouter = Router();

assembliesDatabaseRouter.get("/search", asyncHandler(ctrl.search));
assembliesDatabaseRouter.get("/templates", asyncHandler(ctrl.templates));
assembliesDatabaseRouter.get("/", asyncHandler(ctrl.list));
assembliesDatabaseRouter.get("/:id/unit-cost", asyncHandler(ctrl.getUnitCost));
assembliesDatabaseRouter.get("/:id/items", asyncHandler(ctrl.listItems));
assembliesDatabaseRouter.get("/:id", asyncHandler(ctrl.getById));
assembliesDatabaseRouter.post("/", asyncHandler(ctrl.create));
assembliesDatabaseRouter.patch("/:id", asyncHandler(ctrl.update));
assembliesDatabaseRouter.delete("/:id", asyncHandler(ctrl.remove));
assembliesDatabaseRouter.post("/:id/items", asyncHandler(ctrl.addItem));
assembliesDatabaseRouter.delete("/:id/items/:itemId", asyncHandler(ctrl.removeItem));
