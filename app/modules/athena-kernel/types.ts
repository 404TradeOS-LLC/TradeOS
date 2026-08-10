import type { CanonicalRole } from "../../domain";

// A1 TypeScript contracts, mapped from docs/athena/contracts/README.md (C001-C011)
// and docs/athena/05-runtime/README.md. The full 15-state union is kept so
// A2-A6 can extend the lifecycle without redesigning these types, even though
// A1's own runtime never enters executing/awaitingApproval/partiallySucceeded
// for production business actions (docs/athena/roadmap/A1-ai-kernel-implementation-plan.md).

export const athenaKernelStates = [
  "created",
  "context_building",
  "routing",
  "planning",
  "policy_check",
  "awaiting_approval",
  "executing",
  "degraded",
  "needs_clarification",
  "partially_succeeded",
  "succeeded",
  "failed",
  "denied",
  "expired",
  "cancelled",
] as const;
export type AthenaKernelState = (typeof athenaKernelStates)[number];

export type AthenaRequestSource = "http" | "job" | "test";

export interface AthenaSelectedScope {
  customerId?: string;
  projectId?: string;
  jobId?: string;
  estimateId?: string;
  invoiceId?: string;
  page?: string;
}

export interface AthenaKernelRequest {
  message: string;
  conversationId?: string;
  selectedScope?: AthenaSelectedScope;
  requestSource: AthenaRequestSource;
}

export interface AthenaActorContext {
  userId: string;
  orgId: string;
  role: CanonicalRole;
  permissions: string[];
}

export interface AthenaExecutionContext {
  executionId: string;
  requestId: string;
  traceId: string;
  orgId: string;
  actor: { type: "user" | "system"; id: string };
  role: CanonicalRole;
  deadline: Date;
  signal: AbortSignal;
  featureFlags: string[];
}

export interface AthenaWarning {
  code: string;
  message: string;
}

export interface AthenaFollowUp {
  kind: "question" | "action";
  label: string;
}

export interface AthenaTelemetryReference {
  traceId: string;
  executionId: string;
}

export type AthenaErrorCategory = "validation" | "authorization" | "conflict" | "timeout" | "provider" | "service" | "unknown";

export interface AthenaToolError {
  code: string;
  category: AthenaErrorCategory;
  retryable: boolean;
  safeSummary: string;
  correlationId: string;
}

export interface AthenaKernelResult {
  success: boolean;
  executionId: string;
  traceId: string;
  state: AthenaKernelState;
  summary: string;
  message: string | null;
  warnings: AthenaWarning[];
  followUps: AthenaFollowUp[];
  telemetry: AthenaTelemetryReference;
  error?: AthenaToolError;
}

// Narrowed C001 AI Context: request/organization/user/permissions/selectedScope/
// budget/telemetry only. A1 never populates provider sections (weather,
// calendar, dispatch, customers, costbook, knowledgeEngine, inventory,
// notifications) - those are A3+ work per docs/athena/07-context-engine/README.md.
export interface AthenaRequestContextSection {
  requestId: string;
  traceId: string;
  executionId: string;
  requestSource: AthenaRequestSource;
  receivedAt: string;
}

export interface AthenaOrganizationContextSection {
  orgId: string;
}

export interface AthenaUserContextSection {
  userId: string;
  role: CanonicalRole;
}

export interface AthenaPermissionSnapshot {
  role: CanonicalRole;
  permissions: string[];
}

export interface AthenaContextBudget {
  maxBytes: number;
  maxEstimatedTokens: number;
  maxProviderCount: number;
}

export interface AthenaConversationContextSection {
  conversationId: string;
}

export interface AthenaTelemetryContextSection {
  traceId: string;
  executionId: string;
}

