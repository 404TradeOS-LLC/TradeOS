import { costbookResearchCandidateSchema } from "../modules/costbook/candidateCostItem";
import {
  BLS_OEWS_TERRE_HAUTE_2025_REGIONAL_BASIS,
  BLS_OEWS_TERRE_HAUTE_2025_SOURCE_URL,
  BLS_OEWS_TERRE_HAUTE_2025_WAGES,
  buildTerreHauteBlsOewsLaborCandidates,
} from "../modules/costbook/blsOewsTerreHaute";

describe("BLS OEWS Terre Haute labor candidate ingestion", () => {
  const retrievedAt = "2026-09-12T08:00:00.000Z";

  it("maps the contractor-trade wage slice into valid governed candidates", () => {
    const candidates = buildTerreHauteBlsOewsLaborCandidates(retrievedAt);

    expect(candidates).toHaveLength(7);
    for (const candidate of candidates) {
      const parsed = costbookResearchCandidateSchema.parse(candidate);
      expect(parsed.reviewStatus).toBe("candidate");
      expect(parsed.provenanceStatus).toBe("documented");
      expect(parsed.confidence).toBe("high");
      expect(parsed.regionalBasis).toBe(BLS_OEWS_TERRE_HAUTE_2025_REGIONAL_BASIS);
      expect(parsed.materialCostTypical).toBe(0);
      expect(parsed.equipmentCost).toBe(0);
      expect(parsed.retrievedAt).toBe(retrievedAt);
      expect(parsed.sourceName).toContain("Bureau of Labor Statistics");
      expect(parsed.sourceUrl).toBe(BLS_OEWS_TERRE_HAUTE_2025_SOURCE_URL);
      expect(parsed.sourceDate).toBe("2025-05-01");
      expect(parsed.sourceIdentifier).toMatch(/^OEWS-2025-45460-/);
      expect(parsed.laborHours).toBeUndefined();
      expect(parsed.laborRateAssumption).toBeUndefined();
    }
  });

  it("locks the published May 2025 Terre Haute wage distribution and provenance", () => {
    const expected = [
      { soc: "47-2111", p10: 21.56, p25: 24.22, p50: 37.33, p75: 43.22, p90: 47.84 },
      { soc: "47-2152", p10: 22.17, p25: 29.53, p50: 43.39, p75: 48.07, p90: 48.07 },
      { soc: "47-2031", p10: 18.72, p25: 23.77, p50: 29.12, p75: 35.55, p90: 38.75 },
      { soc: "49-9021", p10: 18.35, p25: 23.29, p50: 26.11, p75: 33.04, p90: 39.06 },
      { soc: "47-2141", p10: 17.13, p25: 18.37, p50: 22.06, p75: 28.0, p90: 29.49 },
      { soc: "47-2073", p10: 20.85, p25: 24.17, p50: 29.63, p75: 40.4, p90: 44.46 },
      { soc: "47-2211", p10: 17.73, p25: 22.71, p50: 36.44, p75: 42.77, p90: 47.39 },
    ];

    expect(BLS_OEWS_TERRE_HAUTE_2025_WAGES.map((row) => ({
      soc: row.socCode,
      p10: row.hourlyP10,
      p25: row.hourlyP25,
      p50: row.hourlyMedian,
      p75: row.hourlyP75,
      p90: row.hourlyP90,
    }))).toEqual(expected);

    const candidates = buildTerreHauteBlsOewsLaborCandidates(retrievedAt);
    for (const [index, candidate] of candidates.entries()) {
      const values = expected[index];
      expect(candidate.sourceUrl).toBe(BLS_OEWS_TERRE_HAUTE_2025_SOURCE_URL);
      expect(candidate.sourceDate).toBe("2025-05-01");
      expect(candidate.researchNotes).toContain(`P10 $${values.p10.toFixed(2)}`);
      expect(candidate.researchNotes).toContain(`P25 $${values.p25.toFixed(2)}`);
      expect(candidate.researchNotes).toContain(`P50 $${values.p50.toFixed(2)}`);
      expect(candidate.researchNotes).toContain(`P75 $${values.p75.toFixed(2)}`);
      expect(candidate.researchNotes).toContain(`P90 $${values.p90.toFixed(2)}`);
    }
  });

  it("keeps OEWS wages benchmark-only instead of inventing a bill rate", () => {
    const candidate = buildTerreHauteBlsOewsLaborCandidates(retrievedAt)[0];

    expect(candidate.researchNotes).toContain("intentionally omits laborRateAssumption and laborHours");
    expect(candidate.researchNotes).toContain("must not infer payroll burden, benefits, overhead, markup, margin, or customer bill rate");
    expect(candidate).not.toHaveProperty("laborRateAssumption");
    expect(candidate).not.toHaveProperty("laborHours");
    expect(candidate).not.toHaveProperty("billRate");
  });
});
