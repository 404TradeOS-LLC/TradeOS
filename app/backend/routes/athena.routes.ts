import { Router } from "express";
import { athenaApprovalsController } from "../controllers/athenaApprovals.controller";
import { athenaController } from "../controllers/athena.controller";
import { asyncHandler } from "../middleware/asyncHandler";

// Fluid PR-4: POST /chat runs outside the request-scoped RLS transaction so
// the Gemini wait holds no pool connection. This router is mounted before
// databaseSession in server.ts (same pattern as the costbook codes-ingestion
// route, issue #946). The controller establishes the validated session actor
// and every Athena persist opens its own short RLS session from it; the
// remaining Athena routes stay behind databaseSession unchanged.
export const athenaChatRouter = Router();
athenaChatRouter.post("/chat", asyncHandler(athenaController.chat));

export const athenaRouter = Router();
athenaRouter.get("/capabilities", asyncHandler(athenaController.capabilities));
athenaRouter.get("/approvals", asyncHandler(athenaApprovalsController.list));
athenaRouter.get("/approvals/:approvalId", asyncHandler(athenaApprovalsController.get));
athenaRouter.post("/approvals", asyncHandler(athenaApprovalsController.submit));
athenaRouter.post("/approvals/:approvalId/review", asyncHandler(athenaApprovalsController.review));
