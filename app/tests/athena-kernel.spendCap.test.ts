// Unit coverage for modules/athena-kernel/spendCap.ts (daily Gemini spend
// cap, founder-approved 2026-11-26). The Prisma client is mocked so the
// spend lookup can be exercised against precise, hand-picked sums without
// a real Postgres instance. The sum itself lives in SQL
// (public.athena_org_daily_spend_usd) and is proven live by
// tests/athena-spend-cap.integration.ts; these tests cover parsing, the UTC
// day window, the reached flag, and the call the module makes.

const queryRaw = jest.fn();

jest.mock("../db/client", () => ({
  prisma: { $queryRaw: queryRaw },
  // Fluid PR-4: getDailySpendStatus wraps the read in runInDatabaseTransaction;
  // the callback reads via the mocked prisma proxy, so the tx handle is unused.
  basePrisma: { $transaction: (callback: (tx: unknown) => unknown) => callback({}) },
}));

import { ATHENA_DEFAULT_DAILY_SPEND_CAP_USD, getDailySpendStatus, getUtcDayWindow, parseDailySpendCapUsd } from "../modules/athena-kernel/spendCap";

describe("parseDailySpendCapUsd", () => {
  it("defaults to $1.00 when unset", () => {
    expect(parseDailySpendCapUsd({})).toBe(ATHENA_DEFAULT_DAILY_SPEND_CAP_USD);
    expect(ATHENA_DEFAULT_DAILY_SPEND_CAP_USD).toBe(1);
  });

  it("uses the configured value", () => {
    expect(parseDailySpendCapUsd({ ATHENA_DAILY_SPEND_CAP_USD: "2.5" })).toBe(2.5);
  });

  it("treats 0 as a kill switch (blocks all real drafts)", () => {
    expect(parseDailySpendCapUsd({ ATHENA_DAILY_SPEND_CAP_USD: "0" })).toBe(0);
  });

  it.each(["-1", "not-a-number", "", "  "])("falls back to the default for invalid value %s", (value) => {
    expect(parseDailySpendCapUsd({ ATHENA_DAILY_SPEND_CAP_USD: value })).toBe(ATHENA_DEFAULT_DAILY_SPEND_CAP_USD);
  });
});

describe("getUtcDayWindow", () => {
  it("covers the UTC calendar day containing now", () => {
    const { start, end } = getUtcDayWindow(new Date("2026-11-26T15:30:00.000Z"));
    expect(start.toISOString()).toBe("2026-11-26T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-27T00:00:00.000Z");
  });

  it("starts at midnight for a midnight instant", () => {
    const { start, end } = getUtcDayWindow(new Date("2026-11-26T00:00:00.000Z"));
    expect(start.toISOString()).toBe("2026-11-26T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-27T00:00:00.000Z");
  });
});

describe("getDailySpendStatus", () => {
  const now = new Date("2026-11-26T15:30:00.000Z");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function mockSpend(amount: number): void {
    queryRaw.mockResolvedValue([{ spend_usd: { toNumber: () => amount } }]);
  }

  it("calls the org spend function with the org and the UTC day window", async () => {
    mockSpend(0.5);

    const status = await getDailySpendStatus({ orgId: "org-1", capUsd: 1, now });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const call = queryRaw.mock.calls[0][0] as { sql: string; values: unknown[] };
    expect(call.sql).toContain("athena_org_daily_spend_usd");
    expect(call.values).toEqual(["org-1", new Date("2026-11-26T00:00:00.000Z"), new Date("2026-11-27T00:00:00.000Z")]);
    expect(status.spentUsd).toBeCloseTo(0.5);
    expect(status.reached).toBe(false);
    expect(status.dayStartUtc.toISOString()).toBe("2026-11-26T00:00:00.000Z");
  });

  it("reports reached when the org-wide sum hits the cap", async () => {
    mockSpend(1.1);

    const status = await getDailySpendStatus({ orgId: "org-1", capUsd: 1, now });

    expect(status.spentUsd).toBeCloseTo(1.1);
    expect(status.reached).toBe(true);
  });

  it("reports zero spend and not reached when the function returns no rows", async () => {
    queryRaw.mockResolvedValue([]);

    const status = await getDailySpendStatus({ orgId: "org-1", capUsd: 1, now });

    expect(status.spentUsd).toBe(0);
    expect(status.reached).toBe(false);
  });

  it("treats a null sum as zero spend", async () => {
    queryRaw.mockResolvedValue([{ spend_usd: null }]);

    const status = await getDailySpendStatus({ orgId: "org-1", capUsd: 1, now });

    expect(status.spentUsd).toBe(0);
    expect(status.reached).toBe(false);
  });

  it("treats a $0 cap as reached even with zero spend (kill switch)", async () => {
    mockSpend(0);

    const status = await getDailySpendStatus({ orgId: "org-1", capUsd: 0, now });

    expect(status.reached).toBe(true);
  });

  it("propagates a function error instead of failing open (cap-check failure blocks the draft)", async () => {
    queryRaw.mockRejectedValue(new Error("permission denied"));

    await expect(getDailySpendStatus({ orgId: "org-1", capUsd: 1, now })).rejects.toThrow("permission denied");
  });
});
