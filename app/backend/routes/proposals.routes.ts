import { Router } from "express";
import { proposalsController as ctrl } from "../controllers/proposals.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const proposalsRouter = Router();

proposalsRouter.get("/", asyncHandler(ctrl.listOrganizationQueue));
proposalsRouter.get("/by-project/:projectId", asyncHandler(ctrl.listByProject));
proposalsRouter.get("/project-draft/:projectId", asyncHandler(ctrl.previewProjectDraft));
proposalsRouter.post("/", asyncHandler(ctrl.create));
proposalsRouter.get("/:id", asyncHandler(ctrl.getById));
proposalsRouter.patch("/:id", asyncHandler(ctrl.update));
proposalsRouter.get("/:id/pdf", asyncHandler(ctrl.getPdf));
proposalsRouter.post("/:id/send", asyncHandler(ctrl.send));
proposalsRouter.post("/:id/resend", asyncHandler(ctrl.resend));
proposalsRouter.post("/:id/mark-viewed", asyncHandler(ctrl.markViewed));
proposalsRouter.post("/:id/accept", asyncHandler(ctrl.accept));
proposalsRouter.post("/:id/reject", asyncHandler(ctrl.reject));
proposalsRouter.post("/:id/duplicate", asyncHandler(ctrl.duplicate));
