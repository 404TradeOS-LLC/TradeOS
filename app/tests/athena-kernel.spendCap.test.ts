// Unit coverage for modules/athena-kernel/spendCap.ts (daily Gemini spend
// cap, founder-approved 2026-11-26). The Prisma client is mocked so the
// spend ledger can be exercised against precise, hand-picked rows without
// a real Postgres instance.

const findMany = jest.fn();

jest.mock("../db/client", () => ({ prisma: { athenaGenerationRun: { findMany } } }));

import { ATHENA_DEFAULT_DAILY_SPEND_CAP_USD, getDailySpendStatus, getUtcDayWindow, parseDailySpendCapUsd } from "../modules/athena-kernel/spendCap";

function usdRow(amount: number): { estimatedUsd: { toNumber(): number } } {
  return { estimatedUsd: { toNumber: () => amount } };
}

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

  it("sums successful generation runs for the org within the UTC day and reports reached at the cap", async () => {
    findMany.mockResolvedValue([usdRow(0.6), usdRow(0.5), { estimatedUsd: null }]);

    const status = await getDailySpendStatus({ orgId: "org-1", capUsd: 1, now });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        orgId: "org-1",
        status: "succeeded",
        createdAt: { gte: new Date("2026-11-26T00:00:00.000Z"), lt: new Date("2026-11-27T00:00:00.000Z") },
        estimatedUsd: { not: null },
      },
      select: { estimatedUsd: true },
    });
    expect(status.spentUsd).toBeCloseTo(1.1);
    expect(status.reached).toBe(true);
    expect(status.dayStartUtc.toISOString()).toBe("2026-11-26T00:00:00.000Z");
  });

  it("reports not reached below the cap", async () => {
    findMany.mockResolvedValue([usdRow(0.5)]);

    const status = await getDailySpendStatus({ orgId: "org-1", capUsd: 1, now });

    expect(status.spentUsd).toBeCloseTo(0.5);
    expect(status.reached).toBe(false);
  });

  it("reports zero spend and not reached when the ledger is empty", async () => {
    findMany.mockResolvedValue([]);

    const status = await getDailySpendStatus({ orgId: "org-1", capUsd: 1, now });

    expect(status.spentUsd).toBe(0);
    expect(status.reached).toBe(false);
  });

  it("treats a $0 cap as reached even with zero spend (kill switch)", async () => {
    findMany.mockResolvedValue([]);

    const status = await getDailySpendStatus({ orgId: "org-1", capUsd: 0, now });

    expect(status.reached).toBe(true);
  });
});
