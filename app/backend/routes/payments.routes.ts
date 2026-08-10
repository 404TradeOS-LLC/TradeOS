import { Router } from "express";
import { paymentsLedgerController as ctrl } from "../controllers/payments.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const paymentsRouter = Router();

paymentsRouter.get("/current-week", asyncHandler(ctrl.currentWeek));
