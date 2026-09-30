import type { CanonicalRole } from "../../domain";
import type { AthenaFreshnessEvidence, AthenaInteractionContext, AthenaProviderSection, AthenaSelectedScope, AthenaWarning } from "../athena-kernel/types";

export type { AthenaFreshnessEvidence, AthenaProviderSection, AthenaSelectedScope };

export const ATHENA_CONTEXT_SECTIONS = ["knowledgeEngine", "dispatch", "weather", "calendar", "customers", "estimates", "costbook", "inventory", "notifications", "memory", "mobile"] as const;
export type AthenaContextSectionName = (typeof ATHENA_CONTEXT_SECTIONS)[number];

export type AthenaContextActivationMode = "eager_minimal" | "lazy_intent" | "explicit_only";
export type AthenaContextSensitivity = "public" | "internal" | "confidential" | "restricted";
export type AthenaContextCriticality = "critical" | "important" | "optional";
export type AthenaContextFailureBehavior = "stop" | "degrade" | "omit";
export type AthenaContextCacheKeyPolicy = "none" | "tenant_actor_permission_input";

export interface AthenaContextProviderInput {
  orgId: string;
  actor: { userId: string; role: CanonicalRole };
  selectedScope: AthenaSelectedScope;
  interaction?: Omit<AthenaInteractionContext, "voiceConfirmation">;
  deadline: Date;
  cancellationSignal: AbortSignal;
}

export interface AthenaContextProviderFetchResult<TData> {
  data: TData;
  itemCount: number;
  omittedFields: string[];
  sourceVersion?: string;
  sourceHash?: string;
}

export interface AthenaContextProviderDefinition<TData = unknown> {
  id: string;
  version: string;
  owner: string;
  name: string;
  priority: number;
  section: AthenaContextSectionName;
  description: string;
  permissions: string[];
  activation: AthenaContextActivationMode;
  allowedIntents: string[];
  requiredFeatureFlags?: string[];
  freshnessTtlMs: number;
  timeoutMs: number;
  maxItems: number;
  maxBytes: number;
  sensitivity: AthenaContextSensitivity;
  cacheKeyPolicy: AthenaContextCacheKeyPolicy;
  criticality: AthenaContextCriticality;
  failureBehavior: AthenaContextFailureBehavior;
  provide(input: AthenaContextProviderInput): Promise<AthenaContextProviderFetchResult<TData>>;
}

export interface AthenaContextDiscoveryActor { role: CanonicalRole; featureFlags: string[]; }

export interface AthenaContextAssemblyRequest {
  orgId: string;
  actor: { userId: string; role: CanonicalRole };
  permissions: string[];
  selectedScope: AthenaSelectedScope;
  interaction?: Omit<AthenaInteractionContext, "voiceConfirmation">;
  featureFlags: string[];
  requestedIntents: string[];
  explicitSections: AthenaContextSectionName[];
  clientSignal?: AbortSignal;
}

export type AthenaContextSectionReasonCode = "activated" | "not_activated" | "denied" | "degraded" | "omitted" | "stopped_by_critical_failure";
export interface AthenaContextAssemblyAudit { section: AthenaContextSectionName; providerId: string; version: string; reasonCode: AthenaContextSectionReasonCode; }
export interface AthenaContextAssemblyResult {
  sections: Partial<Record<AthenaContextSectionName, AthenaProviderSection>>;
  warnings: AthenaWarning[];
  audit: AthenaContextAssemblyAudit[];
  stoppedByCriticalFailure: boolean;
}
