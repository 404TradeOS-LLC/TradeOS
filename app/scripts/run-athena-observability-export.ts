import "dotenv/config";
import { basePrisma } from "../db/client";
import { createConsoleExporter, createWebhookExporter, runAthenaObservabilityExport } from "../modules/athena-observability/exporters";

// One-shot entry point for operators driving Athena observability export
// from external cron / a k8s CronJob / a systemd timer, mirroring
// scripts/run-supplier-price-sync.ts's shape. Reads
// ATHENA_OBSERVABILITY_MAINTENANCE_JOBS (format: "orgId:userId,orgId:userId"),
// exports the trailing ATHENA_OBSERVABILITY_EXPORT_WINDOW_MINUTES (default
// 15) of telemetry spans once per configured org/identity pair, and exits
// non-zero if any job hard-fails or reports per-span export failures so the
// external scheduler can alert on it.

interface MaintenanceJobSpec {
  orgId: string;
  userId: string;
}

function parseMaintenanceJobSpecs(raw: string | undefined): MaintenanceJobSpec[] {
  if (!raw || raw.trim().length === 0) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const [orgId, userId] = entry.split(":").map((part) => part.trim());
      if (!orgId || !userId) {
        throw new Error(`ATHENA_OBSERVABILITY_MAINTENANCE_JOBS entry "${entry}" must be in "orgId:userId" format`);
      }
      return { orgId, userId };
    });
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

const DEFAULT_WINDOW_MINUTES = 15;

async function main() {
  const jobs = parseMaintenanceJobSpecs(process.env.ATHENA_OBSERVABILITY_MAINTENANCE_JOBS);
  if (jobs.length === 0) {
    // eslint-disable-next-line no-console
    console.log("[athena-observability-export] ATHENA_OBSERVABILITY_MAINTENANCE_JOBS is empty, nothing to do");
    return;
  }

  const webhookUrl = process.env.ATHENA_OBSERVABILITY_EXPORT_WEBHOOK_URL;
  const exporter = webhookUrl && webhookUrl.trim().length > 0 ? createWebhookExporter({ id: "athena-observability-webhook", url: webhookUrl }) : createConsoleExporter();

  const windowMinutes = envInt("ATHENA_OBSERVABILITY_EXPORT_WINDOW_MINUTES", DEFAULT_WINDOW_MINUTES);
  const to = new Date();
  const from = new Date(to.getTime() - windowMinutes * 60_000);

  let failed = 0;
  for (const job of jobs) {
    const result = await runAthenaObservabilityExport({
      orgId: job.orgId,
      userId: job.userId,
      exporter,
      windowFrom: from.toISOString(),
      windowTo: to.toISOString(),
    });

    // eslint-disable-next-line no-console
    console.log(`[athena-observability-export] org=${job.orgId} exporter=${result.exporterId} attempted=${result.attempted} succeeded=${result.succeeded} failed=${result.failed} durationMs=${result.durationMs}`);
    if (result.errors.length > 0) {
      // eslint-disable-next-line no-console
      console.error(`[athena-observability-export] org=${job.orgId} errors:`, result.errors);
    }
    if (result.failed > 0) {
      failed += 1;
    }
  }

  if (failed > 0) {
    throw new Error(`${failed}/${jobs.length} athena observability export job(s) reported failures`);
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
