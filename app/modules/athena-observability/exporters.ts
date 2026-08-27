import { basePrisma, prisma } from "../../db/client";
import { runWithBackgroundDatabaseSession } from "../../db/requestSession";
import { AthenaTelemetryCost, AthenaTelemetryRedaction, AthenaTelemetryStatus, AthenaTelemetrySpanType } from "../athena-kernel/types";
import { AthenaObservabilityExportBatch, AthenaObservabilityExportResult, AthenaObservabilityExporter, AthenaTelemetrySpan } from "./types";
import { classifyBackgroundFailure } from "../background/retry";

// A10 exporters (docs/athena/roadmap/A10-observability-implementation-plan.md
// "Exporters and retention"). An exporter's job is to ship already-redacted
// C011 telemetry spans somewhere else (stdout, a webhook, eventually a
// vendor SDK) out-of-band from request handling - never inline with a live
// Athena execution. Every implementation here follows the contract's
// hardest rule: `.export()` must never throw. A caller (script/cron) that
// wraps this in retry/alerting logic can trust the returned counts and
// never needs a try/catch of its own around `.export()` itself.

// One line per span, JSON-encoded, via console.log. Safe for any
// environment (stdout can always be piped/collected by a log shipper) and
// carries no separate redaction step of its own - span.metadata is already
// sanitized at telemetry write time (modules/athena-kernel/telemetry.ts's
// sanitizeMetadata/assertValidTelemetryRecord), so this exporter passes it
// through rather than re-implementing redaction.
export function createConsoleExporter(): AthenaObservabilityExporter {
  return {
    id: "console",
    timeoutMs: 0,
    async export(batch: AthenaObservabilityExportBatch) {
      let succeeded = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const span of batch.spans) {
        try {
          const line = JSON.stringify({
            id: span.id,
            orgId: span.orgId,
            executionId: span.executionId,
            requestId: span.requestId,
            traceId: span.traceId,
            spanType: span.spanType,
            status: span.status,
            durationMs: span.durationMs,
            redaction: span.redaction,
            cost: span.cost,
            metadata: span.metadata,
            createdAt: span.createdAt,
          });
          // eslint-disable-next-line no-console
          console.log(`[athena-observability-export] ${line}`);
          succeeded += 1;
        } catch (error) {
          // Only reachable if JSON.stringify throws (e.g. a circular
          // reference slipped through, which should be impossible for an
          // already-persisted, already-validated span) - counted as a
          // per-span failure rather than aborting the whole batch.
          failed += 1;
          errors.push(classifyBackgroundFailure(error, { orgId: span.orgId, jobName: "athena-observability-export", workerId: "console", correlationId: span.traceId, attempt: 1 }).code);
        }
      }

      return { succeeded, failed, errors };
    },
  };
}

export interface WebhookExporterConfig {
  id: string;
  url: string;
  timeoutMs?: number;
}

const DEFAULT_WEBHOOK_TIMEOUT_MS = 10_000;

// POSTs the whole batch as one JSON payload to config.url, using the
// runtime's built-in fetch (no new npm dependency). Every failure mode -
// network error, non-2xx response, timeout - is caught here and reported
// as a failed batch rather than thrown, per the exporter contract. A
// batch-level failure counts every span in the batch as failed since a
// single POST either delivers the whole batch or it doesn't; there is no
// partial-batch signal from a webhook without a richer response contract
// this milestone does not define.
// Telemetry spans are tenant data (see the module-level comment on
// sanitizeMetadata/redaction above), so a webhook config that would send
// them in cleartext - or let a redirect silently retarget the POST to an
// attacker-controlled host - is treated as a bad config, exactly like any
// other malformed exporter setup would be, rather than something export
// should discover for the first time at fetch() time.
function assertHttpsWebhookUrl(id: string, rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`webhook exporter ${id} has an invalid URL: ${rawUrl}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`webhook exporter ${id} must use an https:// URL to avoid sending telemetry in cleartext, received: ${rawUrl}`);
  }
}

