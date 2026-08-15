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

// Test/local fixture. Production must inject a durable implementation through
// this interface; the A6 module deliberately remains persistence-agnostic.
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

// Tenant-, tool-, version-, and key-qualified scope. Never key on the caller
// supplied idempotency key alone: two organizations or two tools using the
// same literal key must never collide or dedupe against each other.
export function buildAthenaIdempotencyScopeKey(orgId: string, toolId: string, toolVersion: string, idempotencyKey: string): string {
  return `${orgId}::${toolId}::${toolVersion}::${idempotencyKey}`;
}
