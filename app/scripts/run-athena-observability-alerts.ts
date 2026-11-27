import "dotenv/config";
import { basePrisma } from "../db/client";
import { runAthenaAlertJobs } from "../modules/athena-observability/alertRunner";
import { parseMaintenanceJobSpecs } from "../modules/athena-observability/maintenanceJobs";

// One-shot entry point for operators driving Athena observability alert
// evaluation from external cron / a k8s CronJob / a systemd timer,
// mirroring scripts/run-supplier-price-sync.ts's shape. Reads
// ATHENA_OBSERVABILITY_MAINTENANCE_JOBS (format: "orgId:userId,orgId:userId")
// and, per job, evaluates every alert rule, applies the results to
// athena_alerts, and emails newly-firing (brand-new or reactivated) and
// newly-resolved alerts to ATHENA_ALERT_EMAIL_RECIPIENT. Exits non-zero
// ONLY on a hard error (bad job identity, unexpected DB error) - alerts
// firing is expected, normal output, not a script failure, and a failed
// email send never fails the run (the athena_alerts row is the durable
// record). The same pipeline runs in the API runtime behind the Vercel Cron
// route GET /api/cron/athena-observability-alerts.

async function main() {
  const jobs = parseMaintenanceJobSpecs(process.env.ATHENA_OBSERVABILITY_MAINTENANCE_JOBS);
  if (jobs.length === 0) {
    // eslint-disable-next-line no-console
    console.log("[athena-observability-alerts] ATHENA_OBSERVABILITY_MAINTENANCE_JOBS is empty, nothing to do");
    return;
  }

  const run = await runAthenaAlertJobs(jobs);
  if (!run.recipient) {
    // eslint-disable-next-line no-console
    console.log("[athena-observability-alerts] ATHENA_ALERT_EMAIL_RECIPIENT is not set, email delivery skipped");
  }

  let failed = 0;
  for (const job of run.jobs) {
    if (job.error) {
      failed += 1;
      // eslint-disable-next-line no-console
      console.error(`[athena-observability-alerts] org=${job.orgId} failed:`, job.error);
      continue;
    }

    const firing = job.applied.filter((alert) => alert.status === "active");
    const resolved = job.applied.filter((alert) => alert.status === "resolved");

    for (const alert of firing) {
      // eslint-disable-next-line no-console
      console.log(`[athena-observability-alerts] org=${job.orgId} FIRING rule=${alert.ruleId} dedupeKey=${alert.dedupeKey} severity=${alert.severity} summary=${alert.summary}`);
    }
    for (const alert of resolved) {
      // eslint-disable-next-line no-console
      console.log(`[athena-observability-alerts] org=${job.orgId} RESOLVED rule=${alert.ruleId} dedupeKey=${alert.dedupeKey}`);
    }
    if (firing.length === 0 && resolved.length === 0) {
      // eslint-disable-next-line no-console
      console.log(`[athena-observability-alerts] org=${job.orgId} no alert state changes`);
    }
    if (job.emailed > 0) {
      // eslint-disable-next-line no-console
      console.log(`[athena-observability-alerts] org=${job.orgId} emailed ${job.emailed} alert(s) to ${run.recipient}`);
    }
    for (const failure of job.emailFailures) {
      // eslint-disable-next-line no-console
      console.error(`[athena-observability-alerts] org=${job.orgId} email failed rule=${failure.ruleId} dedupeKey=${failure.dedupeKey} status=${failure.status}: ${failure.error}`);
    }
  }

  if (failed > 0) {
    throw new Error(`${failed}/${jobs.length} athena observability alert evaluation job(s) hard-failed`);
  }
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await basePrisma.$disconnect();
  });
