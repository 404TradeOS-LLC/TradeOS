import { BLS_OEWS_TERRE_HAUTE_2025_WAGES, BLS_OEWS_TERRE_HAUTE_2025_REGIONAL_BASIS } from "./blsOewsTerreHaute";

export type OewsGeographyType = "msa" | "state" | "national";

export interface OewsLaborBenchmark {
  socCode: string;
  occupation: string;
  geographyType: OewsGeographyType;
  geographyCode: string;
  geographyName: string;
  referencePeriod: string;
  employment: number | null;
  hourlyMean: number;
  hourlyMedian: number;
  source: "bls_oews";
}

export interface ResolvedOewsBenchmark extends OewsLaborBenchmark {
  fallbackFrom: "0045460" | null;
}

export interface BurdenedLaborBenchmark {
  baseWage: number;
  benefitLoad: number;
  burdenedCost: number;
  benefitRatePct: number;
  baseWageSource: "bls_oews";
  benefitSource: "bls_ecec";
  benefitGeographicScope: "national";
  verifiedVsInferred: "inferred";
  confidence: "MEDIUM";
  inferenceNotes: string;
}

export const TERRE_HAUTE_OEWS_AREA_CODE = "0045460";
export const TERRE_HAUTE_OEWS_GEOGRAPHY = BLS_OEWS_TERRE_HAUTE_2025_REGIONAL_BASIS;
export const INDIANA_OEWS_STATE_CODE = "18";
export const NATIONAL_OEWS_CODE = "US";

/**
 * Verified May 2025 Terre Haute OEWS examples from the Costbook source
 * validation. These are employee wage benchmarks, not organization-specific
 * loaded cost and never a customer bill rate.
 */
export const TERRE_HAUTE_OEWS_2025_CORE_TRADES: readonly OewsLaborBenchmark[] =
  BLS_OEWS_TERRE_HAUTE_2025_WAGES
    .filter((row) => row.employment != null && row.hourlyMean != null)
    .map((row) => ({
      socCode: row.socCode,
      occupation: row.occupation,
      geographyType: "msa" as const,
      geographyCode: TERRE_HAUTE_OEWS_AREA_CODE,
      geographyName: TERRE_HAUTE_OEWS_GEOGRAPHY,
      referencePeriod: "2025-05",
      employment: row.employment ?? null,
      hourlyMean: row.hourlyMean as number,
      hourlyMedian: row.hourlyMedian,
      source: "bls_oews" as const,
    }));

export const BLS_ECEC_PRIVATE_CONSTRUCTION_JUNE_2026 = {
  referencePeriod: "2026-06",
  wagesPerHour: 36.13,
  benefitsPerHour: 15.84,
  geographicScope: "national" as const,
  source: "bls_ecec" as const,
};

/**
 * Resolve an OEWS benchmark using the governed fallback order:
 * Terre Haute MSA -> Indiana -> national.
 *
 * The function accepts rows from an ingestion adapter, so unavailable local
 * occupations can fall back without fabricating a local value. The selected
 * row retains its real geography and explicitly reports that fallback occurred.
 */
export function resolveOewsBenchmark(
  rows: readonly OewsLaborBenchmark[],
  socCode: string
): ResolvedOewsBenchmark | null {
  const candidates = rows.filter((row) => row.socCode === socCode);
  const selected =
    candidates.find((row) => row.geographyType === "msa" && row.geographyCode === TERRE_HAUTE_OEWS_AREA_CODE) ??
    candidates.find((row) => row.geographyType === "state" && row.geographyCode === INDIANA_OEWS_STATE_CODE) ??
    candidates.find((row) => row.geographyType === "national" && row.geographyCode === NATIONAL_OEWS_CODE) ??
    null;

  if (!selected) return null;
  return {
    ...selected,
    fallbackFrom:
      selected.geographyType === "msa" && selected.geographyCode === TERRE_HAUTE_OEWS_AREA_CODE
        ? null
        : TERRE_HAUTE_OEWS_AREA_CODE,
  };
}

/**
 * Apply the verified national ECEC construction benefit dollars to an
 * observed OEWS wage. This is intentionally labelled inferred: ECEC does not
 * provide a Terre Haute construction benefit load. ECEC already includes
 * legally-required benefits, so callers must not add payroll taxes again.
 */
export function deriveEcecBurdenedLaborCost(baseWage: number): BurdenedLaborBenchmark {
  if (!Number.isFinite(baseWage) || baseWage < 0) {
    throw new Error("baseWage must be a finite non-negative number");
  }
  const benefitLoad = BLS_ECEC_PRIVATE_CONSTRUCTION_JUNE_2026.benefitsPerHour;
  const burdenedCost = round2(baseWage + benefitLoad);
  return {
    baseWage: round2(baseWage),
    benefitLoad,
    burdenedCost,
    benefitRatePct: round2((benefitLoad / BLS_ECEC_PRIVATE_CONSTRUCTION_JUNE_2026.wagesPerHour) * 100),
    baseWageSource: "bls_oews",
    benefitSource: "bls_ecec",
    benefitGeographicScope: "national",
    verifiedVsInferred: "inferred",
    confidence: "MEDIUM",
    inferenceNotes:
      "National BLS ECEC private-construction benefits applied to an OEWS wage benchmark; this is not a Terre Haute-specific benefit load and does not include contractor overhead, profit, or customer markup.",
  };
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
