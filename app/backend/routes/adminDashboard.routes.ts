import { Router } from "express";
import { adminDashboardController as ctrl } from "../controllers/adminDashboard.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const adminDashboardRouter = Router();

adminDashboardRouter.get("/organizations/:id", asyncHandler(ctrl.getOrganization));
adminDashboardRouter.patch("/organizations/:id", asyncHandler(ctrl.updateOrganization));
adminDashboardRouter.get("/organizations/:id/pricing-update-summary", asyncHandler(ctrl.pricingUpdateSummary));
adminDashboardRouter.get("/organizations/:id/pricing-history", asyncHandler(ctrl.materialPriceHistory));
adminDashboardRouter.get("/organizations/:id/members", asyncHandler(ctrl.listMembers));
adminDashboardRouter.get("/organizations/:id/members/:membershipId/history", asyncHandler(ctrl.listMemberHistory));
adminDashboardRouter.post("/organizations/:id/members", asyncHandler(ctrl.upsertMember));
adminDashboardRouter.patch("/organizations/:id/members/:membershipId", asyncHandler(ctrl.updateMember));
adminDashboardRouter.delete("/organizations/:id/members/:membershipId", asyncHandler(ctrl.removeMember));
