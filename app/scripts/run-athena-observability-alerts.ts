import "dotenv/config";
import { basePrisma } from "../db/client";
import { runWithBackgroundDatabaseSession } from "../db/requestSession";
import { applyAthenaAlertEvaluations, evaluateAthenaAlerts } from "../modules/athena-observability/alerts";
import { parseMaintenanceJobSpecs } from "./maintenanceJobSpec";

// One-shot entry point for operators driving Athena observability alert
// evaluation from external cron / a k8s CronJob / a systemd timer,
// mirroring scripts/run-supplier-price-sync.ts's shape. Reads
// ATHENA_OBSERVABILITY_MAINTENANCE_JOBS (format: "orgId:userId,orgId:userId")
// and, per job, evaluates every alert rule then applies the results to
// athena_alerts. Exits non-zero ONLY on a hard error (bad job identity,
// unexpected DB error) - alerts firing is expected, normal output, not a
// script failure.

async function main() {
  const jobs = parseMaintenanceJobSpecs(process.env.ATHENA_OBSERVABILITY_MAINTENANCE_JOBS);
  if (jobs.length === 0) {
    // eslint-disable-next-line no-console
    console.log("[athena-observability-alerts] ATHENA_OBSERVABILITY_MAINTENANCE_JOBS is empty, nothing to do");
    return;
  }

  let failed = 0;
  for (const job of jobs) {
    try {
      // evaluateAthenaAlerts only reads - it is wrapped in its own
      // background session (separate from applyAthenaAlertEvaluations's own
      // internal session below) rather than nesting one inside the other,
      // since evaluateAthenaAlerts's signature intentionally takes no
      // userId: the read-side session is the caller's responsibility.
      const evaluations = await runWithBackgroundDatabaseSession(basePrisma, { jobName: "athena-observability-alerts-evaluate", orgId: job.orgId, userId: job.userId }, () =>
        evaluateAthenaAlerts(job.orgId)
      );

      // applyAthenaAlertEvaluations only returns rows it actually wrote:
      // an "active" row here may be brand-new or merely still firing since
      // the last run, and a "resolved" row here just transitioned this run
      // - both are logged below without trying to further distinguish
      // "new" vs "continuing" firing, since that distinction is not part
      // of the AthenaAlertRecord contract.
      const applied = await applyAthenaAlertEvaluations(job.orgId, job.userId, evaluations);
      const firing = applied.filter((alert) => alert.status === "active");
      const resolved = applied.filter((alert) => alert.status === "resolved");

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
    } catch (error) {
      failed += 1;
      // eslint-disable-next-line no-console
      console.error(`[athena-observability-alerts] org=${job.orgId} failed:`, error);
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
