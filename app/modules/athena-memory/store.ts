import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client";
import { runInDatabaseTransaction } from "../../db/requestSession";
import type { AthenaMemoryRecord, AthenaMemoryScope } from "./types";

// Application-service-owned persistence seam for A7 memory (mirrors
// athena-kernel/executionStore.ts's posture verbatim: this is the only file
// in athena-memory allowed to import Prisma/db/client - service.ts,
// writePolicy.ts, and every context-engine provider reach memory only
// through the AthenaMemoryRepository interface below, never this module's
// internals directly). Enforced by athena-memory.import-boundary.test.ts.

type AthenaMemoryRow = Awaited<ReturnType<typeof prisma.athenaMemory.findFirstOrThrow>>;

function toRecord(row: AthenaMemoryRow): AthenaMemoryRecord {
  return {
    id: row.id,
    version: "1.0.0",
    orgId: row.orgId,
    scope: row.scope as AthenaMemoryScope,
    subjectId: row.subjectId,
    kind: row.kind,
    value: row.valueJson,
    source: {
      kind: row.sourceKind as AthenaMemoryRecord["source"]["kind"],
      id: row.sourceId ?? undefined,
      trusted: row.sourceTrusted,
      description: row.sourceDescription ?? undefined,
    },
    confidence: row.confidence,
    retention: {
      tier: row.retentionTier as AthenaMemoryRecord["retention"]["tier"],
      expiresAt: row.retentionExpiresAt?.toISOString(),
      legalHold: row.retentionLegalHold,
    },
    status: row.status as AthenaMemoryRecord["status"],
    supersedes: row.supersedes ?? undefined,
    visibility: row.visibility as AthenaMemoryRecord["visibility"],
    createdByActor: { type: row.createdByActorType as "user" | "system", id: row.createdByActorId },
    updatedByActor: { type: row.updatedByActorType as "user" | "system", id: row.updatedByActorId },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastAccessedAt: row.lastAccessedAt?.toISOString(),
    metadata: (row.metadataJson as Record<string, unknown>) ?? {},
  };
}

function toCreateData(record: AthenaMemoryRecord) {
  return {
    id: record.id,
    orgId: record.orgId,
    scope: record.scope,
    subjectId: record.subjectId,
    kind: record.kind,
    valueJson: record.value as Prisma.InputJsonValue,
    sourceKind: record.source.kind,
    sourceId: record.source.id,
    sourceTrusted: record.source.trusted,
    sourceDescription: record.source.description,
    confidence: record.confidence,
    retentionTier: record.retention.tier,
    retentionExpiresAt: record.retention.expiresAt ? new Date(record.retention.expiresAt) : undefined,
    retentionLegalHold: record.retention.legalHold ?? false,
    status: record.status,
    supersedes: record.supersedes,
    visibility: record.visibility,
    createdByActorType: record.createdByActor.type,
    createdByActorId: record.createdByActor.id,
    updatedByActorType: record.updatedByActor.type,
    updatedByActorId: record.updatedByActor.id,
    metadataJson: record.metadata as Prisma.InputJsonValue,
  };
}

export interface AthenaMemoryRepository {
  findById(orgId: string, id: string): Promise<AthenaMemoryRecord | null>;
  findActiveByStableKey(orgId: string, scope: AthenaMemoryScope, subjectId: string, kind: string): Promise<AthenaMemoryRecord | null>;
  listActive(orgId: string, scope: AthenaMemoryScope, subjectId: string, kind: string | undefined, limit: number): Promise<AthenaMemoryRecord[]>;
  create(record: AthenaMemoryRecord): Promise<AthenaMemoryRecord>;
  // Atomically supersedes `previousId` (status -> "corrected") and inserts
  // `record` (status "active", supersedes: previousId) in one transaction,
  // so the partial unique index on (orgId, scope, subjectId, kind) where
  // status = 'active' is never violated by a legitimate correction.
  correct(orgId: string, previousId: string, record: AthenaMemoryRecord): Promise<AthenaMemoryRecord>;
  touchLastAccessed(orgId: string, id: string, at: string): Promise<void>;
  // Every forget* method scopes its WHERE clause by (orgId, scope,
  // subjectId) in addition to the target predicate, so a row outside the
  // caller's authorized ownership can never match - forgetting a memory ID
  // that exists but belongs to someone else structurally deletes nothing
  // rather than needing a separate authorization check to fail closed.
  forgetById(orgId: string, scope: AthenaMemoryScope, subjectId: string, id: string): Promise<number>;
  forgetByStableKey(orgId: string, scope: AthenaMemoryScope, subjectId: string, kind: string): Promise<number>;
  forgetAllForSubject(orgId: string, scope: AthenaMemoryScope, subjectId: string): Promise<number>;
}

