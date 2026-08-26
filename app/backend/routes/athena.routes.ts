import { Router } from "express";
import { athenaApprovalsController } from "../controllers/athenaApprovals.controller";
import { athenaController } from "../controllers/athena.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const athenaRouter = Router();
athenaRouter.post("/chat", asyncHandler(athenaController.chat));
athenaRouter.get("/approvals", asyncHandler(athenaApprovalsController.list));
athenaRouter.get("/approvals/:approvalId", asyncHandler(athenaApprovalsController.get));
athenaRouter.post("/approvals", asyncHandler(athenaApprovalsController.submit));
athenaRouter.post("/approvals/:approvalId/review", asyncHandler(athenaApprovalsController.review));
