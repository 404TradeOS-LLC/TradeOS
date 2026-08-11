import "dotenv/config";
import { basePrisma } from "../db/client";
import { runAthenaObservabilityRetention } from "../modules/athena-observability/retention";
import { parseMaintenanceJobSpecs } from "./maintenanceJobSpec";

// One-shot entry point for operators driving Athena observability retention
// from external cron / a k8s CronJob / a systemd timer, mirroring
// scripts/run-supplier-price-sync.ts's shape exactly. Reads
// ATHENA_OBSERVABILITY_MAINTENANCE_JOBS (format: "orgId:userId,orgId:userId"),
// runs retention once per configured org/identity pair, and exits non-zero
// if any of them failed so the external scheduler can alert on it.

async function main() {
  const jobs = parseMaintenanceJobSpecs(process.env.ATHENA_OBSERVABILITY_MAINTENANCE_JOBS);
  if (jobs.length === 0) {
    // eslint-disable-next-line no-console
    console.log("[athena-observability-retention] ATHENA_OBSERVABILITY_MAINTENANCE_JOBS is empty, nothing to do");
    return;
  }

  let failed = 0;
  for (const job of jobs) {
    try {
      const results = await runAthenaObservabilityRetention({ orgId: job.orgId, userId: job.userId });
      for (const result of results) {
        // eslint-disable-next-line no-console
        console.log(`[athena-observability-retention] org=${job.orgId} table=${result.table} deleted=${result.deletedCount} scannedBatches=${result.scannedBatches} cutoff=${result.cutoff}`);
      }
    } catch (error) {
      failed += 1;
      // eslint-disable-next-line no-console
      console.error(`[athena-observability-retention] org=${job.orgId} failed:`, error);
    }
  }

  if (failed > 0) {
    throw new Error(`${failed}/${jobs.length} athena observability retention job(s) failed`);
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