export function createWebhookExporter(config: WebhookExporterConfig): AthenaObservabilityExporter {
  assertHttpsWebhookUrl(config.id, config.url);
  const timeoutMs = config.timeoutMs ?? DEFAULT_WEBHOOK_TIMEOUT_MS;

  return {
    id: config.id,
    timeoutMs,
    async export(batch: AthenaObservabilityExportBatch) {
      if (batch.spans.length === 0) {
        return { succeeded: 0, failed: 0, errors: [] };
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(config.url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(batch),
          signal: controller.signal,
          // Never let fetch's default redirect-following silently forward
          // the POST (and the tenant telemetry in its body) to a different,
          // possibly non-https, host.
          redirect: "error",
        });

        if (!response.ok) {
          return { succeeded: 0, failed: batch.spans.length, errors: [`webhook_response_${response.status}`] };
        }

        return { succeeded: batch.spans.length, failed: 0, errors: [] };
      } catch (error) {
        const isAbort = error instanceof Error && error.name === "AbortError";
        return {
          succeeded: 0,
          failed: batch.spans.length,
          errors: [isAbort ? "webhook_timeout" : "webhook_request_failed"],
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

// Extra defense-in-depth on top of each exporter's own never-throw
// contract: if a hand-rolled exporter (e.g. a future plugin, C012) violates
// that contract and throws or rejects anyway, this still turns it into a
// reported failure instead of letting it escape runAthenaObservabilityExport.
async function safeExport(exporter: AthenaObservabilityExporter, batch: AthenaObservabilityExportBatch): Promise<{ succeeded: number; failed: number; errors: string[] }> {
  try {
    return await exporter.export(batch);
  } catch (error) {
    const orgId = batch.spans[0]?.orgId ?? "unknown";
    return { succeeded: 0, failed: batch.spans.length, errors: [classifyBackgroundFailure(error, { orgId, jobName: "athena-observability-export", workerId: exporter.id, correlationId: batch.windowFrom, attempt: 1 }).code] };
  }
}

interface TelemetryRow {
  id: string;
  orgId: string;
  executionId: string;
  requestId: string;
  traceId: string;
  spanType: string;
  status: string;
  durationMs: number;
  redaction: string;
  costJson: unknown;
  metadataJson: unknown;
  createdAt: Date;
}

// Minimal local reshape from the DB row shape to the AthenaTelemetrySpan
// read model. traceService.ts (owned by a sibling agent on this branch) is
// expected to define the canonical version of this reshape for trace
// queries; this one exists only so export does not have to block on that
// file landing first, and is intentionally private to this module.
function toTelemetrySpan(row: TelemetryRow): AthenaTelemetrySpan {
  return {
    id: row.id,
    orgId: row.orgId,
    executionId: row.executionId,
    requestId: row.requestId,
    traceId: row.traceId,
    spanType: row.spanType as AthenaTelemetrySpanType,
    status: row.status as AthenaTelemetryStatus,
    durationMs: row.durationMs,
    redaction: row.redaction as AthenaTelemetryRedaction,
    cost: (row.costJson as AthenaTelemetryCost | null) ?? null,
    metadata: (row.metadataJson as Record<string, unknown> | null) ?? {},
    createdAt: row.createdAt.toISOString(),
  };
}

export interface RunAthenaObservabilityExportParams {
  orgId: string;
  userId: string;
  exporter: AthenaObservabilityExporter;
  windowFrom: string;
  windowTo: string;
}

// Loads C011 telemetry spans for one org/window and hands them to the given
// exporter, entirely inside a background database session so the read is
// RLS-scoped to exactly that org. Exporter failures - and any unexpected
// error setting up the background session itself (bad job identity,
// transient DB error) - are caught here and turned into a result; nothing
// from this function is allowed to throw past it, matching the exporter
// contract's "never affects a real Athena execution" rule (types.ts).
export async function runAthenaObservabilityExport(params: RunAthenaObservabilityExportParams): Promise<AthenaObservabilityExportResult> {
  const start = Date.now();

  try {
    return await runWithBackgroundDatabaseSession(basePrisma, { jobName: "athena-observability-export", orgId: params.orgId, userId: params.userId }, async () => {
      const rows = await prisma.athenaTelemetryRecordRow.findMany({
        where: { orgId: params.orgId, createdAt: { gte: new Date(params.windowFrom), lt: new Date(params.windowTo) } },
        orderBy: { createdAt: "asc" },
      });
      const spans = rows.map(toTelemetrySpan);

      const outcome = await safeExport(params.exporter, { spans, windowFrom: params.windowFrom, windowTo: params.windowTo });

      return {
        exporterId: params.exporter.id,
        attempted: spans.length,
        succeeded: outcome.succeeded,
        failed: outcome.failed,
        errors: outcome.errors,
        durationMs: Date.now() - start,
      };
    });
  } catch (error) {
    return {
      exporterId: params.exporter.id,
      attempted: 0,
      succeeded: 0,
      failed: 0,
      errors: [classifyBackgroundFailure(error, { orgId: params.orgId, jobName: "athena-observability-export", workerId: params.exporter.id, correlationId: params.windowFrom, attempt: 1 }).code],
      durationMs: Date.now() - start,
    };
  }
}
