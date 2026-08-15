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

export class AthenaIdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AthenaIdempotencyConflictError";
  }
}

export interface AthenaIdempotencyStore {
  // Atomically claims `scopeKey` for one canonical validated-input identity if
  // unclaimed, or reports the existing attempt's outcome if already claimed.
  // Reusing the same key for different validated input must fail closed.
  reserve<TData = unknown>(scopeKey: string, inputHash: string): Promise<AthenaIdempotencyReservation<TData>>;
  // Records the terminal action/result for the exact validated-input hash that
  // was reserved. Callers must forward the same hash rather than re-deriving
  // identity from an action envelope containing raw request input.
  complete<TData = unknown>(scopeKey: string, inputHash: string, outcome: AthenaCompletedActionOutcome<TData>): Promise<void>;
  // Releases a reservation without recording a result. Production uses this
  // inside the request/background RLS transaction for an attempt that claimed
  // a key but could not durably complete it.
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
          throw new AthenaIdempotencyConflictError("Athena idempotency key was already used for different validated input");
        }
        return { outcome: "duplicate", existing: existing.outcome } as AthenaIdempotencyReservation<never>;
      }
      entries.set(scopeKey, { inputHash });
      return { outcome: "new" };
    },
    async complete(scopeKey, inputHash, outcome) {
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

// The internal scope key is a structured tuple rather than a delimiter-based
// string so tool IDs, versions, and caller keys cannot shift fields by
// containing the same separator. The durable adapter validates this tuple at
// its database boundary.
export function buildAthenaIdempotencyScopeKey(orgId: string, toolId: string, toolVersion: string, idempotencyKey: string): string {
  return JSON.stringify([orgId, toolId, toolVersion, idempotencyKey]);
}
