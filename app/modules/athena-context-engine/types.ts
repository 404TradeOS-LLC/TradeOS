import type { CanonicalRole } from "../../domain";
import type { AthenaFreshnessEvidence, AthenaProviderSection, AthenaSelectedScope, AthenaWarning } from "../athena-kernel/types";

export type { AthenaFreshnessEvidence, AthenaProviderSection, AthenaSelectedScope };

// A3 Context Engine contracts (docs/athena/roadmap/
// A3-context-engine-implementation-plan.md "Minimal Context Provider
// Contract/Interfaces"), narrowed from C010 in docs/athena/contracts/README.md
// the same way A2's athena-tool-registry/types.ts narrowed C002. Reuses
// AthenaFreshnessEvidence/AthenaProviderSection/AthenaSelectedScope from
// athena-kernel/types.ts (type-only imports, erased at compile time) instead
// of duplicating them, since those are the fields that show up directly on
// AthenaAIContext.

// The only C001 section names an A3 provider may declare. Keeps the
// assembler from writing an arbitrary provider-supplied key onto the
// context object - every section this catalog allows already exists as a
// named optional field on AthenaAIContext.
export const ATHENA_CONTEXT_SECTIONS = ["knowledgeEngine", "dispatch", "weather", "calendar", "customers", "costbook", "inventory", "notifications"] as const;
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
  deadline: Date;
  cancellationSignal: AbortSignal;
  // Deliberately no Prisma client, request-scoped transaction handle, or
  // getRequestDatabaseClient() reference - providers reach application
  // services only (see the import-boundary test). Whoever calls
  // assembleAthenaContext() is responsible for already running inside a
  // properly-scoped database session; the assembler does not open one.
}

export interface AthenaContextProviderFetchResult<TData> {
  data: TData;
  // Self-reported by the provider so the assembler can validate against
  // maxItems without needing to understand the shape of arbitrary provider
  // data (docs/athena/roadmap/A3-context-engine-implementation-plan.md
  // "Context Minimization, Sensitivity, And Redaction": "maxItems ...
  // enforced by the assembler, not trusted from the provider").
  itemCount: number;
  omittedFields: string[];
  sourceVersion?: string;
  sourceHash?: string;
}

export interface AthenaContextProviderDefinition<TData = unknown> {
  id: string;
  version: string;
  owner: string;
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
  fetch(input: AthenaContextProviderInput): Promise<AthenaContextProviderFetchResult<TData>>;
}

export interface AthenaContextDiscoveryActor {
  role: CanonicalRole;
  featureFlags: string[];
}

export interface AthenaContextAssemblyRequest {
  orgId: string;
  actor: { userId: string; role: CanonicalRole };
  selectedScope: AthenaSelectedScope;
  featureFlags: string[];
  // Which lazy_intent providers may activate this assembly - matched
  // against each provider's own allowedIntents. Empty until A5's planner
  // supplies real intents; A3 exercises this with placeholder intent names
  // on its two providers plus a fixture provider in tests.
  requestedIntents: string[];
  // Section names an explicit_only provider is allowed to activate for -
  // distinct from requestedIntents so "the user asked for this specific
  // section" (explicit_only) stays a different signal from "the planner
  // classified this intent" (lazy_intent).
  explicitSections: AthenaContextSectionName[];
  clientSignal?: AbortSignal;
}

export type AthenaContextSectionReasonCode = "activated" | "not_activated" | "denied" | "degraded" | "omitted" | "stopped_by_critical_failure";

export interface AthenaContextAssemblyAudit {
  section: AthenaContextSectionName;
  providerId: string;
  version: string;
  reasonCode: AthenaContextSectionReasonCode;
}

export interface AthenaContextAssemblyResult {
  sections: Partial<Record<AthenaContextSectionName, AthenaProviderSection>>;
  warnings: AthenaWarning[];
  audit: AthenaContextAssemblyAudit[];
  stoppedByCriticalFailure: boolean;
}
