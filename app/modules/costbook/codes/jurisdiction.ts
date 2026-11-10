import { createHash } from "node:crypto";

/**
 * Athena enrichment for Codes & Permits (issue #946, TODO 5).
 *
 * Pure functions only — no database access, no outbound fetch, no
 * auto-injection into the estimator. This enriches the pilot
 * codeReferences Athena tool (#945) with parcel/jurisdiction and
 * version resolution; the tool file itself lives on #945's branch and
 * the wiring lands when #945 merges (see docs/architecture/
 * COSTBOOK_CODES_PERMITS_TASKS_FEES.md).
 *
 * Contract with TODO 2 (codes_authority / codes_jurisdiction /
 * codes_source): the input shapes below mirror those tables' planned
 * fields (authority, jurisdiction, source citation/version/status).
 * Until TODO 2 lands, callers pass the same fields explicitly; nothing
 * here invents a jurisdiction record, and nothing here reads a table
 * that does not exist yet.
 *
 * Fail-closed throughout: missing, stale, or ambiguous jurisdiction
 * resolves to `needs_verification`. No permit, setback, fee, wiring, or
 * footing value is ever inferred from an address, zip code, highway
 * name, or old ordinance PDF. No source link or AI message counts as a
 * permit. No full model-code text is stored or emitted — citation +
 * source hash only.
 */

export const JURISDICTION_DISCLAIMER =
  "Advisory research only. Verify the parcel jurisdiction, current amendments, code edition, and permit applicability with the authority having jurisdiction. No source link or AI message counts as a permit.";

export interface JurisdictionInput {
  state: string;
  county?: string | null;
  /** Authoritative parcel identifier, e.g. Vigo County parcel number. */
  parcelId?: string | null;
  /** true = incorporated, false = unincorporated. Null/omitted = unknown. */
  incorporated?: boolean | null;
  zoningDistrict?: string | null;
  /** Governing authority name, e.g. "Vigo County Area Planning". */
  authorityName?: string | null;
  authorityId?: string | null;
  sourceCitation?: string | null;
  sourceVersion?: string | null;
  sourceEffectiveDate?: string | null;
}

export type JurisdictionResolution = "verified" | "needs_verification";

export interface JurisdictionOutcome {
  resolution: JurisdictionResolution;
  jurisdiction: {
    state: string;
    county: string | null;
    parcelId: string | null;
    incorporated: boolean | null;
    zoningDistrict: string | null;
    authorityName: string | null;
    authorityId: string | null;
    sourceCitation: string | null;
    sourceVersion: string | null;
    sourceEffectiveDate: string | null;
  } | null;
  /** What is missing or ambiguous — the reason verification is required. */
  missing: string[];
  whyItMatters: string;
  nextHumanAction: string;
}

/**
 * Jurisdiction is `verified` ONLY when every field that determines the
 * governing authority is supplied explicitly: parcel, incorporated
 * status, authority, and source citation + version. Anything else —
 * missing parcel, unknown incorporated status, missing authority or
 * version — is `needs_verification`. County or state alone never
 * verifies a parcel's jurisdiction.
 */
export function resolveJurisdiction(input: JurisdictionInput): JurisdictionOutcome {
  const state = (input.state ?? "").trim().toUpperCase();
  const missing: string[] = [];
  if (!/^[A-Z]{2}$/.test(state)) missing.push("state (two-letter code)");
  if (!input.parcelId?.trim()) missing.push("parcel identifier");
  if (input.incorporated !== true && input.incorporated !== false) {
    missing.push("incorporated vs unincorporated status");
  }
  if (!input.authorityName?.trim()) missing.push("governing authority");
  if (!input.sourceCitation?.trim()) missing.push("source citation");
  if (!input.sourceVersion?.trim()) missing.push("source version");

  const whyItMatters =
    "The governing authority, zoning district, and adopted code edition decide which permits, setbacks, sign rules, and inspections apply. A wrong jurisdiction silently applies the wrong rules.";
  if (missing.length > 0) {
    return {
      resolution: "needs_verification",
      jurisdiction: null,
      missing,
      whyItMatters,
      nextHumanAction:
        `Confirm the parcel and its governing authority with the county GIS / planning office before quoting or permitting. Still needed: ${missing.join(", ")}.`,
    };
  }
  return {
    resolution: "verified",
    jurisdiction: {
      state,
      county: input.county?.trim() || null,
      parcelId: input.parcelId!.trim(),
      incorporated: input.incorporated ?? null,
      zoningDistrict: input.zoningDistrict?.trim() || null,
      authorityName: input.authorityName!.trim(),
      authorityId: input.authorityId?.trim() || null,
      sourceCitation: input.sourceCitation!.trim(),
      sourceVersion: input.sourceVersion!.trim(),
      sourceEffectiveDate: input.sourceEffectiveDate?.trim() || null,
    },
    missing: [],
    whyItMatters,
    nextHumanAction:
      "Reconfirm the cited source version is still current on the job date; amendments after the review date can change the applicable rules.",
  };
}

