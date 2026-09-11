import type { CanonicalRole } from "../../domain";

export const athenaKernelStates = [
  "created", "context_building", "routing", "planning", "policy_check", "awaiting_approval", "executing", "degraded", "needs_clarification", "partially_succeeded", "succeeded", "failed", "denied", "expired", "cancelled",
] as const;
export type AthenaKernelState = (typeof athenaKernelStates)[number];

export type AthenaRequestSource = "http" | "job" | "test";
export type AthenaInteractionChannel = "text" | "mobile" | "voice";
export type AthenaMobilePlatform = "ios" | "android" | "web";
export type AthenaViewportClass = "compact" | "regular";
export type AthenaConnectivityState = "online" | "degraded" | "offline";

export interface AthenaSelectedScope {
  customerId?: string;
  projectId?: string;
  jobId?: string;
  estimateId?: string;
  invoiceId?: string;
  page?: string;
}

export interface AthenaVoiceConfirmationProof {
  toolId: string;
  toolVersion: string;
  inputHash: string;
  confirmed: true;
}

export interface AthenaInteractionContext {
  channel: AthenaInteractionChannel;
  platform?: AthenaMobilePlatform;
  viewportClass?: AthenaViewportClass;
  connectivity?: AthenaConnectivityState;
  voiceConfirmation?: AthenaVoiceConfirmationProof;
}

export interface AthenaKernelRequest {
  message: string;
  conversationId?: string;
  selectedScope?: AthenaSelectedScope;
  requestSource: AthenaRequestSource;
  interaction?: AthenaInteractionContext;
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

export interface AthenaWarning { code: string; message: string; }
export interface AthenaFollowUp { kind: "question" | "action"; label: string; }
export interface AthenaTelemetryReference { traceId: string; executionId: string; }
export type AthenaErrorCategory = "validation" | "authorization" | "conflict" | "timeout" | "provider" | "service" | "unknown";

export interface AthenaToolError {
  code: string;
  category: AthenaErrorCategory;
  retryable: boolean;
  safeSummary: string;
  correlationId: string;
}

export interface AthenaVoiceConfirmationChallenge {
  toolId: string;
  toolVersion: string;
  inputHash: string;
  prompt: string;
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
  voiceConfirmation?: AthenaVoiceConfirmationChallenge;
  error?: AthenaToolError;
}

export interface AthenaRequestContextSection {
  requestId: string;
  traceId: string;
  executionId: string;
  requestSource: AthenaRequestSource;
  receivedAt: string;
  interaction?: Omit<AthenaInteractionContext, "voiceConfirmation">;
}
export interface AthenaOrganizationContextSection { orgId: string; }
export interface AthenaUserContextSection { userId: string; role: CanonicalRole; }
export interface AthenaPermissionSnapshot { role: CanonicalRole; permissions: string[]; }
export interface AthenaContextBudget { maxBytes: number; maxEstimatedTokens: number; maxProviderCount: number; }
export interface AthenaConversationContextSection { conversationId: string; }
export interface AthenaTelemetryContextSection { traceId: string; executionId: string; }

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
  injectionScan?: { suspicious: boolean; matchedPatternNames: string[] };
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
  knowledgeEngine?: AthenaProviderSection;
  dispatch?: AthenaProviderSection;
  weather?: AthenaProviderSection;
  calendar?: AthenaProviderSection;
  customers?: AthenaProviderSection;
  estimates?: AthenaProviderSection;
  costbook?: AthenaProviderSection;
  inventory?: AthenaProviderSection;
  notifications?: AthenaProviderSection;
  memory?: AthenaProviderSection;
  mobile?: AthenaProviderSection;
}

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

export type AthenaTelemetrySpanType = "kernel" | "context" | "planner" | "tool" | "action" | "approval" | "memory" | "event" | "model";
export type AthenaTelemetryStatus = "ok" | "error" | "denied" | "degraded";
export type AthenaTelemetryRedaction = "none" | "metadata_only" | "field_redacted" | "payload_omitted";
export interface AthenaTelemetryCost { provider?: string; model?: string; inputTokens?: number; outputTokens?: number; estimatedUsd?: number; }
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

export type AthenaCancellationReason = "user_cancelled" | "client_closed" | "deadline_exceeded" | "provider_timeout" | "shutdown";
