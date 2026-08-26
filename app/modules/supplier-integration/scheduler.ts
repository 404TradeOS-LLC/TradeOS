import cron, { ScheduledTask } from "node-cron";
import { z } from "zod";
import { runSupplierPriceSyncJob } from "./worker";
import { SupplierPriceSyncJobOutcome, SupplierPriceSyncJobSpec } from "./types";

const jobSpecSchema = z.object({
  orgId: z.string().uuid(),
  userId: z.string().uuid(),
  supplierId: z.string().uuid(),
  label: z.string().min(1).optional(),
});

export function parseSupplierPriceSyncJobSpecs(raw: string | undefined): SupplierPriceSyncJobSpec[] {
  if (!raw || raw.trim().length === 0) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("SUPPLIER_PRICE_SYNC_JOBS must be valid JSON");
  }

  const result = z.array(jobSpecSchema).safeParse(parsed);
  if (!result.success) {
    throw new Error(`SUPPLIER_PRICE_SYNC_JOBS is malformed: ${result.error.message}`);
  }
  return result.data;
}

// Runs every configured sync target once, in sequence. One job spec failing
// (a bad userId, a revoked membership, a transient DB error) does not stop
// the rest from running — each outcome is reported individually so a
// caller (the cron tick, or the one-shot CLI script) can log/alert per spec.
export async function runSupplierPriceSyncJobs(
  jobSpecs: SupplierPriceSyncJobSpec[]
): Promise<SupplierPriceSyncJobOutcome[]> {
  const outcomes: SupplierPriceSyncJobOutcome[] = [];
  for (const spec of jobSpecs) {
    try {
      const result = await runSupplierPriceSyncJob(spec);
      outcomes.push({ spec, result });
    } catch (error) {
      outcomes.push({ spec, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return outcomes;
}

export interface StartSupplierPriceSyncSchedulerOptions {
  schedule?: string;
  jobSpecs?: SupplierPriceSyncJobSpec[];
  onTick?: (outcomes: SupplierPriceSyncJobOutcome[]) => void;
}

// Wires runSupplierPriceSyncJobs to an in-process cron schedule. No-ops
// (returns undefined) if not configured, so booting the API without setting
// these env vars is silent and safe rather than throwing — the same
// fail-quiet-when-unconfigured shape as the platform provisioning IP
// allowlist. An operator who prefers external cron/k8s CronJob instead of
// an in-process timer can ignore this and invoke
// scripts/run-supplier-price-sync.ts directly on their own schedule.
export function startSupplierPriceSyncScheduler(
  options: StartSupplierPriceSyncSchedulerOptions = {}
): ScheduledTask | undefined {
  const schedule = options.schedule ?? process.env.SUPPLIER_PRICE_SYNC_CRON_SCHEDULE;
  const jobSpecs = options.jobSpecs ?? parseSupplierPriceSyncJobSpecs(process.env.SUPPLIER_PRICE_SYNC_JOBS);

  if (!schedule || jobSpecs.length === 0) {
    return undefined;
  }
  if (!cron.validate(schedule)) {
    throw new Error(`SUPPLIER_PRICE_SYNC_CRON_SCHEDULE is not a valid cron expression: ${schedule}`);
  }

  return cron.schedule(schedule, () => {
    runSupplierPriceSyncJobs(jobSpecs)
      .then((outcomes) => options.onTick?.(outcomes))
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error("[supplier-price-sync] scheduler tick failed unexpectedly", error);
      });
  });
}
