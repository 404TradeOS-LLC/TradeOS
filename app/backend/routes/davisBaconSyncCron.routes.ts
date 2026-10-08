/**
 * Vercel Cron route: Davis-Bacon prevailing-wage sync.
 *
 * GET /api/cron/davis-bacon-sync — authorized by the shared CRON_SECRET
 * bearer (constant-time comparison, same pattern as the supplier-price cron).
 * Reads DAVIS_BACON_SYNC_JOBS (JSON array of { orgId, userId, state, county,
 * label? }) and runs the hardened key-free SAM.gov sync per job inside a
 * background database session (RLS-scoped to the job's org).
 *
 * This route intentionally shares CRON_SECRET with the other cron routes:
 * one secret, one Vercel Cron configuration surface.
 */
import { createHash, timingSafeEqual } from "crypto";
import { Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import { logError, logInfo } from "../logging";
import { runWithBackgroundDatabaseSession } from "../../db/requestSession";
import { prisma } from "../../db/client";
import { DavisBaconClient } from "../../modules/costbook/davisBaconSamGov";
import {
  parseDavisBaconSyncJobSpecs,
  syncCountyWageDeterminations,
} from "../../modules/costbook/davisBaconSync";
import { prismaDavisBaconStore } from "../../modules/costbook/davisBaconStore";

export function isAuthorizedCronRequest(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;
  const expected = createHash("sha256").update(`Bearer ${cronSecret}`, "utf8").digest();
  const received = createHash("sha256").update(req.get("authorization") ?? "", "utf8").digest();
  return timingSafeEqual(received, expected);
}

function requireAuthorizedCronRequest(req: Request, res: Response, next: () => void): void {
  if (!isAuthorizedCronRequest(req)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

const davisBaconCronRateLimit = rateLimit({
  windowMs: Number(process.env.DAVIS_BACON_CRON_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.DAVIS_BACON_CRON_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: "too_many_davis_bacon_sync_attempts" });
  },
});

export async function handleDavisBaconSyncCron(_req: Request, res: Response): Promise<void> {
  let jobSpecs;
  try {
    jobSpecs = parseDavisBaconSyncJobSpecs(process.env.DAVIS_BACON_SYNC_JOBS);
  } catch (error) {
    logError("davis_bacon_sync.cron_configuration_invalid", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "davis_bacon_sync_configuration_invalid" });
    return;
  }

  if (jobSpecs.length === 0) {
    logError("davis_bacon_sync.cron_not_configured");
    res.status(503).json({ error: "davis_bacon_sync_not_configured" });
    return;
  }

  const client = new DavisBaconClient();
  const reports = [];
  let failedJobs = 0;

  for (const spec of jobSpecs) {
    try {
      const report = await runWithBackgroundDatabaseSession(
        prisma,
        { jobName: "davis-bacon-sync", orgId: spec.orgId, userId: spec.userId },
        async () =>
          syncCountyWageDeterminations(spec, { client, store: prismaDavisBaconStore }),
      );
      reports.push({ status: "succeeded" as const, report });
    } catch (error) {
      failedJobs += 1;
      const message = error instanceof Error ? error.message : String(error);
      logError("davis_bacon_sync.cron_job_failed", {
        orgId: spec.orgId,
        state: spec.state,
        county: spec.county,
        error: message,
      });
      reports.push({
        status: "failed" as const,
        orgId: spec.orgId,
        state: spec.state,
        county: spec.county,
        error: message,
      });
    }
  }

  const totals = reports.reduce(
    (acc, r) => {
      if (r.status === "succeeded") {
        acc.checked += r.report.checked;
        acc.added += r.report.added;
        acc.updated += r.report.updated;
        acc.unchanged += r.report.unchanged;
        acc.failedDeterminations += r.report.failed.length;
      }
      return acc;
    },
    { checked: 0, added: 0, updated: 0, unchanged: 0, failedDeterminations: 0 },
  );

  if (failedJobs > 0) {
    logError("davis_bacon_sync.cron_completed_with_failures", {
      jobs: reports.length,
      failedJobs,
      ...totals,
    });
    res.status(500).json({ status: "failed", jobs: reports.length, failedJobs, ...totals, reports });
    return;
  }

  logInfo("davis_bacon_sync.cron_completed", { jobs: reports.length, ...totals });
  res.status(200).json({ status: "ok", jobs: reports.length, ...totals, reports });
}

export function createDavisBaconSyncCronRouter(): Router {
  const router = Router();
  router.get(
    "/davis-bacon-sync",
    davisBaconCronRateLimit,
    requireAuthorizedCronRequest,
    (req: Request, res: Response) => {
      void handleDavisBaconSyncCron(req, res);
    },
  );
  return router;
}

export const davisBaconSyncCronRouter = createDavisBaconSyncCronRouter();