export type SourceVersionStatus = "current" | "superseded" | "stale" | "unknown";

export interface KnownSourceVersion {
  citation: string;
  status: "current" | "superseded";
  effectiveDate?: string | null;
  /** Citation of the version that replaced this one, when superseded. */
  supersededByCitation?: string | null;
  reviewedAt?: string | null;
}

export interface SourceVersionOutcome {
  status: SourceVersionStatus;
  /** The matched registry entry — superseded versions stay readable here. */
  matched: KnownSourceVersion | null;
  supersededByCitation: string | null;
  whyItMatters: string;
  nextHumanAction: string;
}

export interface VersionReferenceInput {
  citation: string;
  sourceDate?: string | null;
  reviewedAt?: string | null;
}

/**
 * Version resolution against the TODO 2 source registry. An exact
 * citation match returns that version's status. A superseded version is
 * still returned readably (with its successor pointer) — history is
 * never deleted or hidden. No match, or a source older than the newest
 * known version for the same citation, is `stale`/`unknown`: the caller
 * must verify with the issuer instead of assuming currentness.
 */
export function resolveSourceVersion(
  reference: VersionReferenceInput,
  knownVersions: readonly KnownSourceVersion[],
): SourceVersionOutcome {
  const citation = reference.citation.trim();
  const matched = knownVersions.find((version) => version.citation.trim() === citation) ?? null;
  if (matched) {
    if (matched.status === "superseded") {
      return {
        status: "superseded",
        matched,
        supersededByCitation: matched.supersededByCitation ?? null,
        whyItMatters:
          "A superseded source may no longer state the legally adopted rules; quoting from it risks a non-compliant installation.",
        nextHumanAction: matched.supersededByCitation
          ? `Use the superseding source ${matched.supersededByCitation} and confirm its effective date with the issuer.`
          : "Ask the issuer which version superseded this source and confirm its effective date.",
      };
    }
    return {
      status: "current",
      matched,
      supersededByCitation: null,
      whyItMatters: "The cited version is the newest known version in the registry for this citation.",
      nextHumanAction: "Reconfirm currentness on the job date; a newer amendment may exist outside the registry.",
    };
  }
  const stale = knownVersions.some(
    (version) =>
      version.citation.trim().startsWith(citation.split(" ")[0] ?? citation) &&
      reference.sourceDate &&
      version.effectiveDate &&
      version.effectiveDate > reference.sourceDate,
  );
  return {
    status: stale ? "stale" : "unknown",
    matched: null,
    supersededByCitation: null,
    whyItMatters:
      "The cited source has no matching version in the registry, so its currentness cannot be established from TradeOS data.",
    nextHumanAction: "Verify the current adopted version and effective date directly with the issuing authority.",
  };
}

/** Citation + source hash only. Full model-code text is never stored. */
export function citationSourceHash(citation: string, sourceUrl: string): string {
  return createHash("sha256").update(`${citation.trim()}\n${sourceUrl.trim()}`, "utf8").digest("hex");
}

export interface EnrichableCodeReference {
  id: string;
  title: string;
  issuer: string;
  citation: string;
  state: string;
  county: string | null;
  sourceUrl: string;
  sourceDate: string | null;
  reviewedAt: string;
  topics: readonly string[];
  summary: string;
  nextAction: string;
}

export interface EnrichedCodeReference extends EnrichableCodeReference {
  applicability: "unverified";
  sourceHash: string;
  version: SourceVersionOutcome;
  whyItMatters: string;
  nextHumanAction: string;
}

export interface EnrichedCodeReferences {
  status: "advisory";
  disclaimer: string;
  jurisdiction: JurisdictionOutcome;
  items: EnrichedCodeReference[];
  total: number;
}

/**
 * Enriches advisory code references with jurisdiction + version
 * resolution. Advisory only: every item stays applicability
 * "unverified", and nothing here certifies compliance, approves a
 * permit, or injects advice into the estimator.
 */
export function enrichCodeReferences(
  items: readonly EnrichableCodeReference[],
  jurisdictionInput: JurisdictionInput,
  knownVersions: readonly KnownSourceVersion[],
): EnrichedCodeReferences {
  const jurisdiction = resolveJurisdiction(jurisdictionInput);
  return {
    status: "advisory",
    disclaimer: JURISDICTION_DISCLAIMER,
    jurisdiction,
    items: items.map((item) => {
      const version = resolveSourceVersion(
        { citation: item.citation, sourceDate: item.sourceDate, reviewedAt: item.reviewedAt },
        knownVersions,
      );
      return {
        ...item,
        applicability: "unverified" as const,
        sourceHash: citationSourceHash(item.citation, item.sourceUrl),
        version,
        whyItMatters:
          "This source may govern part of the proposed work, but applicability depends on the verified parcel jurisdiction and the current adopted version — neither is established by the link alone.",
        nextHumanAction: item.nextAction,
      };
    }),
    total: items.length,
  };
}
