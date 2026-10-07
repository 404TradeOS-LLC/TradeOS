import { Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import { logError, logInfo } from "../logging";
import {
  parseSupplierPriceSyncJobSpecs,
  runSupplierPriceSyncJobs,
} from "../../modules/supplier-integration/scheduler";

export interface SupplierPriceSyncCronRouterOptions {
  rateLimitWindowMs?: number;
  rateLimitMax?: number;
}

function createSupplierPriceSyncCronRateLimit(
  options: SupplierPriceSyncCronRouterOptions = {},
) {
  return rateLimit({
    windowMs:
      (options.rateLimitWindowMs ??
        Number(process.env.SUPPLIER_PRICE_SYNC_CRON_RATE_LIMIT_WINDOW_MS)) ||
      15 * 60 * 1000,
    max:
      (options.rateLimitMax ??
        Number(process.env.SUPPLIER_PRICE_SYNC_CRON_RATE_LIMIT_MAX)) ||
      10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({ error: "too_many_supplier_sync_attempts" });
    },
  });
}

function isAuthorizedCronRequest(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;
  return req.get("authorization") === `Bearer ${cronSecret}`;
}

export async function handleSupplierPriceSyncCron(req: Request, res: Response) {
  if (!isAuthorizedCronRequest(req)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  let jobSpecs;
  try {
    jobSpecs = parseSupplierPriceSyncJobSpecs(process.env.SUPPLIER_PRICE_SYNC_JOBS);
  } catch (error) {
    logError("supplier_price_sync.cron_configuration_invalid", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: "supplier_price_sync_configuration_invalid" });
  }

  if (jobSpecs.length === 0) {
    logError("supplier_price_sync.cron_not_configured");
    return res.status(503).json({ error: "supplier_price_sync_not_configured" });
  }

  try {
    const outcomes = await runSupplierPriceSyncJobs(jobSpecs);
    const succeeded = outcomes.filter((outcome) => outcome.status === "succeeded");
    const failed = outcomes.filter((outcome) => outcome.status !== "succeeded");
    const proposed = succeeded.reduce(
      (total, outcome) => total + (outcome.result?.proposed ?? 0),
      0
    );
    const skipped = succeeded.reduce(
      (total, outcome) => total + (outcome.result?.skipped ?? 0),
      0
    );

    if (failed.length > 0) {
      logError("supplier_price_sync.cron_completed_with_failures", {
        jobs: outcomes.length,
        succeeded: succeeded.length,
        failed: failed.length,
        failures: failed.map((outcome) => ({
          label: outcome.spec.label ?? outcome.spec.supplierId,
          status: outcome.status,
          failureCode: outcome.failureCode,
          attempt: outcome.attempt,
          correlationId: outcome.correlationId,
        })),
      });
      return res.status(500).json({
        status: "failed",
        jobs: outcomes.length,
        succeeded: succeeded.length,
        failed: failed.length,
        proposed,
        skipped,
      });
    }

    logInfo("supplier_price_sync.cron_completed", {
      jobs: outcomes.length,
      proposed,
      skipped,
    });
    return res.status(200).json({
      status: "ok",
      jobs: outcomes.length,
      proposed,
      skipped,
    });
  } catch (error) {
    logError("supplier_price_sync.cron_unexpected_failure", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: "supplier_price_sync_failed" });
  }
}

export function createSupplierPriceSyncCronRouter(
  options: SupplierPriceSyncCronRouterOptions = {},
) {
  const router = Router();
  router.get(
    "/supplier-price-sync",
    createSupplierPriceSyncCronRateLimit(options),
    handleSupplierPriceSyncCron,
  );
  return router;
}

export const supplierPriceSyncCronRouter = createSupplierPriceSyncCronRouter();
