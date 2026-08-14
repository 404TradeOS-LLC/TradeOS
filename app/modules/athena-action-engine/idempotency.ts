import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client";
import { computeCanonicalInputHash } from "./inputHash";
import type { AthenaAction, AthenaActionResult } from "./types";

export interface AthenaCompletedActionOutcome<TData = unknown> {
  action: AthenaAction;
  result: AthenaActionResult<TData>;
}

export interface AthenaIdempotencyReservation<TData = unknown> {
  outcome: "new" | "duplicate";
  // Populated on "duplicate" once the original attempt has completed.
  // Undefined means the original reservation is still in flight; callers
  // must fail closed rather than execute the same action concurrently.
  existing?: AthenaCompletedActionOutcome<TData>;
}

export interface AthenaIdempotencyStore {
  // Atomically claims `scopeKey` for one canonical validated-input identity if
  // unclaimed, or reports the existing attempt's outcome if already claimed.
  // Reusing the same key for different validated input must fail closed.
  reserve<TData = unknown>(scopeKey: string, inputHash: string): Promise<AthenaIdempotencyReservation<TData>>;
  // Records the terminal action/result for a previously reserved key so
  // later duplicate calls can return them instead of re-invoking the tool.
  complete<TData = unknown>(scopeKey: string, outcome: AthenaCompletedActionOutcome<TData>): Promise<void>;
  // Releases a reservation without recording a result. Production uses this
  // only inside the request/background RLS transaction, so a rollback also
  // removes an uncommitted reservation after process/request failure.
  release(scopeKey: string): Promise<void>;
}

interface InMemoryEntry {
  inputHash: string;
  outcome?: AthenaCompletedActionOutcome;
}

// Test/local fixture. Production must inject createPrismaAthenaIdempotencyStore().
export function createInMemoryAthenaIdempotencyStore(): AthenaIdempotencyStore {
  const entries = new Map<string, InMemoryEntry>();

  return {
    async reserve(scopeKey, inputHash) {
      const existing = entries.get(scopeKey);
      if (existing) {
        if (existing.inputHash !== inputHash) {
          throw new Error("Athena idempotency key was already used for different validated input");
        }
        return { outcome: "duplicate", existing: existing.outcome } as AthenaIdempotencyReservation<never>;
      }
      entries.set(scopeKey, { inputHash });
      return { outcome: "new" };
    },
    async complete(scopeKey, outcome) {
      const inputHash = computeCanonicalInputHash(outcome.action.input);
      const existing = entries.get(scopeKey);
      if (!existing || existing.inputHash !== inputHash) {
        throw new Error("Athena idempotency completion did not own the matching input reservation");
      }
      entries.set(scopeKey, { inputHash, outcome });
    },
    async release(scopeKey) {
      entries.delete(scopeKey);
    },
  };
}

interface ParsedScopeKey {
  orgId: string;
  toolId: string;
  toolVersion: string;
  idempotencyKey: string;
}

interface DurableIdempotencyRow {
  inputHash: string;
  status: "reserved" | "completed";
  actionJson: unknown | null;
  resultJson: unknown | null;
}

function parseAthenaIdempotencyScopeKey(scopeKey: string): ParsedScopeKey {
  const [orgId, toolId, toolVersion, ...keyParts] = scopeKey.split("::");
  const idempotencyKey = keyParts.join("::");
  if (!orgId || !toolId || !toolVersion || !idempotencyKey) {
    throw new Error("Invalid Athena idempotency scope key");
  }
  return { orgId, toolId, toolVersion, idempotencyKey };
}

