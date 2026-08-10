import { randomUUID } from "node:crypto";
import type { DomainPermission } from "../../domain";
import { evaluateAthenaPermission } from "../athena-permissions/policy";
import { AthenaMemoryError, athenaMemoryAuthorizationDeniedError, athenaMemoryInvalidInputError, athenaMemoryStorageUnavailableError } from "./errors";
import { createPrismaAthenaMemoryRepository } from "./store";
import type { AthenaMemoryRepository } from "./store";
import { ATHENA_MEMORY_DEFAULT_CONFIDENCE, evaluateAthenaMemoryWritePolicy } from "./writePolicy";
import type {
  AthenaMemoryActor,
  AthenaMemoryForgetAllInput,
  AthenaMemoryForgetByIdInput,
  AthenaMemoryForgetByKeyInput,
  AthenaMemoryForgetOutcome,
  AthenaMemoryGetByIdInput,
  AthenaMemoryListInput,
  AthenaMemoryRecallInput,
  AthenaMemoryRecord,
  AthenaMemoryScope,
  AthenaMemorySearchInput,
  AthenaMemoryWriteCandidate,
  AthenaMemoryWriteOutcome,
} from "./types";

// A7 Memory Service (docs/athena/roadmap/A7-memory-implementation-plan.md;
// docs/athena/reviews/A0.5-architecture-review.md MEDIUM-013 "Define
// AthenaMemoryService as the service boundary for memory reads/writes").
// This is the *only* supported way the rest of Athena touches memory - the
// Context Engine's memory provider (athena-context-engine/providers/
// memoryProvider.ts) and the kernel's execution-completion hook
// (athena-kernel/service.ts) both call this module, never
// store.ts/repository internals directly.
//
// Isolation posture, applied uniformly below:
// - A caller whose actor.orgId does not match the request's orgId is denied
//   outright on every operation - never a legitimate "let me check" query.
// - Read operations (recall/getById/search/list) never distinguish "does
//   not exist" from "exists but is not yours": an ownership mismatch
//   returns null/an empty list, exactly like athena-tool-registry/errors.ts
//   and athena-action-engine/errors.ts already fold not-found into denied
//   for the same anti-enumeration reason - there is nothing to leak by
//   staying silent.
// - Write/delete operations (remember/forget*) throw
//   athenaMemoryAuthorizationDeniedError on an ownership or role/capability
//   violation - a mutation attempt has nothing to leak by failing loudly,
//   and a caller who made a mistake benefits from an explicit error.

const DEFAULT_SEARCH_LIMIT = 50;
const MAX_SEARCH_LIMIT = 200;

function assertCallerOrgMatches(orgId: string, actor: AthenaMemoryActor, correlationId: string): void {
  if (!orgId || actor.orgId !== orgId) {
    throw athenaMemoryAuthorizationDeniedError(correlationId);
  }
}

function isSubjectReadableByActor(scope: AthenaMemoryScope, subjectId: string, orgId: string, actor: AthenaMemoryActor): boolean {
  if (scope === "user" || scope === "conversation") return subjectId === actor.userId;
  if (scope === "organization") return subjectId === orgId;
  // project/job: A7 infrastructure-only conservative default - readable by
  // any org member. Per-job/per-project actor scoping mirrors the same
  // still-unresolved HIGH-P3 object-scope prerequisite
  // athena-permissions/types.ts's AthenaResourceRequest already documents
  // for every entity besides "job", and is deliberately not implemented
  // here rather than approximated.
  return true;
}

