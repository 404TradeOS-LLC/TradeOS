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
