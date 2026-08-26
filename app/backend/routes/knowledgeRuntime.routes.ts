import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { knowledgeRuntimeController as ctrl } from "../controllers/knowledgeRuntime.controller";

export const knowledgeRuntimeRouter = Router();

knowledgeRuntimeRouter.get("/stats", asyncHandler(ctrl.stats));
knowledgeRuntimeRouter.get("/trades", asyncHandler(ctrl.trades));
knowledgeRuntimeRouter.get("/search", asyncHandler(ctrl.search));
knowledgeRuntimeRouter.post("/match", asyncHandler(ctrl.match));

// Compatibility aliases for the first runtime wiring pass.
knowledgeRuntimeRouter.get("/assemblies/search", asyncHandler(ctrl.searchAssemblies));
knowledgeRuntimeRouter.get("/cost-items/search", asyncHandler(ctrl.searchCostItems));
knowledgeRuntimeRouter.post("/match-scope", asyncHandler(ctrl.matchScope));