// Non-tool "memory_write" capability (athena-permissions/types.ts). User/
// conversation-scope writes require no role-specific permission - ownership
// (checked separately, see isSubjectReadableByActor's write-side sibling
// below) is the only gate, matching 08-memory/README.md's "User preference
// memory: user-owned and deletable." Organization/project/job-scope writes
// require settings.manage, the same permission - and the same
// owner/admin/dispatcher role set as current_app_can_administer() in the
// migration's RLS policies - already used for organization-level
// configuration elsewhere in this codebase, matching "Organization memory:
// Admin-managed with audit."
async function authorizeMemoryWrite(orgId: string, actor: AthenaMemoryActor, scope: AthenaMemoryScope, correlationId: string): Promise<void> {
  const requiredPermissions: DomainPermission[] = scope === "user" || scope === "conversation" ? [] : ["settings.manage"];
  const decision = await evaluateAthenaPermission({
    rawRole: actor.role,
    orgId,
    userId: actor.userId,
    request: { kind: "memory_write", id: `tradeos.athena.memory.${scope}`, requiredPermissions },
  });
  if (decision.decision !== "allow") {
    throw athenaMemoryAuthorizationDeniedError(correlationId);
  }
}

// Every repository call in this module is routed through here so a raw
// Prisma/storage error (connection failure, constraint violation, etc.)
// never leaks past the Memory Service boundary uncontrolled (docs task
// brief Step 11: "Memory/storage-specific implementation errors must not
// leak uncontrolled through public Athena interfaces"). AthenaMemoryError
// instances already carry a safe public shape and pass through unchanged;
// anything else is normalized to a generic, retryable storage error with no
// raw message/stack forwarded - the same "one place errors are normalized"
// posture as athena-kernel/errors.ts's normalizeAthenaError.
async function runRepositoryOp<T>(op: () => Promise<T>, correlationId: string): Promise<T> {
  try {
    return await op();
  } catch (error) {
    if (error instanceof AthenaMemoryError) throw error;
    throw athenaMemoryStorageUnavailableError(correlationId);
  }
}

function isExpired(record: AthenaMemoryRecord): boolean {
  return Boolean(record.retention.expiresAt) && new Date(record.retention.expiresAt as string).getTime() <= Date.now();
}

function clampLimit(limit: number | undefined): number {
  if (!limit || !Number.isFinite(limit) || limit <= 0) return DEFAULT_SEARCH_LIMIT;
  return Math.min(Math.floor(limit), MAX_SEARCH_LIMIT);
}

export interface AthenaMemoryServiceDeps {
  repository?: AthenaMemoryRepository;
}

export interface AthenaMemoryService {
  remember(input: AthenaMemoryWriteCandidate): Promise<AthenaMemoryWriteOutcome>;
  recall(input: AthenaMemoryRecallInput): Promise<AthenaMemoryRecord | null>;
  getById(input: AthenaMemoryGetByIdInput): Promise<AthenaMemoryRecord | null>;
  search(input: AthenaMemorySearchInput): Promise<AthenaMemoryRecord[]>;
  list(input: AthenaMemoryListInput): Promise<AthenaMemoryRecord[]>;
  forget(input: AthenaMemoryForgetByIdInput): Promise<AthenaMemoryForgetOutcome>;
  forgetByKey(input: AthenaMemoryForgetByKeyInput): Promise<AthenaMemoryForgetOutcome>;
  forgetAllForSubject(input: AthenaMemoryForgetAllInput): Promise<AthenaMemoryForgetOutcome>;
}