// C001 provider-section shapes (docs/athena/contracts/README.md,
// docs/athena/roadmap/A3-context-engine-implementation-plan.md). Added here
// (not in athena-context-engine/types.ts) so AthenaAIContext stays the one
// canonical context type instead of forking into a kernel version and a
// richer "extended" version. Purely additive: no A1/A2 code path sets these
// fields, so every existing minimal-context assertion (e.g.
// `context).not.toHaveProperty("customers")`) keeps passing unchanged.
export interface AthenaFreshnessEvidence {
  status: "live" | "fresh" | "stale" | "unavailable";
  fetchedAt: string;
  expiresAt?: string;
  ttlMs?: number;
  cacheHit: boolean;
  sourceVersion?: string;
  sourceHash?: string;
  revalidatedAt?: string;
}

export interface AthenaProviderSection<TData = unknown> {
  status: "available" | "degraded" | "omitted" | "unavailable" | "denied";
  freshness: AthenaFreshnessEvidence;
  sensitivity: "public" | "internal" | "confidential" | "restricted";
  source: { providerId: string; providerVersion: string };
  data: TData;
  omittedFields: string[];
  maxItems: number;
  maxBytes: number;
  estimatedTokens?: number;
  truncationReason?: string;
}

export interface AthenaAIContext {
  version: "1.0.0";
  request: AthenaRequestContextSection;
  organization: AthenaOrganizationContextSection;
  user: AthenaUserContextSection;
  permissions: AthenaPermissionSnapshot;
  selectedScope: AthenaSelectedScope;
  budget: AthenaContextBudget;
  conversation?: AthenaConversationContextSection;
  telemetry: AthenaTelemetryContextSection;
  // A3 provider sections. Every field stays unset in A1/A2 code paths and in
  // any A3 provider not yet implemented - see the A3 plan's "Deferred
  // Sections" table for why each unbuilt section is still typed here.
  knowledgeEngine?: AthenaProviderSection;
  dispatch?: AthenaProviderSection;
  weather?: AthenaProviderSection;
  calendar?: AthenaProviderSection;
  customers?: AthenaProviderSection;
  costbook?: AthenaProviderSection;
  inventory?: AthenaProviderSection;
  notifications?: AthenaProviderSection;
  // A7 memory-backed preferences (docs/athena/roadmap/
  // A7-memory-implementation-plan.md, C006 in docs/athena/contracts/
  // README.md). Additive only, same posture as every other provider
  // section above: no A1-A6 code path sets this field, so every existing
  // minimal-context assertion keeps passing unchanged.
  memory?: AthenaProviderSection;
}

// C007 Permission (narrowed to A1's two capabilities)
export type AthenaCapability = "draft_response" | "mutate_business_record";

export interface AthenaPermissionDecision {
  version: "1.0.0";
  orgId: string;
  userId: string;
  role: CanonicalRole;
  permissions: string[];
  capability: AthenaCapability;
  deniedFields: string[];
  decision: "allow" | "deny" | "approval_required";
  reasonCode: string;
}

// C011 Telemetry
export type AthenaTelemetrySpanType = "kernel" | "context" | "planner" | "tool" | "action" | "approval" | "memory" | "event" | "model";
export type AthenaTelemetryStatus = "ok" | "error" | "denied" | "degraded";
export type AthenaTelemetryRedaction = "none" | "metadata_only" | "field_redacted" | "payload_omitted";

export interface AthenaTelemetryCost {
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedUsd?: number;
}

export interface AthenaTelemetryRecord {
  id: string;
  version: "1.0.0";
  orgId: string;
  requestId: string;
  traceId: string;
  executionId: string;
  spanType: AthenaTelemetrySpanType;
  status: AthenaTelemetryStatus;
  durationMs: number;
  redaction: AthenaTelemetryRedaction;
  cost?: AthenaTelemetryCost;
  metadata: Record<string, unknown>;
}

// Cancellation/expiry reason codes (docs/athena/roadmap/A1-ai-kernel-implementation-plan.md)
export type AthenaCancellationReason = "user_cancelled" | "client_closed" | "deadline_exceeded" | "provider_timeout" | "shutdown";
