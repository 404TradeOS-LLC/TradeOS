import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const accountRouter = Router();

accountRouter.post("/invites", asyncHandler(authController.invite));
accountRouter.get("/2fa", asyncHandler(authController.totpStatus));
