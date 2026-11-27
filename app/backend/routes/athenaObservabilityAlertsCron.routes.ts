/**
 * Vercel Cron route: Athena observability alert evaluation + email delivery.
 *
 * GET /api/cron/athena-observability-alerts — authorized by the shared
 * CRON_SECRET bearer (constant-time comparison, imported from the
 * Davis-Bacon cron route; one secret, one Vercel Cron configuration
 * surface). Reads ATHENA_OBSERVABILITY_MAINTENANCE_JOBS (comma-separated
 * "orgId:userId" pairs) and, per job, evaluates every alert rule, applies
 * the results to athena_alerts, and emails newly-firing (brand-new or
 * reactivated) and newly-resolved alerts to ATHENA_ALERT_EMAIL_RECIPIENT
 * via Resend. The same pipeline runs outside the API runtime from
 * app/scripts/run-athena-observability-alerts.ts.
 *
 * A failed email send never fails the run: the athena_alerts row is the
 * durable record, so delivery failures are reported per alert in the
 * response and logged, while only a hard per-job error (evaluation or
 * apply throwing) returns 500. While ATHENA_ALERT_EMAIL_RECIPIENT is
 * unset, evaluation still runs and delivery is skipped with a warning.
 *
 * Cadence: the rules evaluate a trailing 15-minute window, so the intended
 * schedule is every 15 minutes. The Vercel Hobby plan only accepts daily
 * cron expressions (a sub-daily expression fails the deployment), so
 * app/vercel.json currently schedules this route once daily; tighten it to
 * a 15-minute schedule when the team moves to Pro. Until then the route is also
 * invocable on demand with the CRON_SECRET bearer.
 */
import { NextFunction, Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import { logError, logInfo, logWarn } from "../logging";
import { parseMaintenanceJobSpecs } from "../../modules/athena-observability/maintenanceJobs";
import { runAthenaAlertJobs } from "../../modules/athena-observability/alertRunner";
import { isAuthorizedCronRequest } from "./davisBaconSyncCron.routes";

function requireAuthorizedCronRequest(req: Request, res: Response, next: NextFunction): void {
  if (!isAuthorizedCronRequest(req)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

const athenaAlertsCronRateLimit = rateLimit({
  windowMs: Number(process.env.ATHENA_OBSERVABILITY_ALERTS_CRON_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.ATHENA_OBSERVABILITY_ALERTS_CRON_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: "too_many_athena_alerts_attempts" });
  },
});

export async function handleAthenaObservabilityAlertsCron(_req: Request, res: Response): Promise<void> {
  let jobSpecs;
  try {
    jobSpecs = parseMaintenanceJobSpecs(process.env.ATHENA_OBSERVABILITY_MAINTENANCE_JOBS);
  } catch (error) {
    logError("athena_observability_alerts.cron_configuration_invalid", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "athena_observability_alerts_configuration_invalid" });
    return;
  }

  if (jobSpecs.length === 0) {
    logError("athena_observability_alerts.cron_not_configured");
    res.status(503).json({ error: "athena_observability_alerts_not_configured" });
    return;
  }

  const run = await runAthenaAlertJobs(jobSpecs);
  const failedJobs = run.jobs.filter((job) => job.error);
  const emailed = run.jobs.reduce((total, job) => total + job.emailed, 0);
  const emailFailures = run.jobs.flatMap((job) =>
    job.emailFailures.map((failure) => ({ orgId: job.orgId, ...failure })),
  );
  const alerts = run.jobs.flatMap((job) =>
    job.applied.map((alert) => ({
      orgId: job.orgId,
      ruleId: alert.ruleId,
      dedupeKey: alert.dedupeKey,
      status: alert.status,
      severity: alert.severity,
    })),
  );

  if (!run.recipient) {
    logWarn("athena_observability_alerts.cron_recipient_not_configured");
  }
  if (emailFailures.length > 0) {
    logError("athena_observability_alerts.cron_email_delivery_failed", {
      failures: emailFailures,
    });
  }

  if (failedJobs.length > 0) {
    logError("athena_observability_alerts.cron_completed_with_failures", {
      jobs: run.jobs.length,
      failedJobs: failedJobs.length,
      emailed,
      emailFailures: emailFailures.length,
      failures: failedJobs.map((job) => ({ orgId: job.orgId, error: job.error })),
    });
    res.status(500).json({
      status: "failed",
      jobs: run.jobs.length,
      failedJobs: failedJobs.length,
      emailed,
      emailFailures,
      alerts,
    });
    return;
  }

  logInfo("athena_observability_alerts.cron_completed", {
    jobs: run.jobs.length,
    emailed,
    emailFailures: emailFailures.length,
  });
  res.status(200).json({
    status: "ok",
    jobs: run.jobs.length,
    emailed,
    emailFailures,
    alerts,
  });
}

export function createAthenaObservabilityAlertsCronRouter(): Router {
  const router = Router();
  router.get(
    "/athena-observability-alerts",
    athenaAlertsCronRateLimit,
    requireAuthorizedCronRequest,
    (req: Request, res: Response, next: NextFunction) => {
      handleAthenaObservabilityAlertsCron(req, res).catch(next);
    },
  );
  return router;
}

export const athenaObservabilityAlertsCronRouter = createAthenaObservabilityAlertsCronRouter();
