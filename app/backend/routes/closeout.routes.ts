import { Router } from "express";
import { closeoutController as ctrl } from "../controllers/closeout.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const closeoutRouter = Router();

// Project closeout (one row per project; created at field completion).
closeoutRouter.post("/projects/:projectId/closeout", asyncHandler(ctrl.createCloseout));
closeoutRouter.get("/projects/:projectId/closeout", asyncHandler(ctrl.getCloseout));
closeoutRouter.post("/projects/:projectId/closeout/ready", asyncHandler(ctrl.markReady));
closeoutRouter.post("/projects/:projectId/closeout/handoff", asyncHandler(ctrl.markHandedOff));
closeoutRouter.get("/projects/:projectId/closeout/document", asyncHandler(ctrl.getDocument));

// Punch items (the project's explicit unresolved-items list).
closeoutRouter.post("/projects/:projectId/punch-items", asyncHandler(ctrl.createPunchItem));
closeoutRouter.get("/projects/:projectId/punch-items", asyncHandler(ctrl.listPunchItems));
closeoutRouter.get("/punch-items/:id", asyncHandler(ctrl.getPunchItem));
closeoutRouter.patch("/punch-items/:id", asyncHandler(ctrl.updatePunchItem));
closeoutRouter.post("/punch-items/:id/resolve", asyncHandler(ctrl.resolvePunchItem));
closeoutRouter.post("/punch-items/:id/verify", asyncHandler(ctrl.verifyPunchItem));
closeoutRouter.post("/punch-items/:id/reopen", asyncHandler(ctrl.reopenPunchItem));

// Warranty records (only warranties the contractor actually gave).
closeoutRouter.post("/projects/:projectId/warranties", asyncHandler(ctrl.createWarranty));
closeoutRouter.get("/projects/:projectId/warranties", asyncHandler(ctrl.listWarranties));
closeoutRouter.get("/warranties/:id", asyncHandler(ctrl.getWarranty));
closeoutRouter.patch("/warranties/:id", asyncHandler(ctrl.updateWarranty));
closeoutRouter.delete("/warranties/:id", asyncHandler(ctrl.deleteWarranty));
