import { Router } from "express";
import rateLimit from "express-rate-limit";
import { supplierIntegrationController as ctrl } from "../controllers/supplierIntegration.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const supplierIntegrationRouter = Router();

// Requires the authenticated /api/v1 tenant database session and costbook.manage.
supplierIntegrationRouter.post("/abc/oauth/authorize", asyncHandler(ctrl.initiateAbcOAuth));
supplierIntegrationRouter.post("/abc/price-probe", asyncHandler(ctrl.probeAbcSandbox));
supplierIntegrationRouter.get("/queue", asyncHandler(ctrl.listQueue));
supplierIntegrationRouter.post("/queue", asyncHandler(ctrl.enqueue));
supplierIntegrationRouter.post("/queue/:id/approve", asyncHandler(ctrl.approve));
supplierIntegrationRouter.post("/queue/:id/reject", asyncHandler(ctrl.reject));

/**
 * Unauthenticated ABC OAuth callback. Mounted in server.ts BEFORE the
 * /api/v1 requireAuth/databaseSession middleware: ABC redirects the
 * founder's browser here without a JWT, so the single-use state token is
 * the credential. Rate-limited as defense in depth; state guessing is
 * infeasible (256-bit random, 10-minute TTL, consumed exactly once).
 */
export const abcOAuthCallbackRouter = Router();

abcOAuthCallbackRouter.get(
  "/abc/oauth/callback",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: "too_many_abc_oauth_callback_attempts" });
    },
  }),
  asyncHandler(ctrl.handleAbcOAuthCallback),
);
