import type { CanonicalRole } from "../../domain";

// A7 Memory contracts (docs/athena/roadmap/A7-memory-implementation-plan.md,
// C006 in docs/athena/contracts/README.md). AthenaMemoryRecord below carries
// every C006-required field verbatim plus the additional created/updated
// actor, timestamp, and audit-metadata fields docs/athena/08-memory/
// README.md's "Required Fields" section documents beyond the bare C006 wire
// shape - the same "layer additional audit fields around a numbered
// contract" posture A6 already established for AthenaAction/C005.
//
// Deliberately no separate top-level "stable key" field: C006 does not
// define one, and the compatibility rule ("new scopes require this Bible
// update") reads as a closed field list otherwise. The stable identity for
// dedup/upsert purposes (docs task Step 5) is the existing C006 tuple
// (orgId, scope, subjectId, kind) - e.g. kind "preference.response_style"
// IS the stable key, not an invented field alongside it.

export const athenaMemoryScopes = ["user", "organization", "project", "job", "conversation"] as const;
export type AthenaMemoryScope = (typeof athenaMemoryScopes)[number];

export const athenaMemoryStatuses = ["active", "corrected", "deleted"] as const;
export type AthenaMemoryStatus = (typeof athenaMemoryStatuses)[number];

export const athenaMemorySourceKinds = ["user_message", "approved_action", "application_record", "event", "document", "admin_policy"] as const;
export type AthenaMemorySourceKind = (typeof athenaMemorySourceKinds)[number];

// "trusted" is the load-bearing field for 09-security/README.md's "block
// external content from creating memory without trusted confirmation" and
// 08-memory/README.md's poisoning defenses - writePolicy.ts refuses to
// store/update any candidate whose source is not trusted.
export interface AthenaSourceReference {
  kind: AthenaMemorySourceKind;
  id?: string;
  trusted: boolean;
  description?: string;
}

export const athenaMemoryRetentionTiers = ["short_term", "standard", "long_term"] as const;
export type AthenaMemoryRetentionTier = (typeof athenaMemoryRetentionTiers)[number];

export interface AthenaRetentionPolicy {
  tier: AthenaMemoryRetentionTier;
  // ISO-8601. Absent means no automatic expiry. Already-past expiresAt is
  // rejected as invalid input at write time (writePolicy.ts) rather than
  // silently accepted and immediately excluded from every read.
  expiresAt?: string;
  legalHold?: boolean;
}

export interface AthenaMemoryActorRef {
  type: "user" | "system";
  id: string;
}

export const athenaMemoryVisibilities = ["actor", "organization"] as const;
export type AthenaMemoryVisibility = (typeof athenaMemoryVisibilities)[number];

// C006 AthenaMemoryRecord, verbatim required fields plus the documented
// optional/audit extensions. assertValidAthenaMemoryRecord
// (resultValidation.ts) is the runtime boundary that enforces exactly this
// field set for athena:contracts.
export interface AthenaMemoryRecord {
  id: string;
  version: "1.0.0";
  orgId: string;
  scope: AthenaMemoryScope;
  subjectId: string;
  kind: string;
  value: unknown;
  source: AthenaSourceReference;
  confidence: number;
  retention: AthenaRetentionPolicy;
  status: AthenaMemoryStatus;
  supersedes?: string;
  visibility: AthenaMemoryVisibility;
  createdByActor: AthenaMemoryActorRef;
  updatedByActor: AthenaMemoryActorRef;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string;
  metadata: Record<string, unknown>;
}

// Execution-identity shape reused from the actor model every other Athena
// module already uses (athena-kernel/types.ts's AthenaActorContext), not a
// parallel invention.
export interface AthenaMemoryActor {
  userId: string;
  orgId: string;
  role: CanonicalRole;
}

export interface AthenaMemoryWriteCandidate {
  orgId: string;
  actor: AthenaMemoryActor;
  scope: AthenaMemoryScope;
  // Required for "organization"/"project"/"job" scope validation at the
  // service layer (organization scope's subjectId must equal orgId itself -
  // see service.ts). Always required at the type level so a caller cannot
  // omit it and rely on an implicit default.
  subjectId: string;
  kind: string;
  value: unknown;
  source: AthenaSourceReference;
  // Optional: service.ts defaults confidence to 0.6 when absent (08-memory
  // "Source Attribution And Confidence": untrusted/stale/conflicting sources
  // reduce confidence, they do not require the caller to compute it).
  confidence?: number;
  retention?: Partial<AthenaRetentionPolicy>;
  metadata?: Record<string, unknown>;
}

