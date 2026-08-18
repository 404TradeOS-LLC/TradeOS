import { Router } from "express";
import { invoicesController as ctrl } from "../controllers/invoices.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const invoicesRouter = Router();

invoicesRouter.get("/", asyncHandler(ctrl.listOrganizationQueue));
invoicesRouter.get("/by-project/:projectId", asyncHandler(ctrl.listByProject));
invoicesRouter.post("/", asyncHandler(ctrl.create));
invoicesRouter.get("/:id", asyncHandler(ctrl.getById));
invoicesRouter.get("/:id/pdf", asyncHandler(ctrl.getPdf));
invoicesRouter.post("/:id/send", asyncHandler(ctrl.send));
invoicesRouter.post("/:id/mark-paid", asyncHandler(ctrl.markPaid));
invoicesRouter.post("/:id/void", asyncHandler(ctrl.void));
