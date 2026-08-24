import { basePrisma, prisma } from "../../db/client";
import { runWithBackgroundDatabaseSession } from "../../db/requestSession";
import { AthenaRetentionResult } from "./types";
import { deleteExpiredAthenaGenerationRecords } from "../athena-generation/store";

// A10 retention (docs/athena/roadmap/A10-observability-implementation-plan.md
// "Exporters and retention"). Deletes old C011 telemetry spans and old A1
// execution records for exactly one org, in bounded batches, inside a
// background database session. Never a single unbounded DELETE, and always
// safe to re-run: a batch loop that finds nothing old left simply does
// nothing on its second pass.

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

const DEFAULT_TELEMETRY_RETENTION_DAYS = envInt("ATHENA_TELEMETRY_RETENTION_DAYS", 90);
const DEFAULT_EXECUTION_RETENTION_DAYS = envInt("ATHENA_EXECUTION_RETENTION_DAYS", 400);
const DEFAULT_GENERATION_RETENTION_DAYS = envInt("ATHENA_GENERATION_RETENTION_DAYS", 90);
const DEFAULT_BATCH_SIZE = 500;

export interface RunAthenaObservabilityRetentionParams {
  orgId: string;
  userId: string;
  telemetryRetentionDays?: number;
  executionRetentionDays?: number;
  generationRetentionDays?: number;
  batchSize?: number;
  now?: Date;
}

function daysToCutoff(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

// athena_telemetry_records is a leaf table (no children reference it), so
// it is safe - and cheapest - to delete first and independently of
// execution retention.
async function deleteOldTelemetryRecords(orgId: string, cutoff: Date, batchSize: number): Promise<AthenaRetentionResult> {
  let scannedBatches = 0;
  let deletedCount = 0;

  for (;;) {
    const rows = await prisma.athenaTelemetryRecordRow.findMany({
      where: { orgId, createdAt: { lt: cutoff } },
      orderBy: { createdAt: "asc" },
      take: batchSize,
      select: { id: true },
    });
    scannedBatches += 1;
    if (rows.length === 0) break;

    const { count } = await prisma.athenaTelemetryRecordRow.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
    deletedCount += count;

    if (rows.length < batchSize) break;
  }

  return { table: "athena_telemetry_records", scannedBatches, deletedCount, cutoff: cutoff.toISOString() };
}

// Deleting an old athena_executions row cascades to its
// athena_execution_transitions and any remaining athena_telemetry_records
// rows for it (schema.prisma's onDelete: Cascade on both children), so
// this alone is sufficient cleanup for the execution and its history - no
// separate delete of athena_execution_transitions is needed or performed.
// Prisma's deleteMany only returns the count of rows deleted from the
// table it was called on, not cascaded child counts, and there is no cheap
// way to get an accurate cascade count without either a raw SQL DELETE...
// RETURNING or a pre-delete COUNT of children per batch (an extra query
// per batch for a number this function does not otherwise need) - so this
// intentionally reports only the athena_executions table's own
// AthenaRetentionResult and omits a separate entry for
// athena_execution_transitions, rather than reporting a fabricated or
// misleading count.
async function deleteOldExecutions(orgId: string, cutoff: Date, batchSize: number): Promise<AthenaRetentionResult> {
  let scannedBatches = 0;
  let deletedCount = 0;

  for (;;) {
    const rows = await prisma.athenaExecution.findMany({
      where: { orgId, createdAt: { lt: cutoff } },
      orderBy: { createdAt: "asc" },
      take: batchSize,
      select: { id: true },
    });
    scannedBatches += 1;
    if (rows.length === 0) break;

    const { count } = await prisma.athenaExecution.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
    deletedCount += count;

    if (rows.length < batchSize) break;
  }

  return { table: "athena_executions", scannedBatches, deletedCount, cutoff: cutoff.toISOString() };
}

export async function runAthenaObservabilityRetention(params: RunAthenaObservabilityRetentionParams): Promise<AthenaRetentionResult[]> {
  const telemetryRetentionDays = params.telemetryRetentionDays ?? DEFAULT_TELEMETRY_RETENTION_DAYS;
  const executionRetentionDays = params.executionRetentionDays ?? DEFAULT_EXECUTION_RETENTION_DAYS;
  const generationRetentionDays = params.generationRetentionDays ?? DEFAULT_GENERATION_RETENTION_DAYS;
  const batchSize = params.batchSize ?? DEFAULT_BATCH_SIZE;
  const now = params.now ?? new Date();

  if (!Number.isFinite(telemetryRetentionDays) || telemetryRetentionDays <= 0) {
    throw new Error(`telemetryRetentionDays must be a positive number, got ${telemetryRetentionDays}`);
  }
  if (!Number.isFinite(executionRetentionDays) || executionRetentionDays <= 0) {
    throw new Error(`executionRetentionDays must be a positive number, got ${executionRetentionDays}`);
  }
  if (!Number.isFinite(generationRetentionDays) || generationRetentionDays <= 0) {
    throw new Error(`generationRetentionDays must be a positive number, got ${generationRetentionDays}`);
  }
  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    throw new Error(`batchSize must be a positive number, got ${batchSize}`);
  }
  // Executions own their telemetry spans (AthenaTelemetryRecordRow.executionId,
  // onDelete: Cascade) - if executions were retained for a *shorter* period
  // than telemetry, a still-live execution's spans could be deleted out
  // from under it by the telemetry pass, or a just-deleted execution could
  // leave the (redundant, but semantically wrong) impression that telemetry
  // retention is authoritative. Executions must outlive their own spans.
  if (executionRetentionDays < telemetryRetentionDays) {
    throw new Error(`executionRetentionDays (${executionRetentionDays}) must be >= telemetryRetentionDays (${telemetryRetentionDays}) - executions must outlive their own telemetry spans`);
  }

  return runWithBackgroundDatabaseSession(basePrisma, { jobName: "athena-observability-retention", orgId: params.orgId, userId: params.userId }, async () => {
    const results: AthenaRetentionResult[] = [];
    results.push(await deleteOldTelemetryRecords(params.orgId, daysToCutoff(now, telemetryRetentionDays), batchSize));
    const generationCutoff = daysToCutoff(now, generationRetentionDays);
    const generationResult = await deleteExpiredAthenaGenerationRecords(params.orgId, generationCutoff, batchSize);
    results.push({
      table: "athena_generation_runs",
      scannedBatches: generationResult.scannedBatches,
      deletedCount: generationResult.deletedCount,
      cutoff: generationCutoff.toISOString(),
    });
    results.push(await deleteOldExecutions(params.orgId, daysToCutoff(now, executionRetentionDays), batchSize));
    return results;
  });
}