// Durable A6 production implementation. The unique database key serializes
// concurrent claims across API instances. Because the production controller
// runs inside databaseSession/requestSession, reservation, business mutation,
// and completion share the same RLS transaction: a crash/rollback cannot
// leave a committed phantom reservation, while a concurrent claimant waits
// for the first transaction and then observes its committed result.
//
// actor_user_id is derived from current_app_user_id() inside PostgreSQL and
// RLS restricts every operation to that exact actor+organization. A same-org
// key collision from another user therefore fails closed instead of exposing
// the first actor's persisted action result. input_hash is persisted at claim
// time, so one literal key can never be silently reused for a different action
// payload even before the original attempt completes.
export function createPrismaAthenaIdempotencyStore(): AthenaIdempotencyStore {
  return {
    async reserve<TData = unknown>(scopeKey: string, inputHash: string): Promise<AthenaIdempotencyReservation<TData>> {
      const identity = parseAthenaIdempotencyScopeKey(scopeKey);
      const inserted = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        insert into athena_action_idempotency (
          id,
          org_id,
          actor_user_id,
          tool_id,
          tool_version,
          idempotency_key,
          input_hash,
          status
        ) values (
          ${randomUUID()}::uuid,
          ${identity.orgId}::uuid,
          current_app_user_id(),
          ${identity.toolId},
          ${identity.toolVersion},
          ${identity.idempotencyKey},
          ${inputHash},
          'reserved'
        )
        on conflict (org_id, tool_id, tool_version, idempotency_key) do nothing
        returning id::text as id
      `);

      if (inserted.length === 1) {
        return { outcome: "new" };
      }

      const rows = await prisma.$queryRaw<DurableIdempotencyRow[]>(Prisma.sql`
        select
          input_hash as "inputHash",
          status,
          action_json as "actionJson",
          result_json as "resultJson"
        from athena_action_idempotency
        where org_id = ${identity.orgId}::uuid
          and actor_user_id = current_app_user_id()
          and tool_id = ${identity.toolId}
          and tool_version = ${identity.toolVersion}
          and idempotency_key = ${identity.idempotencyKey}
        limit 1
      `);
      const existing = rows[0];
      if (!existing) {
        throw new Error("Athena idempotency key is reserved by another actor or is not visible in the current tenant session");
      }
      if (existing.inputHash !== inputHash) {
        throw new Error("Athena idempotency key was already used for different validated input");
      }
      if (existing.status !== "completed" || !existing.actionJson || !existing.resultJson) {
        return { outcome: "duplicate" };
      }
      return {
        outcome: "duplicate",
        existing: {
          action: existing.actionJson as AthenaAction,
          result: existing.resultJson as AthenaActionResult<TData>,
        },
      };
    },

    async complete<TData = unknown>(scopeKey: string, outcome: AthenaCompletedActionOutcome<TData>): Promise<void> {
      const identity = parseAthenaIdempotencyScopeKey(scopeKey);
      const inputHash = computeCanonicalInputHash(outcome.action.input);
      const updated = await prisma.$executeRaw(Prisma.sql`
        update athena_action_idempotency
        set
          status = 'completed',
          action_json = ${JSON.stringify(outcome.action)}::jsonb,
          result_json = ${JSON.stringify(outcome.result)}::jsonb,
          updated_at = now()
        where org_id = ${identity.orgId}::uuid
          and actor_user_id = current_app_user_id()
          and tool_id = ${identity.toolId}
          and tool_version = ${identity.toolVersion}
          and idempotency_key = ${identity.idempotencyKey}
          and input_hash = ${inputHash}
          and status = 'reserved'
      `);
      if (updated !== 1) {
        throw new Error("Athena idempotency completion did not own the matching input reservation");
      }
    },

    async release(scopeKey: string): Promise<void> {
      const identity = parseAthenaIdempotencyScopeKey(scopeKey);
      await prisma.$executeRaw(Prisma.sql`
        delete from athena_action_idempotency
        where org_id = ${identity.orgId}::uuid
          and actor_user_id = current_app_user_id()
          and tool_id = ${identity.toolId}
          and tool_version = ${identity.toolVersion}
          and idempotency_key = ${identity.idempotencyKey}
          and status = 'reserved'
      `);
    },
  };
}

// Tenant-, tool-, version-, and key-qualified scope. Never key on the caller
// supplied idempotency key alone: two organizations or two tools using the
// same literal key must never collide or dedupe against each other.
export function buildAthenaIdempotencyScopeKey(orgId: string, toolId: string, toolVersion: string, idempotencyKey: string): string {
  return `${orgId}::${toolId}::${toolVersion}::${idempotencyKey}`;
}
