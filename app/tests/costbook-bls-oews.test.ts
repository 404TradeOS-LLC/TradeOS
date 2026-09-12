import { costbookResearchCandidateSchema } from "../modules/costbook/candidateCostItem";
import {
  BLS_OEWS_TERRE_HAUTE_2025_REGIONAL_BASIS,
  BLS_OEWS_TERRE_HAUTE_2025_WAGES,
  buildTerreHauteBlsOewsLaborCandidates,
} from "../modules/costbook/blsOewsTerreHaute";

describe("BLS OEWS Terre Haute labor candidate ingestion", () => {
  const retrievedAt = "2026-09-12T08:00:00.000Z";

  it("maps the first contractor-trade wage slice into valid governed candidates", () => {
    const candidates = buildTerreHauteBlsOewsLaborCandidates(retrievedAt);

    expect(candidates).toHaveLength(5);
    for (const candidate of candidates) {
      const parsed = costbookResearchCandidateSchema.parse(candidate);
      expect(parsed.reviewStatus).toBe("candidate");
      expect(parsed.provenanceStatus).toBe("documented");
      expect(parsed.confidence).toBe("high");
      expect(parsed.regionalBasis).toBe(BLS_OEWS_TERRE_HAUTE_2025_REGIONAL_BASIS);
      expect(parsed.laborHours).toBe(1);
      expect(parsed.materialCostTypical).toBe(0);
      expect(parsed.equipmentCost).toBe(0);
      expect(parsed.retrievedAt).toBe(retrievedAt);
      expect(parsed.sourceName).toContain("Bureau of Labor Statistics");
      expect(parsed.sourceIdentifier).toMatch(/^OEWS-2025-45460-/);
    }
  });

  it("uses the published May 2025 Terre Haute medians as labor cost assumptions", () => {
    const mediansBySoc = Object.fromEntries(
      BLS_OEWS_TERRE_HAUTE_2025_WAGES.map((row) => [row.socCode, row.hourlyMedian])
    );

    expect(mediansBySoc).toEqual({
      "47-2111": 37.33,
      "47-2152": 43.39,
      "47-2031": 29.12,
      "49-9021": 26.11,
      "47-2141": 22.06,
    });

    expect(buildTerreHauteBlsOewsLaborCandidates(retrievedAt).map((candidate) => candidate.laborRateAssumption)).toEqual([
      37.33,
      43.39,
      29.12,
      26.11,
      22.06,
    ]);
  });

  it("does not invent burden, overhead, markup, margin, or bill rate", () => {
    const candidate = buildTerreHauteBlsOewsLaborCandidates(retrievedAt)[0];

    expect(candidate.researchNotes).toContain("must not infer payroll burden, overhead, markup, margin, or customer bill rate");
    expect(candidate).not.toHaveProperty("billRate");
  });
});
