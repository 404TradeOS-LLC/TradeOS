import { Router } from "express";
import { changeOrdersController as ctrl } from "../controllers/changeOrders.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const changeOrdersRouter = Router();

changeOrdersRouter.get("/by-project/:projectId", asyncHandler(ctrl.listByProject));
changeOrdersRouter.get("/:id", asyncHandler(ctrl.getById));
changeOrdersRouter.post("/", asyncHandler(ctrl.create));
changeOrdersRouter.patch("/:id", asyncHandler(ctrl.update));
changeOrdersRouter.post("/:id/line-items", asyncHandler(ctrl.addLineItem));
changeOrdersRouter.delete("/:id/line-items/:lineItemId", asyncHandler(ctrl.removeLineItem));
changeOrdersRouter.delete("/:id", asyncHandler(ctrl.remove));
changeOrdersRouter.post("/:id/approve", asyncHandler(ctrl.approve));
changeOrdersRouter.post("/:id/reject", asyncHandler(ctrl.reject));
