import { Router } from "express";
import { customerPortalController as ctrl } from "../controllers/customerPortal.controller";
import { customerPortalDatabaseSession, requireCustomerPortalSession } from "../middleware/customerPortal";
import { requireAuth } from "../middleware/auth";
import { databaseSession } from "../middleware/databaseSession";
import { asyncHandler } from "../middleware/asyncHandler";
import { customerPortalRateLimit } from "../middleware/customerPortalRateLimit";

export const customerPortalRouter = Router();

// Redeem is the only endpoint that accepts the one-time raw magic-link value.
// The browser-facing Next route immediately exchanges it for an HttpOnly
// portal-session cookie.
customerPortalRouter.post("/redeem", customerPortalRateLimit, asyncHandler(ctrl.redeem));

// Staff may issue a customer-scoped link. Delivery remains a separate email
// concern; this endpoint is also useful for controlled staging verification.
customerPortalRouter.post("/access-tokens", requireAuth, databaseSession, asyncHandler(ctrl.issue));
customerPortalRouter.post("/access-tokens/:id/revoke", requireAuth, databaseSession, asyncHandler(ctrl.revoke));

customerPortalRouter.use(requireCustomerPortalSession, customerPortalDatabaseSession);
customerPortalRouter.get("/session", asyncHandler(ctrl.session));
customerPortalRouter.get("/projects", asyncHandler(ctrl.listProjects));
customerPortalRouter.get("/projects/:id", asyncHandler(ctrl.getProject));
customerPortalRouter.get("/proposals/:id", asyncHandler(ctrl.getProposal));
customerPortalRouter.get("/proposals/:id/pdf", asyncHandler(ctrl.getProposalPdf));
customerPortalRouter.get("/invoices/:id", asyncHandler(ctrl.getInvoice));
customerPortalRouter.get("/invoices/:id/pdf", asyncHandler(ctrl.getInvoicePdf));
customerPortalRouter.get("/contracts/:id", asyncHandler(ctrl.getContract));
customerPortalRouter.get("/contracts/:id/pdf", asyncHandler(ctrl.getContractPdf));
customerPortalRouter.post("/contracts/:id/sign", asyncHandler(ctrl.signContract));
