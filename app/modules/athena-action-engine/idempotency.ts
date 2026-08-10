import type { AthenaAction, AthenaActionResult } from "./types";

export interface AthenaCompletedActionOutcome<TData = unknown> {
  action: AthenaAction;
  result: AthenaActionResult<TData>;
}

// A6's injectable idempotency seam (docs/athena/roadmap/
// A6-action-engine-implementation-plan.md "Idempotency"). No persistent
// idempotency store exists yet anywhere in Athena - this defines the
// interface a future durable implementation (backed by a real table, per
// the same "application-service-owned persistence seam" posture as
// athena-kernel/executionStore.ts) must satisfy, and ships only the
// deterministic in-memory implementation used by production defaults and
// tests. Production default is intentionally an isolated in-memory Map: it
// dedupes within a single process/request lifetime only. Cross-process/
// cross-instance idempotency requires the future durable store - documented
// as a deferred production boundary in the A6 plan doc, not silently
// implied to be safe across a multi-instance deployment today.
export interface AthenaIdempotencyReservation<TData = unknown> {
  outcome: "new" | "duplicate";
  // Populated on "duplicate" once the original attempt has completed
  // (carrying the original action's own actionId, per C005) - undefined if
  // the original attempt is still in flight (an edge case this synchronous,
  // single-process engine cannot itself produce, but the interface still
  // models it honestly for a future concurrent store).
  existing?: AthenaCompletedActionOutcome<TData>;
}

export interface AthenaIdempotencyStore {
  // Atomically claims `scopeKey` for a new attempt if unclaimed, or reports
  // the existing attempt's outcome if already claimed. Must never let two
  // concurrent callers both observe "new" for the same key (the
  // "duplicate idempotency key does not execute the handler twice"
  // requirement).
  reserve<TData = unknown>(scopeKey: string): Promise<AthenaIdempotencyReservation<TData>>;
  // Records the terminal action/result for a previously reserved key so
  // later duplicate calls can return them instead of re-invoking the tool.
  complete<TData = unknown>(scopeKey: string, outcome: AthenaCompletedActionOutcome<TData>): Promise<void>;
  // Releases a reservation without recording a result - used when a
  // reserved attempt fails before producing any action-relevant outcome
  // (e.g. the tool itself was never reached), so a genuinely fresh retry
  // with the same key is not permanently wedged behind a phantom
  // reservation that will never complete.
  release(scopeKey: string): Promise<void>;
}

interface InMemoryEntry {
  outcome?: AthenaCompletedActionOutcome;
}

export function createInMemoryAthenaIdempotencyStore(): AthenaIdempotencyStore {
  const entries = new Map<string, InMemoryEntry>();

  return {
    async reserve(scopeKey) {
      const existing = entries.get(scopeKey);
      if (existing) {
        return { outcome: "duplicate", existing: existing.outcome } as AthenaIdempotencyReservation<never>;
      }
      entries.set(scopeKey, {});
      return { outcome: "new" };
    },
    async complete(scopeKey, outcome) {
      entries.set(scopeKey, { outcome });
    },
    async release(scopeKey) {
      entries.delete(scopeKey);
    },
  };
}

// Tenant-, tool-, and key-qualified scope (docs/athena/09-security/README.md's
// tenant-isolation invariant, applied to idempotency the same way C010
// already requires tenant-qualified cache keys for context providers).
// Never key on idempotencyKey alone - two different orgs (or two different
// tools within the same org) submitting the same literal key string must
// never collide or dedupe against each other.
export function buildAthenaIdempotencyScopeKey(orgId: string, toolId: string, toolVersion: string, idempotencyKey: string): string {
  return `${orgId}::${toolId}::${toolVersion}::${idempotencyKey}`;
}
