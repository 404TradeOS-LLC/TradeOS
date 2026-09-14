import type { CreateCandidateInput } from "./candidateCostItemService";

export interface BlsOewsWageRecord {
  socCode: string;
  occupation: string;
  trade: string;
  category: string;
  hourlyP10: number;
  hourlyP25: number;
  hourlyMedian: number;
  hourlyP75: number;
  hourlyP90: number;
}

export const BLS_OEWS_TERRE_HAUTE_2025_SOURCE_URL =
  "https://www.bls.gov/regions/midwest/news-release/2026/occupationalemploymentandwages_terrehaute_20260710.htm";

export const BLS_OEWS_TERRE_HAUTE_2025_REGIONAL_BASIS =
  "Terre Haute, IN Metropolitan Statistical Area (Clay, Sullivan, Vermillion, and Vigo counties)";

/**
 * May 2025 OEWS wage estimates for contractor-trade ingestion slices.
 *
 * These are employee wage benchmarks, not organization-specific loaded labor
 * costs or customer-facing bill rates. They enter TradeOS as source-backed
 * research candidates for review context only. This adapter deliberately does
 * not populate laborHours or laborRateAssumption because the existing
 * candidate promotion flow maps laborRateAssumption into both hourlyCost and
 * billRate; doing that with an OEWS wage would incorrectly turn an employee
 * wage benchmark into a customer bill rate.
 */
export const BLS_OEWS_TERRE_HAUTE_2025_WAGES: readonly BlsOewsWageRecord[] = [
  {
    socCode: "47-2111",
    occupation: "Electricians",
    trade: "Electrician",
    category: "Electrical",
    hourlyP10: 21.56,
    hourlyP25: 24.22,
    hourlyMedian: 37.33,
    hourlyP75: 43.22,
    hourlyP90: 47.84,
  },
  {
    socCode: "47-2152",
    occupation: "Plumbers, Pipefitters, and Steamfitters",
    trade: "Plumber",
    category: "Plumbing",
    hourlyP10: 22.17,
    hourlyP25: 29.53,
    hourlyMedian: 43.39,
    hourlyP75: 48.07,
    hourlyP90: 48.07,
  },
  {
    socCode: "47-2031",
    occupation: "Carpenters",
    trade: "Carpenter",
    category: "Carpentry",
    hourlyP10: 18.72,
    hourlyP25: 23.77,
    hourlyMedian: 29.12,
    hourlyP75: 35.55,
    hourlyP90: 38.75,
  },
  {
    socCode: "49-9021",
    occupation: "Heating, Air Conditioning, and Refrigeration Mechanics and Installers",
    trade: "HVAC Technician",
    category: "HVAC",
    hourlyP10: 18.35,
    hourlyP25: 23.29,
    hourlyMedian: 26.11,
    hourlyP75: 33.04,
    hourlyP90: 39.06,
  },
  {
    socCode: "47-2141",
    occupation: "Painters, Construction and Maintenance",
    trade: "Painter",
    category: "Painting",
    hourlyP10: 17.13,
    hourlyP25: 18.37,
    hourlyMedian: 22.06,
    hourlyP75: 28.0,
    hourlyP90: 29.49,
  },
  {
    socCode: "47-2073",
    occupation: "Operating Engineers and Other Construction Equipment Operators",
    trade: "Heavy Equipment Operator",
    category: "Sitework",
    hourlyP10: 20.85,
    hourlyP25: 24.17,
    hourlyMedian: 29.63,
    hourlyP75: 40.4,
    hourlyP90: 44.46,
  },
  {
    socCode: "47-2211",
    occupation: "Sheet Metal Workers",
    trade: "Sheet Metal Worker",
    category: "HVAC",
    hourlyP10: 17.73,
    hourlyP25: 22.71,
    hourlyMedian: 36.44,
    hourlyP75: 42.77,
    hourlyP90: 47.39,
  },
] as const;

/**
 * Converts one official OEWS wage observation into the existing governed
 * Costbook research-candidate contract as benchmark evidence only.
 *
 * The wage distribution is retained in researchNotes. No promotable labor
 * cost/bill-rate assumption is created here; an organization-specific loaded
 * labor cost and bill rate need their own reviewed inputs before LaborRate
 * creation is safe.
 */
export function toBlsOewsLaborCandidate(
  wage: BlsOewsWageRecord,
  retrievedAt: string = new Date().toISOString()
): CreateCandidateInput {
  return {
    trade: wage.trade,
    category: wage.category,
    itemName: `${wage.trade} labor — BLS OEWS wage benchmark`,
    description: `${wage.occupation}; May 2025 OEWS employee wage benchmark for the Terre Haute, IN MSA.`,
    unitOfMeasure: "HR",
    materialCostTypical: 0,
    equipmentCost: 0,
    sourceName: "U.S. Bureau of Labor Statistics — Occupational Employment and Wage Statistics",
    sourceUrl: BLS_OEWS_TERRE_HAUTE_2025_SOURCE_URL,
    sourceIdentifier: `OEWS-2025-45460-${wage.socCode}-P50`,
    sourceDate: "2025-05-01",
    retrievedAt,
    regionalBasis: BLS_OEWS_TERRE_HAUTE_2025_REGIONAL_BASIS,
    confidence: "high",
    provenanceStatus: "documented",
    researchNotes:
      `Official BLS OEWS wage observation for SOC ${wage.socCode}. ` +
      `Hourly percentiles: P10 $${wage.hourlyP10.toFixed(2)}, P25 $${wage.hourlyP25.toFixed(2)}, ` +
      `P50 $${wage.hourlyMedian.toFixed(2)}, P75 $${wage.hourlyP75.toFixed(2)}, P90 $${wage.hourlyP90.toFixed(2)}. ` +
      "The values are BLS 2025 employee wage data for the Terre Haute MSA; the official BLS area release is retained as the canonical government source URL. " +
      "Benchmark only: this candidate intentionally omits laborRateAssumption and laborHours so the current promotion path cannot convert the raw wage into an organization LaborRate bill rate. " +
      "TradeOS must not infer payroll burden, benefits, overhead, markup, margin, or customer bill rate from BLS data without organization-specific inputs.",
  };
}

export function buildTerreHauteBlsOewsLaborCandidates(
  retrievedAt: string = new Date().toISOString()
): CreateCandidateInput[] {
  return BLS_OEWS_TERRE_HAUTE_2025_WAGES.map((wage) => toBlsOewsLaborCandidate(wage, retrievedAt));
}
