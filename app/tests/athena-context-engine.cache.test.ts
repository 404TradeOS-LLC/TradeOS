import { AthenaContextCache, buildAthenaContextCacheKey } from "../modules/athena-context-engine/cache";

describe("athena context cache", () => {
  describe("buildAthenaContextCacheKey", () => {
    it("produces the same key for the same tenant/actor/permissions/provider/input", () => {
      const input = { orgId: "org-1", actorUserId: "user-1", permissions: ["crm.read"], providerId: "p1", providerVersion: "1.0.0", scopedInput: { jobId: "job-1" } };
      expect(buildAthenaContextCacheKey(input)).toBe(buildAthenaContextCacheKey({ ...input }));
    });

    it("is insensitive to permission array order", () => {
      const base = { orgId: "org-1", actorUserId: "user-1", providerId: "p1", providerVersion: "1.0.0", scopedInput: {} };
      const keyA = buildAthenaContextCacheKey({ ...base, permissions: ["crm.read", "billing.read"] });
      const keyB = buildAthenaContextCacheKey({ ...base, permissions: ["billing.read", "crm.read"] });
      expect(keyA).toBe(keyB);
    });

    it("produces a different key for a different organization", () => {
      const base = { actorUserId: "user-1", permissions: [], providerId: "p1", providerVersion: "1.0.0", scopedInput: {} };
      expect(buildAthenaContextCacheKey({ ...base, orgId: "org-a" })).not.toBe(buildAthenaContextCacheKey({ ...base, orgId: "org-b" }));
    });

    it("produces a different key for a different actor", () => {
      const base = { orgId: "org-1", permissions: [], providerId: "p1", providerVersion: "1.0.0", scopedInput: {} };
      expect(buildAthenaContextCacheKey({ ...base, actorUserId: "user-a" })).not.toBe(buildAthenaContextCacheKey({ ...base, actorUserId: "user-b" }));
    });

    it("produces a different key for a different permission snapshot", () => {
      const base = { orgId: "org-1", actorUserId: "user-1", providerId: "p1", providerVersion: "1.0.0", scopedInput: {} };
      expect(buildAthenaContextCacheKey({ ...base, permissions: ["crm.read"] })).not.toBe(buildAthenaContextCacheKey({ ...base, permissions: ["billing.write"] }));
    });

    it("produces a different key for a different provider version", () => {
      const base = { orgId: "org-1", actorUserId: "user-1", permissions: [], providerId: "p1", scopedInput: {} };
      expect(buildAthenaContextCacheKey({ ...base, providerVersion: "1.0.0" })).not.toBe(buildAthenaContextCacheKey({ ...base, providerVersion: "2.0.0" }));
    });

    it("produces a different key for different scoped input", () => {
      const base = { orgId: "org-1", actorUserId: "user-1", permissions: [], providerId: "p1", providerVersion: "1.0.0" };
      expect(buildAthenaContextCacheKey({ ...base, scopedInput: { jobId: "job-1" } })).not.toBe(buildAthenaContextCacheKey({ ...base, scopedInput: { jobId: "job-2" } }));
    });
  });

  describe("AthenaContextCache", () => {
    it("returns undefined for a key that was never set", () => {
      const cache = new AthenaContextCache<string>();
      expect(cache.get("missing")).toBeUndefined();
    });

    it("returns a set value before it expires", () => {
      const cache = new AthenaContextCache<string>();
      cache.set("key", "value", 1_000, 0);
      expect(cache.get("key", 500)).toBe("value");
    });

    it("returns undefined once the TTL has elapsed", () => {
      const cache = new AthenaContextCache<string>();
      cache.set("key", "value", 1_000, 0);
      expect(cache.get("key", 1_001)).toBeUndefined();
    });

    it("evicts an expired entry on read so it does not linger", () => {
      const cache = new AthenaContextCache<string>();
      cache.set("key", "value", 1_000, 0);
      cache.get("key", 1_001);
      expect(cache.get("key", 1_001)).toBeUndefined();
    });

    it("clear() removes every entry", () => {
      const cache = new AthenaContextCache<string>();
      cache.set("a", "1", 1_000);
      cache.set("b", "2", 1_000);
      cache.clear();
      expect(cache.get("a")).toBeUndefined();
      expect(cache.get("b")).toBeUndefined();
    });
  });
});
