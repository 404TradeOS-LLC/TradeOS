import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { authRateLimit } from "../middleware/authRateLimit";
import { membershipsRateLimit } from "../middleware/membershipsRateLimit";
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
// Workspace switching deliberately runs WITHOUT databaseSession: the
// service methods open their own transactions (listMemberships /
// selectOrganization / issueSession each call basePrisma.$transaction
// directly), and databaseSession would hold the pooler's single
// connection (connection_limit=1) for the whole request, so the nested
// acquisition would time out and the shell would hide the switcher.
// The methods are self-contained — they set their own login_lookup /
// user_id / org_id flags inside their transactions, exactly like
// login / refresh / bootstrap, which also run without databaseSession.
// Do not add databaseSession here; use runInDatabaseTransaction if
// these methods ever need to share a request transaction.
authRouter.get("/memberships", requireAuth, membershipsRateLimit, asyncHandler(authController.listMemberships));
authRouter.post("/select-organization", authRateLimit, requireAuth, asyncHandler(authController.selectOrganization));
authRouter.post("/invites/accept", authRateLimit, asyncHandler(authController.acceptInvite));
