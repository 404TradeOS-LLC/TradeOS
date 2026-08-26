import { Router } from "express";
import { proposalGeneratorController as ctrl } from "../controllers/proposalGenerator.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const proposalGeneratorRouter = Router();

// Ad-hoc, non-persisted PDF preview straight from an estimate (no Proposal
// row created). Lives under /preview to avoid colliding with the persisted
// Proposal resource's own /:id routes mounted at the same /api/v1/proposals
// prefix (see proposals.routes.ts).
proposalGeneratorRouter.post("/preview/:id", asyncHandler(ctrl.generate));
