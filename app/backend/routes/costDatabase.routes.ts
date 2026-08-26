import { Router } from "express";
import { costDatabaseController as ctrl } from "../controllers/costDatabase.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const costDatabaseRouter = Router();

costDatabaseRouter.get("/divisions", asyncHandler(ctrl.listDivisions));
costDatabaseRouter.post("/divisions", asyncHandler(ctrl.createDivision));
costDatabaseRouter.post("/categories", asyncHandler(ctrl.createCategory));
costDatabaseRouter.post("/subcategories", asyncHandler(ctrl.createSubcategory));
costDatabaseRouter.get("/subcategories/:subcategoryId/cost-items", asyncHandler(ctrl.listSubcategoryCostItems));

costDatabaseRouter.get("/cost-items/search", asyncHandler(ctrl.search));
costDatabaseRouter.get("/cost-items/:id", asyncHandler(ctrl.getById));
costDatabaseRouter.get("/cost-items/:id/unit-cost", asyncHandler(ctrl.getUnitCost));
costDatabaseRouter.post("/cost-items", asyncHandler(ctrl.create));
costDatabaseRouter.patch("/cost-items/:id", asyncHandler(ctrl.update));
costDatabaseRouter.delete("/cost-items/:id", asyncHandler(ctrl.remove));
costDatabaseRouter.post("/cost-items/bulk-import", asyncHandler(ctrl.bulkImport));