export type AthenaMemoryWriteDecisionKind = "store" | "update" | "ignore";

// Malformed input (confidence out of [0,1], already-expired retention,
// wrong subjectId for the scope) is rejected earlier by service.ts as a
// thrown AthenaMemoryError("invalid_input"), not as one of these decision
// codes - writePolicy.ts only decides among well-formed candidates.
export type AthenaMemoryWriteReasonCode =
  | "athena_memory_created"
  | "athena_memory_updated_existing"
  | "athena_memory_duplicate_ignored"
  | "athena_memory_write_ignored_lower_rank_source"
  | "athena_memory_write_rejected_untrusted_source"
  | "athena_memory_write_rejected_prohibited_content";

export interface AthenaMemoryWriteDecision {
  decision: AthenaMemoryWriteDecisionKind;
  reasonCode: AthenaMemoryWriteReasonCode;
  // The confidence writePolicy will persist if the decision proceeds - may
  // differ from the candidate's own confidence (e.g. reduced for a
  // lower-rank-but-still-trusted source that is nonetheless allowed
  // through).
  confidence: number;
}

export interface AthenaMemoryWriteOutcome {
  decision: AthenaMemoryWriteDecisionKind;
  reasonCode: AthenaMemoryWriteReasonCode;
  // Present only when decision is "store" or "update".
  record?: AthenaMemoryRecord;
}

export interface AthenaMemoryRecallInput {
  orgId: string;
  actor: AthenaMemoryActor;
  scope: AthenaMemoryScope;
  subjectId: string;
  kind: string;
}

export interface AthenaMemoryGetByIdInput {
  orgId: string;
  actor: AthenaMemoryActor;
  id: string;
}

export interface AthenaMemorySearchInput {
  orgId: string;
  actor: AthenaMemoryActor;
  scope: AthenaMemoryScope;
  subjectId: string;
  kind?: string;
  limit?: number;
}

export interface AthenaMemoryListInput {
  orgId: string;
  actor: AthenaMemoryActor;
  scope: AthenaMemoryScope;
  subjectId: string;
  limit?: number;
}

export interface AthenaMemoryForgetByIdInput {
  orgId: string;
  actor: AthenaMemoryActor;
  scope: AthenaMemoryScope;
  subjectId: string;
  id: string;
}

export interface AthenaMemoryForgetByKeyInput {
  orgId: string;
  actor: AthenaMemoryActor;
  scope: AthenaMemoryScope;
  subjectId: string;
  kind: string;
}

export interface AthenaMemoryForgetAllInput {
  orgId: string;
  actor: AthenaMemoryActor;
  scope: AthenaMemoryScope;
  subjectId: string;
}

export interface AthenaMemoryForgetOutcome {
  deletedCount: number;
}

// Extension point for completed Athena Action Engine executions to
// eventually produce memory candidates (docs task brief Step 12). No
// default implementation exists anywhere in production code - the kernel's
// only production wiring is the hook call site itself
// (athena-kernel/service.ts), which is a no-op unless a caller supplies
// both a memoryService and an extractor. Deliberately shaped without any
// dependency on athena-action-engine's own types, so athena-memory stays
// decoupled from the action engine (the kernel, which already depends on
// both, does the narrowing at the call site) and so extraction logic - the
// actual "what does a completed action imply about durable memory"
// business decision - stays out of this infrastructure module entirely,
// left to "its correct layer" per the task brief.
export interface AthenaMemoryCandidateExtractionInput {
  orgId: string;
  actor: AthenaMemoryActor;
  action: {
    actionId: string;
    toolId: string;
    toolVersion: string;
    state: string;
    data: unknown;
  };
}

export type AthenaMemoryCandidateExtractor = (input: AthenaMemoryCandidateExtractionInput) => AthenaMemoryWriteCandidate[] | Promise<AthenaMemoryWriteCandidate[]>;
