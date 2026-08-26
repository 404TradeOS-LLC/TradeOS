import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { authRateLimit } from "../middleware/authRateLimit";
import { requireAuth } from "../middleware/auth";
import { databaseSession } from "../middleware/databaseSession";

export const authRouter = Router();

authRouter.post("/signup", authRateLimit, asyncHandler(authController.signup));
authRouter.post("/login", authRateLimit, asyncHandler(authController.login));
authRouter.post("/refresh", authRateLimit, asyncHandler(authController.refresh));
authRouter.post("/bootstrap", authRateLimit, asyncHandler(authController.bootstrap));
authRouter.post("/password-reset/request", authRateLimit, asyncHandler(authController.requestPasswordReset));
authRouter.post("/password-reset/confirm", authRateLimit, asyncHandler(authController.resetPassword));
authRouter.post("/logout", authRateLimit, requireAuth, databaseSession, asyncHandler(authController.logout));
authRouter.post("/invites/accept", authRateLimit, asyncHandler(authController.acceptInvite));
