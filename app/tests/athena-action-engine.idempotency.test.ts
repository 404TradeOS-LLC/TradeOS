import { createInMemoryAthenaIdempotencyStore } from "../modules/athena-action-engine/idempotency";
import { computeCanonicalInputHash } from "../modules/athena-action-engine/inputHash";

describe("Athena action idempotency identity", () => {
  it("fails closed when one key is reused for different validated input", async () => {
    const store = createInMemoryAthenaIdempotencyStore();
    const scopeKey = "org-1::tradeos.athena.fixture.echo::1.0.0::same-key";

    await expect(store.reserve(scopeKey, computeCanonicalInputHash({ message: "first" }))).resolves.toEqual({ outcome: "new" });
    await expect(store.reserve(scopeKey, computeCanonicalInputHash({ message: "different" }))).rejects.toThrow(/different validated input/i);
  });

  it("treats structurally equivalent validated input as the same identity", async () => {
    const store = createInMemoryAthenaIdempotencyStore();
    const scopeKey = "org-1::tradeos.athena.fixture.echo::1.0.0::same-key";
    const firstHash = computeCanonicalInputHash({ tags: { a: "1", b: "2" } });
    const reorderedHash = computeCanonicalInputHash({ tags: { b: "2", a: "1" } });

    expect(reorderedHash).toBe(firstHash);
    await expect(store.reserve(scopeKey, firstHash)).resolves.toEqual({ outcome: "new" });
    await expect(store.reserve(scopeKey, reorderedHash)).resolves.toEqual({ outcome: "duplicate", existing: undefined });
  });
});
