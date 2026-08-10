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

// A7 Memory Service. This is the only supported Athena memory boundary.
// Project/job memory remains fail-closed until those scopes have explicit
// object-level authorization. Org membership alone is never treated as
// authority to read or mutate an arbitrary project/job memory subject.

const DEFAULT_SEARCH_LIMIT = 50;
const MAX_SEARCH_LIMIT = 200;
const FAIL_CLOSED_OBJECT_SCOPES = new Set<AthenaMemoryScope>(["project", "job"]);

function assertCallerOrgMatches(orgId: string, actor: AthenaMemoryActor, correlationId: string): void {
  if (!orgId || actor.orgId !== orgId) {
    throw athenaMemoryAuthorizationDeniedError(correlationId);
  }
}

function isSubjectReadableByActor(scope: AthenaMemoryScope, subjectId: string, orgId: string, actor: AthenaMemoryActor): boolean {
  if (scope === "user" || scope === "conversation") return subjectId === actor.userId;
  if (scope === "organization") return subjectId === orgId;
  // A7 does not yet have a complete object-scope resolver for project/job
  // memory. Failing closed prevents cross-project/job leakage inside an org.
  return false;
}

function assertWritableSubject(scope: AthenaMemoryScope, subjectId: string, orgId: string, actor: AthenaMemoryActor, correlationId: string): void {
  if (FAIL_CLOSED_OBJECT_SCOPES.has(scope)) {
    throw athenaMemoryAuthorizationDeniedError(correlationId);
  }
  if (scope === "organization" && subjectId !== orgId) {
    throw athenaMemoryInvalidInputError(correlationId, "Organization-scoped memory subjectId must equal the organization id.");
  }
  if ((scope === "user" || scope === "conversation") && subjectId !== actor.userId) {
    throw athenaMemoryAuthorizationDeniedError(correlationId);
  }
}

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

function isCallerVisibleRecord(record: AthenaMemoryRecord): boolean {
  return record.status === "active" && !isExpired(record);
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
      assertWritableSubject(input.scope, input.subjectId, input.orgId, input.actor, correlationId);

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
      if (!isSubjectReadableByActor(input.scope, input.subjectId, input.orgId, input.actor)) return null;

      const record = await runRepositoryOp(() => repository.findActiveByStableKey(input.orgId, input.scope, input.subjectId, input.kind), correlationId);
      if (!record || !isCallerVisibleRecord(record)) return null;

      try {
        await repository.touchLastAccessed(input.orgId, record.id, new Date().toISOString());
      } catch {
        // Access bookkeeping is non-critical to a successful read.
      }
      return record;
    },

    async getById(input) {
      const correlationId = randomUUID();
      assertCallerOrgMatches(input.orgId, input.actor, correlationId);

      const record = await runRepositoryOp(() => repository.findById(input.orgId, input.id), correlationId);
      if (!record || !isCallerVisibleRecord(record)) return null;
      if (!isSubjectReadableByActor(record.scope, record.subjectId, input.orgId, input.actor)) return null;

      try {
        await repository.touchLastAccessed(input.orgId, record.id, new Date().toISOString());
      } catch {
        // Access bookkeeping is non-critical to a successful read.
      }
      return record;
    },

    async search(input) {
      const correlationId = randomUUID();
      assertCallerOrgMatches(input.orgId, input.actor, correlationId);
      if (!isSubjectReadableByActor(input.scope, input.subjectId, input.orgId, input.actor)) return [];
      return runRepositoryOp(() => repository.listActive(input.orgId, input.scope, input.subjectId, input.kind, clampLimit(input.limit)), correlationId);
    },

    async list(input) {
      const correlationId = randomUUID();
      assertCallerOrgMatches(input.orgId, input.actor, correlationId);
      if (!isSubjectReadableByActor(input.scope, input.subjectId, input.orgId, input.actor)) return [];
      return runRepositoryOp(() => repository.listActive(input.orgId, input.scope, input.subjectId, undefined, clampLimit(input.limit)), correlationId);
    },

    async forget(input) {
      const correlationId = randomUUID();
      assertCallerOrgMatches(input.orgId, input.actor, correlationId);
      assertWritableSubject(input.scope, input.subjectId, input.orgId, input.actor, correlationId);
      await authorizeMemoryWrite(input.orgId, input.actor, input.scope, correlationId);
      const deletedCount = await runRepositoryOp(() => repository.forgetById(input.orgId, input.scope, input.subjectId, input.id), correlationId);
      return { deletedCount };
    },

    async forgetByKey(input) {
      const correlationId = randomUUID();
      assertCallerOrgMatches(input.orgId, input.actor, correlationId);
      assertWritableSubject(input.scope, input.subjectId, input.orgId, input.actor, correlationId);
      await authorizeMemoryWrite(input.orgId, input.actor, input.scope, correlationId);
      const deletedCount = await runRepositoryOp(() => repository.forgetByStableKey(input.orgId, input.scope, input.subjectId, input.kind), correlationId);
      return { deletedCount };
    },

    async forgetAllForSubject(input) {
      const correlationId = randomUUID();
      assertCallerOrgMatches(input.orgId, input.actor, correlationId);
      assertWritableSubject(input.scope, input.subjectId, input.orgId, input.actor, correlationId);
      await authorizeMemoryWrite(input.orgId, input.actor, input.scope, correlationId);
      const deletedCount = await runRepositoryOp(() => repository.forgetAllForSubject(input.orgId, input.scope, input.subjectId), correlationId);
      return { deletedCount };
    },
  };
}
