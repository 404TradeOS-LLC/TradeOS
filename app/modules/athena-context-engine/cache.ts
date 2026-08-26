import { createHash } from "node:crypto";

// Tenant-qualified cache-key builder and TTL cache (docs/athena/roadmap/
// A3-context-engine-implementation-plan.md "Freshness And Caching"). Closes
// the LOW-1 gap named in the A1 parallel readiness review:
// knowledge-runtime/cache.ts's single un-keyed module-level snapshot is
// correct for non-tenant reference data, but would silently serve one org's
// data to another if a tenant-scoped provider copied that pattern. This
// module is deliberately separate from knowledge-runtime/cache.ts rather
// than retrofitting tenant-safety onto a module that currently correctly
// assumes non-tenant data.
export interface AthenaContextCacheKeyInput {
  orgId: string;
  actorUserId: string;
  actorRole: string;
  // Sorted before hashing so permission-set order never produces a
  // different cache key for the same effective grant set.
  effectivePermissions: readonly string[];
  providerId: string;
  providerVersion: string;
  // Any provider-specific narrowing input (e.g. selectedScope fields)
  // that would produce a different result for the same tenant/actor.
  scopedInput: Record<string, unknown>;
}

// C010's mandatory cacheKeyPolicy: "tenant_actor_permission_input" -
// docs/athena/contracts/README.md requires cached tenant data to be keyed
// by "a tenant-, actor-, permission-, provider-version-, and
// input-qualified cache key." Hashed (not concatenated raw) so the key
// itself never leaks a permission list or scoped-input contents to
// anything reading cache keys in logs/metrics.
export function buildAthenaContextCacheKey(input: AthenaContextCacheKeyInput): string {
  const material = JSON.stringify({
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    effectivePermissions: [...input.effectivePermissions].sort(),
    providerId: input.providerId,
    providerVersion: input.providerVersion,
    scopedInput: input.scopedInput,
  });
  return createHash("sha256").update(material).digest("hex");
}

interface CacheEntry<TValue> {
  value: TValue;
  expiresAt: number;
}

// Minimal in-memory TTL cache. A3 has no cross-process/persisted cache
// requirement (docs/athena/roadmap/A3-context-engine-implementation-plan.md
// "Migration Requirements": "None... code-defined/in-memory"); a real
// distributed cache is out of scope until a later milestone needs one.
export class AthenaContextCache<TValue> {
  private readonly entries = new Map<string, CacheEntry<TValue>>();

  get(cacheKey: string, now: number = Date.now()): TValue | undefined {
    const entry = this.entries.get(cacheKey);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.entries.delete(cacheKey);
      return undefined;
    }
    return entry.value;
  }

  set(cacheKey: string, value: TValue, ttlMs: number, now: number = Date.now()): void {
    this.entries.set(cacheKey, { value, expiresAt: now + ttlMs });
  }

  clear(): void {
    this.entries.clear();
  }
}
