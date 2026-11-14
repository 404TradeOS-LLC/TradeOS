import { Router } from "express";
import { invoicesController as ctrl } from "../controllers/invoices.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const invoicesRouter = Router();
export const recoverableInvoiceCreateRouter = Router();

// This router runs after requireAuth and before the generic response-bound DB session.
recoverableInvoiceCreateRouter.post("/drafts", asyncHandler(ctrl.createRecoverable));
recoverableInvoiceCreateRouter.post("/", (req, res, next) => {
  if (req.headers["idempotency-key"] === undefined) return next();
  return asyncHandler(ctrl.createRecoverable)(req, res, next);
});

invoicesRouter.get("/", asyncHandler(ctrl.listOrganizationQueue));
invoicesRouter.get("/by-project/:projectId", asyncHandler(ctrl.listByProject));
invoicesRouter.post("/", asyncHandler(ctrl.create));
invoicesRouter.get("/:id", asyncHandler(ctrl.getById));
invoicesRouter.patch("/:id", asyncHandler(ctrl.update));
invoicesRouter.get("/:id/pdf", asyncHandler(ctrl.getPdf));
invoicesRouter.post("/:id/send", asyncHandler(ctrl.send));
invoicesRouter.post("/:id/mark-paid", asyncHandler(ctrl.markPaid));
invoicesRouter.post("/:id/void", asyncHandler(ctrl.void));
