import { Router } from "express";
import { cronController as ctrl } from "../controllers/cron.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const cronRouter = Router();

// Vercel Cron invokes this path with GET and an
// `Authorization: Bearer <CRON_SECRET>` header. Mounted outside the
// authenticated /api/v1 chain on purpose — the cron secret is the credential.
cronRouter.get("/supplier-price-sync", asyncHandler(ctrl.runSupplierPriceSync));
