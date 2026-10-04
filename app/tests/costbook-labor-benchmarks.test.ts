import {
  BLS_ECEC_PRIVATE_CONSTRUCTION_JUNE_2026,
  INDIANA_OEWS_STATE_CODE,
  NATIONAL_OEWS_CODE,
  TERRE_HAUTE_OEWS_2025_CORE_TRADES,
  TERRE_HAUTE_OEWS_AREA_CODE,
  deriveEcecBurdenedLaborCost,
  resolveOewsBenchmark,
  type OewsLaborBenchmark,
} from "../modules/costbook/laborBenchmarks";

describe("Costbook BLS labor benchmarks", () => {
  it("pins the nine verified Terre Haute core-trade observations", () => {
    expect(TERRE_HAUTE_OEWS_2025_CORE_TRADES).toHaveLength(9);
    expect(TERRE_HAUTE_OEWS_2025_CORE_TRADES.find((row) => row.socCode === "47-2031")).toMatchObject({
      geographyCode: TERRE_HAUTE_OEWS_AREA_CODE,
      employment: 280,
      hourlyMean: 29.75,
      hourlyMedian: 29.12,
    });
    expect(TERRE_HAUTE_OEWS_2025_CORE_TRADES.find((row) => row.socCode === "47-2181")).toMatchObject({
      employment: 80,
      hourlyMean: 25.08,
      hourlyMedian: 23.89,
    });
  });

  it("resolves MSA first, then Indiana, then national without relabeling fallback geography", () => {
    const fixtures: OewsLaborBenchmark[] = [
      { socCode: "47-2081", occupation: "Drywall", geographyType: "national", geographyCode: NATIONAL_OEWS_CODE, geographyName: "United States", referencePeriod: "2025-05", employment: null, hourlyMean: 30, hourlyMedian: 29, source: "bls_oews" },
      { socCode: "47-2081", occupation: "Drywall", geographyType: "state", geographyCode: INDIANA_OEWS_STATE_CODE, geographyName: "Indiana", referencePeriod: "2025-05", employment: null, hourlyMean: 28, hourlyMedian: 27, source: "bls_oews" },
    ];

    expect(resolveOewsBenchmark(fixtures, "47-2081")).toMatchObject({
      geographyType: "state",
      geographyCode: INDIANA_OEWS_STATE_CODE,
      hourlyMean: 28,
      fallbackFrom: TERRE_HAUTE_OEWS_AREA_CODE,
    });

    expect(resolveOewsBenchmark(fixtures.filter((row) => row.geographyType === "national"), "47-2081")).toMatchObject({
      geographyType: "national",
      geographyCode: NATIONAL_OEWS_CODE,
      fallbackFrom: TERRE_HAUTE_OEWS_AREA_CODE,
    });
  });

  it("adds ECEC benefit dollars once and labels the result inferred rather than local", () => {
    expect(BLS_ECEC_PRIVATE_CONSTRUCTION_JUNE_2026).toMatchObject({
      wagesPerHour: 36.13,
      benefitsPerHour: 15.84,
      geographicScope: "national",
    });
    expect(deriveEcecBurdenedLaborCost(29.75)).toEqual({
      baseWage: 29.75,
      benefitLoad: 15.84,
      burdenedCost: 45.59,
      benefitRatePct: 43.84,
      baseWageSource: "bls_oews",
      benefitSource: "bls_ecec",
      benefitGeographicScope: "national",
      verifiedVsInferred: "inferred",
      confidence: "MEDIUM",
      inferenceNotes: expect.stringContaining("not a Terre Haute-specific benefit load"),
    });
  });
});