export function createPrismaAthenaMemoryRepository(): AthenaMemoryRepository {
  return {
    // Deliberately not status/expiry-filtered: getById() is an explicit
    // "fetch this exact record" lookup (e.g. following a `supersedes`
    // chain), including corrected/deleted/expired rows for audit purposes -
    // a deleted row's value/metadata were already cleared at forget time
    // (see forgetById below), so returning it leaks nothing. Ownership is
    // still enforced by service.ts's getById() after this call.
    async findById(orgId, id) {
      const row = await prisma.athenaMemory.findFirst({ where: { id, orgId } });
      return row ? toRecord(row) : null;
    },

    // Deliberately NOT expiry-filtered, unlike every other read method here:
    // remember()/writePolicy.ts use this to find the current active row (if
    // any) for a stable key so a "store" decision never collides with the
    // partial unique index on (orgId, scope, subjectId, kind) where status
    // = 'active' - an expired-but-still-active-status row must still be
    // seen here so it gets superseded (writePolicy's "update" decision)
    // rather than raced against by a duplicate create(). service.ts's
    // recall() is the caller-facing read path and applies its own expiry
    // check on the result.
    async findActiveByStableKey(orgId, scope, subjectId, kind) {
      const row = await prisma.athenaMemory.findFirst({ where: { orgId, scope, subjectId, kind, status: "active" } });
      return row ? toRecord(row) : null;
    },

    async listActive(orgId, scope, subjectId, kind, limit) {
      const now = new Date();
      const rows = await prisma.athenaMemory.findMany({
        where: {
          orgId,
          scope,
          subjectId,
          status: "active",
          ...(kind ? { kind } : {}),
          OR: [{ retentionExpiresAt: null }, { retentionExpiresAt: { gt: now } }],
        },
        // Deterministic ordering (docs task Step 7): newest first, id as a
        // stable tiebreak for records created within the same millisecond.
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: limit,
      });
      return rows.map(toRecord);
    },

    async create(record) {
      const row = await prisma.athenaMemory.create({ data: toCreateData(record) });
      return toRecord(row);
    },

    // Every real request already runs inside runWithDatabaseSession's own
    // outer transaction, and Prisma does not allow a nested $transaction()
    // on that already-active Prisma.TransactionClient. runInDatabaseTransaction
    // (app/db/requestSession.ts, same helper JobsService's own mutations
    // use) reuses that ambient transaction when one is active and opens a
    // real one only for callers outside a request session (e.g. a script or
    // background job) - so this correction is still atomic either way.
    async correct(orgId, previousId, record) {
      const created = await runInDatabaseTransaction(prisma, async (tx) => {
        await tx.athenaMemory.update({ where: { id: previousId, orgId }, data: { status: "corrected" } });
        return tx.athenaMemory.create({ data: toCreateData(record) });
      });
      return toRecord(created);
    },

    async touchLastAccessed(orgId, id, at) {
      await prisma.athenaMemory.updateMany({ where: { id, orgId }, data: { lastAccessedAt: new Date(at) } });
    },

    async forgetById(orgId, scope, subjectId, id) {
      // Value/metadata are cleared, not merely flagged - 08-memory/README.md
      // "Deleted memories stop being used in planning and context assembly"
      // is satisfied by status alone, but a real "forget" should not retain
      // the forgotten content itself; id/kind/scope/timestamps remain for
      // audit ("Suspicious memory changes are auditable and revocable").
      const result = await prisma.athenaMemory.updateMany({
        where: { id, orgId, scope, subjectId, status: { not: "deleted" } },
        data: { status: "deleted", valueJson: Prisma.JsonNull, metadataJson: {} },
      });
      return result.count;
    },

    async forgetByStableKey(orgId, scope, subjectId, kind) {
      const result = await prisma.athenaMemory.updateMany({
        where: { orgId, scope, subjectId, kind, status: { not: "deleted" } },
        data: { status: "deleted", valueJson: Prisma.JsonNull, metadataJson: {} },
      });
      return result.count;
    },

    async forgetAllForSubject(orgId, scope, subjectId) {
      const result = await prisma.athenaMemory.updateMany({
        where: { orgId, scope, subjectId, status: { not: "deleted" } },
        data: { status: "deleted", valueJson: Prisma.JsonNull, metadataJson: {} },
      });
      return result.count;
    },
  };
}
