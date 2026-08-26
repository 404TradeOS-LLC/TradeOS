import { randomUUID } from "node:crypto";
import { redactSecrets } from "../athena-security/secretProtection";
import { persistTelemetryRecord } from "./executionStore";
import { getAthenaFlags } from "./flags";
import { AthenaTelemetryCost, AthenaTelemetryRecord, AthenaTelemetryRedaction, AthenaTelemetryStatus, AthenaTelemetrySpanType } from "./types";

export interface BuildTelemetryRecordInput {
  orgId: string;
  requestId: string;
  traceId: string;
  executionId: string;
  spanType: AthenaTelemetrySpanType;
  status: AthenaTelemetryStatus;
  durationMs: number;
  metadata?: Record<string, unknown>;
  cost?: AthenaTelemetryCost;
  redaction?: AthenaTelemetryRedaction;
}

const SAFE_METADATA_KEYS_DENYLIST = ["message", "prompt", "rawPrompt", "chainOfThought", "completion"];

// Defense in depth against accidentally logging raw prompt/secret content:
// strips any metadata key that looks like it could carry a raw prompt/model
// artifact, even though every A1 call site is expected to pass only safe,
// pre-redacted fields. Credential-shaped keys/values (token, apiKey,
// password, and everything else A11's centralized detector recognizes) are
// no longer handled by this module's own denylist - they are redacted by
// athena-security's redactSecrets (app/modules/athena-security/
// secretProtection.ts), the one shared detector every surface that persists
// Athena-derived data (telemetry here, plus A7 memory, A8 events, A9 tool
// results) now calls into, so the pattern list only needs to be maintained
// in one place. redactSecrets also catches a secret-*shaped value* under an
// innocuous key name (e.g. a "note" field that happens to contain a bearer
// token) - something a key-name-only denylist could never catch.
function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    if (SAFE_METADATA_KEYS_DENYLIST.some((denied) => lowerKey.includes(denied.toLowerCase()))) {
      continue;
    }
    sanitized[key] = value;
  }
  return redactSecrets(sanitized).data;
}

// Builds a single C011-shaped record (docs/athena/contracts/README.md).
// Every A1 span defaults to "metadata_only" redaction because A1 never
// stores raw prompts, model output, or payloads - only structural metadata
// (state names, durations, counts).
export function buildTelemetryRecord(input: BuildTelemetryRecordInput): AthenaTelemetryRecord {
  const record: AthenaTelemetryRecord = {
    id: randomUUID(),
    version: "1.0.0",
    orgId: input.orgId,
    requestId: input.requestId,
    traceId: input.traceId,
    executionId: input.executionId,
    spanType: input.spanType,
    status: input.status,
    durationMs: input.durationMs,
    redaction: input.redaction ?? "metadata_only",
    metadata: sanitizeMetadata(input.metadata ?? {}),
  };
  if (input.cost) {
    record.cost = input.cost;
  }
  return record;
}

const REQUIRED_STRING_FIELDS: (keyof AthenaTelemetryRecord)[] = ["id", "orgId", "requestId", "traceId", "executionId", "spanType", "status", "redaction"];
const VALID_SPAN_TYPES: readonly AthenaTelemetrySpanType[] = ["kernel", "context", "planner", "tool", "action", "approval", "memory", "event", "model"];
const VALID_STATUSES: readonly AthenaTelemetryStatus[] = ["ok", "error", "denied", "degraded"];
const VALID_REDACTIONS: readonly AthenaTelemetryRedaction[] = ["none", "metadata_only", "field_redacted", "payload_omitted"];
const FORBIDDEN_METADATA_SUBSTRINGS = ["prompt", "chainofthought", "chain_of_thought"];

// Runtime shape validator required by the athena:contracts gate (HIGH-P4,
// A1 parallel readiness review: "athena:contracts should explicitly include
// a runtime shape-validation test against the C011 interface, not just
// presence of a telemetry call"). Throws on any structural or redaction
// violation.
export function assertValidTelemetryRecord(record: unknown): asserts record is AthenaTelemetryRecord {
  if (typeof record !== "object" || record === null) {
    throw new Error("AthenaTelemetryRecord must be an object");
  }
  const candidate = record as Partial<AthenaTelemetryRecord>;

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof candidate[field] !== "string" || (candidate[field] as string).length === 0) {
      throw new Error(`AthenaTelemetryRecord.${String(field)} must be a non-empty string`);
    }
  }
  if (candidate.version !== "1.0.0") {
    throw new Error("AthenaTelemetryRecord.version must be 1.0.0");
  }
  if (typeof candidate.durationMs !== "number" || candidate.durationMs < 0) {
    throw new Error("AthenaTelemetryRecord.durationMs must be a non-negative number");
  }
  if (!VALID_SPAN_TYPES.includes(candidate.spanType as AthenaTelemetrySpanType)) {
    throw new Error(`AthenaTelemetryRecord.spanType is not a known span type: ${String(candidate.spanType)}`);
  }
  if (!VALID_STATUSES.includes(candidate.status as AthenaTelemetryStatus)) {
    throw new Error(`AthenaTelemetryRecord.status is not a known status: ${String(candidate.status)}`);
  }
  if (!VALID_REDACTIONS.includes(candidate.redaction as AthenaTelemetryRedaction)) {
    throw new Error(`AthenaTelemetryRecord.redaction is not a known redaction mode: ${String(candidate.redaction)}`);
  }
  if (typeof candidate.metadata !== "object" || candidate.metadata === null) {
    throw new Error("AthenaTelemetryRecord.metadata must be an object");
  }

  const metadataText = JSON.stringify(candidate.metadata).toLowerCase();
  for (const forbidden of FORBIDDEN_METADATA_SUBSTRINGS) {
    if (metadataText.includes(forbidden)) {
      throw new Error(`AthenaTelemetryRecord.metadata must not carry redacted content (found "${forbidden}")`);
    }
  }
}

// Validates and persists one telemetry span. No-ops when
// ATHENA_TELEMETRY_ENABLED is false; still validates the shape first so a
// malformed record fails loudly in tests even when telemetry is disabled.
export async function recordAthenaTelemetry(record: AthenaTelemetryRecord, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  assertValidTelemetryRecord(record);

  if (!getAthenaFlags(env).telemetryEnabled) {
    return;
  }

  await persistTelemetryRecord({
    executionId: record.executionId,
    orgId: record.orgId,
    requestId: record.requestId,
    traceId: record.traceId,
    spanType: record.spanType,
    status: record.status,
    durationMs: record.durationMs,
    redaction: record.redaction,
    cost: record.cost,
    metadata: record.metadata,
  });
}
