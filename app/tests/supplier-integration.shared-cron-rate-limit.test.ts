const mockQueryRaw = jest.fn();

jest.mock("../db/client", () => ({
  basePrisma: { $queryRaw: mockQueryRaw },
  getSupplierTokenRotationClient: jest.fn(() => ({ $queryRaw: mockQueryRaw })),
}));

import { SharedSupplierCronRateLimitStore } from "../backend/routes/supplierCronRateLimitStore";
import { getSupplierTokenRotationClient } from "../db/client";

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
    const selectedQuote = new SharedSupplierCronRateLimitStore("abc-selected-quote");
    for (const store of [unauthorizedA, unauthorizedB, authorized, selectedQuote]) {
      store.init({ windowMs: 60_000 } as never);
    }

    expect((await unauthorizedA.increment("203.0.113.8")).totalHits).toBe(1);
    expect((await unauthorizedB.increment("203.0.113.8")).totalHits).toBe(2);
    expect((await authorized.increment("203.0.113.8")).totalHits).toBe(1);
    expect((await selectedQuote.increment("203.0.113.8")).totalHits).toBe(1);
    expect(getSupplierTokenRotationClient).toHaveBeenCalledTimes(1);
    expect(hits.size).toBe(3);
    expect([...hits.keys()].every((key) => !key.includes("203.0.113.8"))).toBe(true);
  });

  it("enforces an independent global ABC catalog budget through the separate restricted pool", async () => {
    const seen: unknown[] = [];
    mockQueryRaw.mockImplementation(async (sql: { values: unknown[] }) => {
      seen.push(sql.values[0]);
      expect(sql.values[1]).toBe(1000);
      return [{ total_hits: seen.length, window_resets_at: new Date("2026-10-13T20:00:01Z") }];
    });
    const first = new SharedSupplierCronRateLimitStore("abc-catalog");
    const second = new SharedSupplierCronRateLimitStore("abc-catalog");
    const selectedPrice = new SharedSupplierCronRateLimitStore("abc-selected-quote");
    for (const store of [first, second, selectedPrice]) {
      store.init({ windowMs: 1000 } as never);
    }
    await first.increment("abc-sandbox-product-read");
    await second.increment("abc-sandbox-product-read");
    await selectedPrice.increment("abc-sandbox-product-read");
    expect(seen[0]).toBe(seen[1]); // Every instance shares exactly one catalog budget.
    expect(seen[2]).not.toBe(seen[0]); // Pricing has a separate limit/authorization boundary.
    expect(getSupplierTokenRotationClient).toHaveBeenCalledTimes(3);
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
