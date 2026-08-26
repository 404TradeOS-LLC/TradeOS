import { randomUUID } from "node:crypto";
import type { AthenaMemoryRepository } from "../store";
import type { AthenaMemoryRecord, AthenaMemoryScope } from "../types";

// Test-only in-memory AthenaMemoryRepository, same posture as
// athena-tool-registry/fixtures/*.ts and athena-action-engine's
// createInMemoryAthenaIdempotencyStore(). Never registered outside test
// setup - production always uses store.ts's createPrismaAthenaMemoryRepository().
export function createInMemoryAthenaMemoryRepository(): AthenaMemoryRepository {
  const rows = new Map<string, AthenaMemoryRecord>();

  const isVisible = (record: AthenaMemoryRecord, now: Date) => record.status === "active" && (!record.retention.expiresAt || new Date(record.retention.expiresAt) > now);

  return {
    async findById(orgId, id) {
      const record = rows.get(id);
      return record && record.orgId === orgId ? { ...record } : null;
    },

    async findActiveByStableKey(orgId, scope, subjectId, kind) {
      for (const record of rows.values()) {
        if (record.orgId === orgId && record.scope === scope && record.subjectId === subjectId && record.kind === kind && record.status === "active") {
          return { ...record };
        }
      }
      return null;
    },

    async listActive(orgId, scope, subjectId, kind, limit) {
      const now = new Date();
      const matches = [...rows.values()]
        .filter((record) => record.orgId === orgId && record.scope === scope && record.subjectId === subjectId && (!kind || record.kind === kind) && isVisible(record, now))
        .sort((a, b) => (a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : b.createdAt.localeCompare(a.createdAt)));
      return matches.slice(0, limit).map((record) => ({ ...record }));
    },

    async create(record) {
      const stored: AthenaMemoryRecord = { ...record, id: record.id || randomUUID() };
      rows.set(stored.id, stored);
      return { ...stored };
    },

    async correct(orgId, previousId, record) {
      const previous = rows.get(previousId);
      if (previous && previous.orgId === orgId) {
        rows.set(previousId, { ...previous, status: "corrected" });
      }
      const stored: AthenaMemoryRecord = { ...record, id: record.id || randomUUID() };
      rows.set(stored.id, stored);
      return { ...stored };
    },

    async touchLastAccessed(orgId, id, at) {
      const record = rows.get(id);
      if (record && record.orgId === orgId) {
        rows.set(id, { ...record, lastAccessedAt: at });
      }
    },

    async forgetById(orgId, scope, subjectId, id) {
      const record = rows.get(id);
      if (!record || record.orgId !== orgId || record.scope !== (scope as AthenaMemoryScope) || record.subjectId !== subjectId || record.status === "deleted") return 0;
      rows.set(id, { ...record, status: "deleted", value: null, metadata: {} });
      return 1;
    },

    async forgetByStableKey(orgId, scope, subjectId, kind) {
      let count = 0;
      for (const [id, record] of rows) {
        if (record.orgId === orgId && record.scope === scope && record.subjectId === subjectId && record.kind === kind && record.status !== "deleted") {
          rows.set(id, { ...record, status: "deleted", value: null, metadata: {} });
          count += 1;
        }
      }
      return count;
    },

    async forgetAllForSubject(orgId, scope, subjectId) {
      let count = 0;
      for (const [id, record] of rows) {
        if (record.orgId === orgId && record.scope === scope && record.subjectId === subjectId && record.status !== "deleted") {
          rows.set(id, { ...record, status: "deleted", value: null, metadata: {} });
          count += 1;
        }
      }
      return count;
    },
  };
}
