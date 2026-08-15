import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type {
  AthenaCompletedActionOutcome,
  AthenaIdempotencyReservation,
  AthenaIdempotencyStore,
} from "../modules/athena-action-engine/idempotency";
import { computeCanonicalInputHash } from "../modules/athena-action-engine/inputHash";
import type { AthenaAction, AthenaActionResult } from "../modules/athena-action-engine/types";
import { prisma } from "./client";

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

// Durable infrastructure adapter for A6. The Action Engine owns only the
// persistence-agnostic AthenaIdempotencyStore contract; database/Prisma access
// remains outside app/modules/athena-action-engine so its import boundary stays
// enforceable. The unique database key serializes concurrent claims across API
// instances. Under the request-scoped database session, reservation, business
// mutation, and completion share one RLS transaction.
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