export function createAthenaMemoryService(deps: AthenaMemoryServiceDeps = {}): AthenaMemoryService {
  const repository = deps.repository ?? createPrismaAthenaMemoryRepository();

  return {
    async remember(input) {
      const correlationId = randomUUID();
      assertCallerOrgMatches(input.orgId, input.actor, correlationId);

      if (!input.subjectId || !input.kind) {
        throw athenaMemoryInvalidInputError(correlationId, "orgId, subjectId, and kind are required.");
      }
      if (input.scope === "organization" && input.subjectId !== input.orgId) {
        throw athenaMemoryInvalidInputError(correlationId, "Organization-scoped memory subjectId must equal the organization id.");
      }
      if ((input.scope === "user" || input.scope === "conversation") && input.subjectId !== input.actor.userId) {
        throw athenaMemoryAuthorizationDeniedError(correlationId);
      }

      const confidence = input.confidence ?? ATHENA_MEMORY_DEFAULT_CONFIDENCE;
      if (confidence < 0 || confidence > 1) {
        throw athenaMemoryInvalidInputError(correlationId, "confidence must be between 0 and 1.");
      }
      if (input.retention?.expiresAt && new Date(input.retention.expiresAt).getTime() <= Date.now()) {
        throw athenaMemoryInvalidInputError(correlationId, "retention.expiresAt must be in the future.");
      }
      if (typeof input.metadata !== "undefined" && (typeof input.metadata !== "object" || input.metadata === null || Array.isArray(input.metadata))) {
        throw athenaMemoryInvalidInputError(correlationId, "metadata must be an object.");
      }

      await authorizeMemoryWrite(input.orgId, input.actor, input.scope, correlationId);

      const existing = await runRepositoryOp(() => repository.findActiveByStableKey(input.orgId, input.scope, input.subjectId, input.kind), correlationId);
      const decision = evaluateAthenaMemoryWritePolicy(input, confidence, existing);

      if (decision.decision === "ignore") {
        return { decision: decision.decision, reasonCode: decision.reasonCode };
      }

      const now = new Date().toISOString();
      const actorRef = { type: "user" as const, id: input.actor.userId };
      const visibility = input.scope === "user" || input.scope === "conversation" ? ("actor" as const) : ("organization" as const);

      if (decision.decision === "store") {
        const record: AthenaMemoryRecord = {
          id: randomUUID(),
          version: "1.0.0",
          orgId: input.orgId,
          scope: input.scope,
          subjectId: input.subjectId,
          kind: input.kind,
          value: input.value,
          source: input.source,
          confidence: decision.confidence,
          retention: {
            tier: input.retention?.tier ?? "standard",
            expiresAt: input.retention?.expiresAt,
            legalHold: input.retention?.legalHold ?? false,
          },
          status: "active",
          visibility,
          createdByActor: actorRef,
          updatedByActor: actorRef,
          createdAt: now,
          updatedAt: now,
          metadata: input.metadata ?? {},
        };
        const created = await runRepositoryOp(() => repository.create(record), correlationId);
        return { decision: "store", reasonCode: decision.reasonCode, record: created };
      }

      // decision.decision === "update": existing is guaranteed non-null here
      // (evaluateAthenaMemoryWritePolicy only returns "update" when an
      // existing active record was passed in).
      const previous = existing as AthenaMemoryRecord;
      const record: AthenaMemoryRecord = {
        id: randomUUID(),
        version: "1.0.0",
        orgId: input.orgId,
        scope: input.scope,
        subjectId: input.subjectId,
        kind: input.kind,
        value: input.value,
        source: input.source,
        confidence: decision.confidence,
        retention: {
          tier: input.retention?.tier ?? previous.retention.tier,
          expiresAt: input.retention?.expiresAt ?? previous.retention.expiresAt,
          legalHold: input.retention?.legalHold ?? previous.retention.legalHold,
        },
        status: "active",
        supersedes: previous.id,
        visibility,
        createdByActor: previous.createdByActor,
        updatedByActor: actorRef,
        createdAt: now,
        updatedAt: now,
        metadata: input.metadata ?? {},
      };
      const corrected = await runRepositoryOp(() => repository.correct(input.orgId, previous.id, record), correlationId);
      return { decision: "update", reasonCode: decision.reasonCode, record: corrected };
    },

    async recall(input) {
      const correlationId = randomUUID();
      assertCallerOrgMatches(input.orgId, input.actor, correlationId);
      if (!isSubjectReadableByActor(input.scope, input.subjectId, input.orgId, input.actor)) {
        return null;
      }

      const record = await runRepositoryOp(() => repository.findActiveByStableKey(input.orgId, input.scope, input.subjectId, input.kind), correlationId);
      // findActiveByStableKey deliberately does not filter expiry (see its
      // own comment in store.ts) - recall() is the caller-facing read, so
      // it applies the exclusion docs task Step 7 requires here.
      if (!record || isExpired(record)) return null;

      try {
        await repository.touchLastAccessed(input.orgId, record.id, new Date().toISOString());
      } catch {
        // Last-accessed bookkeeping must never fail a real read, same
        // posture as athena-kernel/service.ts's telemetry-failure handling.
      }
      return record;
    },

    async getById(input) {
      const correlationId = randomUUID();
      assertCallerOrgMatches(input.orgId, input.actor, correlationId);

      const record = await runRepositoryOp(() => repository.findById(input.orgId, input.id), correlationId);
      if (!record) return null;
      if (!isSubjectReadableByActor(record.scope, record.subjectId, input.orgId, input.actor)) {
        // Deliberately the same null a nonexistent id produces above - see
        // this module's isolation-posture comment.
        return null;
      }

      try {
        await repository.touchLastAccessed(input.orgId, record.id, new Date().toISOString());
      } catch {
        // See recall()'s identical comment.
      }
      return record;
    },

    async search(input) {
      const correlationId = randomUUID();
      assertCallerOrgMatches(input.orgId, input.actor, correlationId);
      if (!isSubjectReadableByActor(input.scope, input.subjectId, input.orgId, input.actor)) {
        return [];
      }
      return runRepositoryOp(() => repository.listActive(input.orgId, input.scope, input.subjectId, input.kind, clampLimit(input.limit)), correlationId);
    },

    async list(input) {
      const correlationId = randomUUID();
      assertCallerOrgMatches(input.orgId, input.actor, correlationId);
      if (!isSubjectReadableByActor(input.scope, input.subjectId, input.orgId, input.actor)) {
        return [];
      }
      return runRepositoryOp(() => repository.listActive(input.orgId, input.scope, input.subjectId, undefined, clampLimit(input.limit)), correlationId);
    },

    async forget(input) {
      const correlationId = randomUUID();
      assertCallerOrgMatches(input.orgId, input.actor, correlationId);
      if ((input.scope === "user" || input.scope === "conversation") && input.subjectId !== input.actor.userId) {
        throw athenaMemoryAuthorizationDeniedError(correlationId);
      }
      await authorizeMemoryWrite(input.orgId, input.actor, input.scope, correlationId);
      const deletedCount = await runRepositoryOp(() => repository.forgetById(input.orgId, input.scope, input.subjectId, input.id), correlationId);
      return { deletedCount };
    },

    async forgetByKey(input) {
      const correlationId = randomUUID();
      assertCallerOrgMatches(input.orgId, input.actor, correlationId);
      if ((input.scope === "user" || input.scope === "conversation") && input.subjectId !== input.actor.userId) {
        throw athenaMemoryAuthorizationDeniedError(correlationId);
      }
      await authorizeMemoryWrite(input.orgId, input.actor, input.scope, correlationId);
      const deletedCount = await runRepositoryOp(() => repository.forgetByStableKey(input.orgId, input.scope, input.subjectId, input.kind), correlationId);
      return { deletedCount };
    },

    async forgetAllForSubject(input) {
      const correlationId = randomUUID();
      assertCallerOrgMatches(input.orgId, input.actor, correlationId);
      if ((input.scope === "user" || input.scope === "conversation") && input.subjectId !== input.actor.userId) {
        throw athenaMemoryAuthorizationDeniedError(correlationId);
      }
      await authorizeMemoryWrite(input.orgId, input.actor, input.scope, correlationId);
      const deletedCount = await runRepositoryOp(() => repository.forgetAllForSubject(input.orgId, input.scope, input.subjectId), correlationId);
      return { deletedCount };
    },
  };
}
