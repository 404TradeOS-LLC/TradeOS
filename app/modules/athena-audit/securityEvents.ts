import { randomUUID } from "node:crypto";
import type {
  AthenaAuditEvent,
  AthenaSecurityAuditEventType,
  AthenaSecurityAuditOutcome,
} from "./types";

export interface AthenaSecurityAuditEventInput {
  eventType: AthenaSecurityAuditEventType;
  organization: string;
  actor: { userId: string | null; role: string | null };
  outcome: AthenaSecurityAuditOutcome;
  metadata?: Record<string, unknown>;
  requestId?: string;
  traceId?: string;
  executionId?: string;
  actionId?: string;
  approvalId?: string;
  timestamp?: Date;
}

const SAFE_METADATA_KEYS = new Set([
  "capability",
  "decision",
  "deniedFields",
  "eventSource",
  "layer",
  "planId",
  "reasonCode",
  "riskLevel",
  "securityDecision",
  "securityReasons",
  "securityRequiredControls",
  "stepId",
  "toolId",
  "toolVersion",
]);

function safeScalar(value: unknown): string | number | boolean | null | string[] | undefined {
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value.slice(0, 200);
  if (Array.isArray(value)) {
    const strings = value.filter((item): item is string => typeof item === "string").slice(0, 20);
    return strings.map((item) => item.slice(0, 200));
  }
  return undefined;
}

function safeMetadata(metadata: Record<string, unknown> | undefined, outcome: AthenaSecurityAuditOutcome): Record<string, unknown> {
  const result: Record<string, unknown> = { outcome };
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (!SAFE_METADATA_KEYS.has(key)) continue;
    const scalar = safeScalar(value);
    if (scalar !== undefined) result[key] = scalar;
  }
  return result;
}

// Constructs security events only from server-derived context supplied by the
// caller. The metadata allowlist is deliberately narrower than the general
// Athena audit envelope: prompts, model output, payloads, secrets, and stack
// traces have no representable field here.
export function buildAthenaSecurityAuditEvent(input: AthenaSecurityAuditEventInput): AthenaAuditEvent {
  return {
    id: randomUUID(),
    timestamp: input.timestamp ?? new Date(),
    actor: input.actor,
    organization: input.organization,
    eventType: input.eventType,
    metadata: safeMetadata(input.metadata, input.outcome),
    requestId: input.requestId,
    traceId: input.traceId,
    executionId: input.executionId,
    actionId: input.actionId,
    approvalId: input.approvalId,
  };
}
