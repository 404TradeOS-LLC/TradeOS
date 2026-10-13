const mockQueryRaw = jest.fn();

jest.mock("../db/client", () => ({
  basePrisma: { $queryRaw: mockQueryRaw },
}));

import { SharedSupplierCronRateLimitStore } from "../backend/routes/supplierCronRateLimitStore";

describe("Vercel-shared supplier Cron budgets", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shares atomic counters across function instances while separating authorized and unauthorized budgets", async () => {
    const hits = new Map<string, number>();
    mockQueryRaw.mockImplementation(async (sql: { values: unknown[] }) => {
      const [key, windowMs] = sql.values as [string, number];
      expect(key).toMatch(/^[a-f0-9]{64}$/);
      expect(windowMs).toBe(60_000);
      const next = (hits.get(key) ?? 0) + 1;
      hits.set(key, next);
      return [{ total_hits: next, window_resets_at: new Date("2026-10-08T19:00:00Z") }];
    });
    const unauthorizedA = new SharedSupplierCronRateLimitStore("unauthorized");
    const unauthorizedB = new SharedSupplierCronRateLimitStore("unauthorized");
    const authorized = new SharedSupplierCronRateLimitStore("authorized");
    for (const store of [unauthorizedA, unauthorizedB, authorized]) {
      store.init({ windowMs: 60_000 } as never);
    }

    expect((await unauthorizedA.increment("203.0.113.8")).totalHits).toBe(1);
    expect((await unauthorizedB.increment("203.0.113.8")).totalHits).toBe(2);
    expect((await authorized.increment("203.0.113.8")).totalHits).toBe(1);
    expect(hits.size).toBe(2);
    expect([...hits.keys()].every((key) => !key.includes("203.0.113.8"))).toBe(true);
  });

  it("fails closed if the shared limiter is unavailable or returns no budget", async () => {
    const store = new SharedSupplierCronRateLimitStore("authorized");
    store.init({ windowMs: 60_000 } as never);
    mockQueryRaw.mockRejectedValueOnce(new Error("database offline"));
    await expect(store.increment("203.0.113.9")).rejects.toThrow("database offline");
    mockQueryRaw.mockResolvedValueOnce([]);
    await expect(store.increment("203.0.113.9")).rejects.toThrow("returned no budget");
  });
});
