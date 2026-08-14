import "dotenv/config";
import { basePrisma } from "../db/client";
import { parseSupplierPriceSyncJobSpecs, runSupplierPriceSyncJobs } from "../modules/supplier-integration/scheduler";

// One-shot entry point for operators who'd rather drive the supplier price
// sync from external cron / a k8s CronJob / a systemd timer than rely on
// the optional in-process scheduler started by api/server.ts. Reads the same
// SUPPLIER_PRICE_SYNC_JOBS env var, runs each configured target exactly
// once, and exits non-zero if any of them failed so the external scheduler
// can alert on it.
async function main() {
  const jobSpecs = parseSupplierPriceSyncJobSpecs(process.env.SUPPLIER_PRICE_SYNC_JOBS);
  if (jobSpecs.length === 0) {
    console.log("[supplier-price-sync] SUPPLIER_PRICE_SYNC_JOBS is empty, nothing to do");
    return;
  }

  const outcomes = await runSupplierPriceSyncJobs(jobSpecs);
  let failed = 0;
  for (const outcome of outcomes) {
    const label = outcome.spec.label ?? outcome.spec.supplierId;
    if (outcome.error) {
      failed += 1;
      console.error(`[supplier-price-sync] ${label} failed: ${outcome.error}`);
    } else {
      console.log(`[supplier-price-sync] ${label}: proposed ${outcome.result?.proposed}, skipped ${outcome.result?.skipped}`);
    }
  }

  if (failed > 0) {
    throw new Error(`${failed}/${outcomes.length} supplier price sync job(s) failed`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await basePrisma.$disconnect();
  });
