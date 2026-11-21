/**
 * Verified parcel/jurisdiction matching (issue #946, TODO 4).
 *
 * Pure function: no database, no network, no outbound fetch. It resolves a
 * governing jurisdiction only from caller-supplied, reviewed records — the
 * shape TODO 2 will persist in codes_authority / codes_jurisdiction /
 * codes_source — plus explicit site facts from the Project record and
 * contractor-supplied parcel evidence.
 *
 * FAIL CLOSED. A `verified` outcome requires ALL of:
 *   1. an identifiable site (verified parcel id, or coordinates + address);
 *   2. at least one reviewed, unexpired record for the state scope;
 *   3. exactly one governing local authority (no ambiguous overlap);
 *   4. incorporated vs unincorporated status known, with a matching
 *      municipal record when incorporated or county record when not;
 *   5. zoning district known;
 *   6. when the work is near / crosses a road edge, a surveyed
 *      right-of-way / easement boundary verified (the road edge is not the
 *      parcel boundary);
 *   7. for signage work, on- vs off-premises category confirmed, plus sign
 *      height/type and structural/foundation design confirmed;
 *   8. for electrical work, listing and authorized connection confirmed;
 *   9. records covering every topic the work type requires.
 *
 * Checks accumulate: a `needs_verification` result lists EVERY open
 * question, so the contractor sees the full verification checklist instead
 * of one failure at a time. No match is a valid result, never an error to
 * paper over. This module never outputs a setback, footing diameter/depth,
 * wiring method, or permit fee — the resolution type has no fields for them.
 */
import { createHash } from "node:crypto";

import type {
  AssessmentCitation,
  DistinctionState,
  JurisdictionRecord,
  JurisdictionResolution,
  SiteInput,
} from "./types";

export interface JurisdictionRecordStore {
  /** Reviewed jurisdiction records for a site, in TODO 2 record shape. */
  listForSite(site: SiteInput): Promise<JurisdictionRecord[]>;
}

/**
 * Fail-closed store used until TODO 2's tables land. It always returns no
 * records, so the API resolves every project to `needs_verification` rather
 * than guessing a jurisdiction. Replace with the TODO 2 database-backed
 * store when codes_authority / codes_jurisdiction / codes_source merge —
 * the matcher itself needs no change.
 */
export const emptyJurisdictionRecordStore: JurisdictionRecordStore = {
  async listForSite(): Promise<JurisdictionRecord[]> {
    return [];
  },
};

const SIGNAGE_WORK = /\bsigns?\b|\bsignage\b/i;
const ELECTRICAL_WORK = /electr(ic|rical)|wiring|conduit|circuit/i;
const STRUCTURAL_WORK = /structur|foundat|footing|sonotube|frost/i;
const RIGHT_OF_WAY_WORK = /right-of-way|right of way|\brow\b/i;

/** The same work-type classification `requiredTopics` uses for right-of-way. */
function requiresRightOfWay(workType: string): boolean {
  return RIGHT_OF_WAY_WORK.test(workType);
}

function requiredTopics(workType: string, site: SiteInput): string[] {
  const topics: string[] = ["permits"];
  if (SIGNAGE_WORK.test(workType)) topics.push("signage");
  if (ELECTRICAL_WORK.test(workType)) topics.push("electrical");
  if (STRUCTURAL_WORK.test(workType)) topics.push("structural");
  if (requiresRightOfWay(workType)) topics.push("right-of-way");
  if (site.nearStateRoad === true || site.crossesRoadEdge === true) topics.push("right-of-way");
  return [...new Set(topics)];
}

/**
 * Strict calendar-date check. Native `new Date(...)` silently normalizes
 * calendar-invalid dates (`2026-02-30` becomes 2026-03-02), which would
 * let a record with an impossible edition date count as current. An ISO
 * date prefix must round-trip through its year/month/day components
 * (leap years included); any other string keeps the native NaN check.
 */
function isValidCalendarDate(value: string): boolean {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return true;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const roundTripped = new Date(Date.UTC(year, month - 1, day));
  return (
    roundTripped.getUTCFullYear() === year &&
    roundTripped.getUTCMonth() === month - 1 &&
    roundTripped.getUTCDate() === day
  );
}

function isCurrent(record: JurisdictionRecord, now: Date): boolean {
  if (record.status !== "reviewed") return false;
  if (record.expiresAt) {
    if (!isValidCalendarDate(record.expiresAt)) return false;
    const expiry = new Date(record.expiresAt);
    if (expiry.getTime() <= now.getTime()) return false;
  }
  if (!isValidCalendarDate(record.reviewedAt)) return false;
  // A reviewed record whose edition is not yet in force cannot verify a
  // match — otherwise a future code edition would certify today's job.
  if (record.effectiveFrom) {
    if (!isValidCalendarDate(record.effectiveFrom)) return false;
    const effective = new Date(record.effectiveFrom);
    if (effective.getTime() > now.getTime()) return false;
  }
  return true;
}

function normalizeCounty(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/ county$/, "");
}

function citationFor(record: JurisdictionRecord, rationale: string): AssessmentCitation {
  return { source_id: record.id, rationale };
}

export function resolveJurisdiction(
  site: SiteInput,
  records: readonly JurisdictionRecord[],
  workType: string,
  now: Date = new Date(),
): JurisdictionResolution {
  const reasons: string[] = [];
  const failures: string[] = [];
  const openQuestions: string[] = [];
  const work = workType.trim();
  const distinctions: JurisdictionResolution["distinctions"] = {
    parcelBoundary: "unknown",
    rightOfWay: "unknown",
    incorporatedStatus: "unknown",
    zoningOverlays: "unknown",
    signCategory: "unknown",
  };
  const fail = (reason: string, question: string): void => {
    reasons.push(reason);
    failures.push(reason);
    openQuestions.push(question);
  };

  // 1. Site identifiability — a street name or highway alone is not a parcel.
  // Rule 1: a verified parcel ID, or coordinates plus address. An address
  // alone does not identify the site. Coordinates must be geographically
  // possible: latitude within [-90, 90], longitude within [-180, 180].
  const hasParcelId = Boolean(site.parcelId?.trim());
  const hasCoordinates =
    typeof site.latitude === "number" &&
    Number.isFinite(site.latitude) &&
    site.latitude >= -90 &&
    site.latitude <= 90 &&
    typeof site.longitude === "number" &&
    Number.isFinite(site.longitude) &&
    site.longitude >= -180 &&
    site.longitude <= 180;
  const hasAddress = Boolean(site.siteAddress?.trim());
  if (!hasParcelId && !(hasCoordinates && hasAddress)) {
    fail(
      "no_verifiable_site",
      "Provide a verified parcel ID, or a verified site address with coordinates, before jurisdiction can be resolved.",
    );
  }
  if (hasParcelId || hasCoordinates) distinctions.parcelBoundary = "verified";

  // 2. Only reviewed, unexpired records count. Stale/superseded/research
  // records are reported, never used.
  const current = records.filter((record) => isCurrent(record, now));
  for (const record of records.filter((record) => !isCurrent(record, now))) {
    reasons.push(`unusable_record:${record.id}:${record.status}`);
  }
  if (current.length === 0) {
    fail(
      "no_reviewed_current_records",
      "No reviewed, current jurisdiction records are available for this site. Confirm the governing authorities with the authority having jurisdiction.",
    );
    // No early return: checks 3–9 still run and accumulate every open
    // question (state scope, incorporation, zoning, ROW, signage,
    // electrical, topics) so the contractor sees the full checklist even
    // when no record is current. Checks 3, 4, and 9 already fail closed
    // on an empty `current` set.
  }

  // 3. State scope must be covered by a reviewed state-level record.
  const state = (site.state ?? "").trim().toUpperCase();
  const stateRecords = state
    ? current.filter((record) => record.level === "state" && record.state.toUpperCase() === state)
    : [];
  if (stateRecords.length === 0) {
    fail(
      "no_state_authority_record",
      state
        ? `Confirm the governing state authority for ${state} and the adopted code edition in effect on the job date.`
        : "Confirm the state for this site and the governing state authority.",
    );
  }

  // 4. Incorporated vs unincorporated must be known, with a matching local record.
  let localRecords: JurisdictionRecord[] = [];
  if (site.incorporated === null || site.incorporated === undefined) {
    fail(
      "incorporated_status_unknown",
      "Confirm whether the site is inside incorporated city/town limits or on unincorporated county land — the governing local authority depends on it.",
    );
  } else {
    distinctions.incorporatedStatus = "verified";
    const county = normalizeCounty(site.county);
    const municipality = (site.city ?? "").trim().toLowerCase();
    if (site.incorporated) {
      // Fail closed: a missing municipality never matches any municipal
      // record, and a missing county never matches a record that claims a
      // county. A record with no county of its own may still match on the
      // municipality — it claims no county scope to contradict.
      localRecords = current.filter(
        (record) =>
          record.level === "municipal" &&
          Boolean(state) &&
          record.state.toUpperCase() === state &&
          Boolean(municipality) &&
          (record.municipality ?? "").trim().toLowerCase() === municipality &&
          (!record.county || (Boolean(county) && normalizeCounty(record.county) === county)),
      );
      if (localRecords.length === 0) {
        fail(
          "no_municipal_authority_record",
          "Confirm the governing municipal authority, zoning, and sign/building permit office for this incorporated site.",
        );
      }
    } else {
      // Fail closed: a missing county never matches any county record.
      localRecords = current.filter(
        (record) =>
          record.level === "county" &&
          Boolean(state) &&
          record.state.toUpperCase() === state &&
          Boolean(county) &&
          normalizeCounty(record.county) === county,
      );
      if (localRecords.length === 0) {
        fail(
          "no_county_authority_record",
          "Confirm the governing county authority, zoning, and permit office for this unincorporated site.",
        );
      }
    }
    // Ambiguity: two different authorities claiming the same local scope.
    const localAuthorities = [...new Set(localRecords.map((record) => record.authority))];
    if (localAuthorities.length > 1) {
      fail(
        "ambiguous_local_authority",
        `More than one local authority claims this site (${localAuthorities.join(", ")}). Confirm which authority governs this parcel before proceeding.`,
      );
    }
  }

  // 5. Zoning district and overlays must be known.
  if (!site.zoningDistrict?.trim()) {
    fail(
      "zoning_district_unknown",
      "Confirm the zoning district and any overlays for the parcel with the planning office — district, sign rules, and setbacks depend on it.",
    );
  } else {
    distinctions.zoningOverlays = "verified";
  }

  // 6. Road right-of-way / easement: the road edge is not the parcel
  // boundary, and a fence-side run is not automatically an occupancy permit.
  const nearRoad = site.nearStateRoad === true || site.crossesRoadEdge === true;
  if (nearRoad) {
    if (site.rightOfWayBoundaryVerified !== true) {
      fail(
        "right_of_way_unverified",
        "Identify the surveyed right-of-way and easement boundaries for this site, and confirm whether the work stays on private property or enters state right-of-way. The legal parcel boundary is not the road edge; confirm whether an occupancy permit applies.",
      );
    } else {
      distinctions.rightOfWay = "verified";
    }
  } else {
    // Explicit right-of-way work is never "not applicable" — the road
    // flags are simply unknown, so the distinction stays unknown. The
    // surveyed-boundary confirmation stays tied to road-edge proximity
    // (the `nearRoad` branch above), not to the work-type classification.
    distinctions.rightOfWay = requiresRightOfWay(work) ? "unknown" : "not_applicable";
  }

  // 7. Signage work needs an explicit on- vs off-premises classification,
  // plus confirmed sign height/type and structural/foundation design.
  const isSignage = SIGNAGE_WORK.test(work);
  if (isSignage) {
    if (!site.signCategory) {
      fail(
        "sign_category_unknown",
        "Confirm whether the sign is on-premises or off-premises — the permit route, controlling authority, and classification depend on it, and proximity to a state road alone does not decide it.",
      );
    } else {
      distinctions.signCategory = "verified";
    }
    if (site.signDetailsVerified !== true) {
      fail(
        "sign_details_unverified",
        "Confirm the sign height, sign type, structural engineering, and foundation/footing design with the building authority and the engineer of record. No footing diameter, footing depth, or setback is inferred here.",
      );
    }
  } else {
    distinctions.signCategory = "not_applicable";
  }

  // 8. Electrical work needs listing and authorized connection confirmed.
  if (ELECTRICAL_WORK.test(work) && site.electricalConnectionVerified !== true) {
    fail(
      "electrical_connection_unverified",
      "Confirm the electrical listing, wiring method, authorized installer, and authorized connection with the electrical authority. No wiring method is inferred here.",
    );
  }

  // 9. Every topic the work type requires must be covered by a current
  // record for a matched authority — a record for another state, county,
  // or level cannot cover a topic for this site.
  const topics = requiredTopics(work, site);
  const covered = new Set([...stateRecords, ...localRecords].flatMap((record) => record.topics));
  const missingTopics = topics.filter((topic) => !covered.has(topic));
  if (missingTopics.length > 0) {
    fail(
      `missing_topics:${missingTopics.join(",")}`,
      `Confirm the applicable ${missingTopics.join(", ")} requirements with the authority having jurisdiction — no reviewed source on file covers them for this site.`,
    );
  }

  // Blocking failures decide the outcome; informational notes (e.g. a
  // superseded record on file alongside current ones) stay in `reasons`
  // without blocking a verified match.
  if (failures.length > 0) return needsVerificationResult();

  const matched = [...stateRecords, ...localRecords];
  return {
    outcome: "verified",
    matched,
    citations: matched.map((record) =>
      citationFor(record, `Governing ${record.level} authority for this site: ${record.citation}.`),
    ),
    openQuestions: [],
    reasons: [...reasons, "verified_match"],
    distinctions,
    workType: work,
  };

  function needsVerificationResult(): JurisdictionResolution {
    return {
      outcome: "needs_verification",
      matched: [],
      // Cite only current records: an expired or otherwise unusable record
      // is reported as `unusable_record` in `reasons` and must not also be
      // presented as a consulted source.
      citations: current.map((record) =>
        citationFor(
          record,
          `Reviewed source consulted; not sufficient on its own to verify jurisdiction for this site: ${record.citation}.`,
        ),
      ),
      openQuestions,
      reasons,
      distinctions,
      workType: work,
    };
  }
}

/** Convenience: a resolution always carries a reason list; never empty. */
export function resolutionSummary(resolution: JurisdictionResolution): string {
  if (resolution.outcome === "verified") {
    return `Verified jurisdiction for ${resolution.workType}: ${resolution.matched.map((record) => record.authority).join(", ")}.`;
  }
  return `Jurisdiction needs verification for ${resolution.workType}: ${resolution.reasons.join("; ")}.`;
}

export type { DistinctionState };

/**
 * Athena enrichment for Codes & Permits (issue #946, TODO 5).
 *
 * Pure functions only — no database access, no outbound fetch, no
 * auto-injection into the estimator. This enriches the pilot
 * codeReferences Athena tool (#945) with parcel/jurisdiction and
 * version resolution. Fail-closed throughout: missing, stale, or
 * ambiguous jurisdiction resolves to `needs_verification`.
 *
 * NOTE (rebase onto main 39c17cd7, #961 merged): the TODO 4 matcher
 * above owns `resolveJurisdiction` / `JurisdictionResolution`. This
 * section's advisory variant is `resolveAdvisoryJurisdiction` /
 * `AdvisoryJurisdictionResolution` to avoid colliding with it.
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

export type AdvisoryJurisdictionResolution = "verified" | "needs_verification";

export interface JurisdictionOutcome {
  resolution: AdvisoryJurisdictionResolution;
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
 * verifies a parcel's jurisdiction. When the registry is supplied, the
 * check applies to the edition the input names — matched by effective
 * date via the input's sourceEffectiveDate or a date-like sourceVersion
 * — and only to the jurisdiction's own source citation, so unrelated
 * superseded reference items never invalidate a current jurisdiction
 * source. A named edition that is superseded, or older than the newest
 * known edition for the same citation, fails verification; an
 * equal-date current edition stays verified. When the named edition
 * cannot be matched to a registry entry and the citation has a
 * superseded entry, verification fails closed.
 */
export function resolveAdvisoryJurisdiction(
  input: JurisdictionInput,
  knownVersions: readonly KnownSourceVersion[] = [],
): JurisdictionOutcome {
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
  const sourceCitation = input.sourceCitation!.trim();
  const sameCitation = knownVersions.filter((version) => version.citation.trim() === sourceCitation);
  // The registry entry for the edition the input names, matched on
  // effective date via the input's sourceEffectiveDate or a date-like
  // sourceVersion. Matching by citation alone would reject an input
  // that names the current edition whenever an older superseded entry
  // shares the citation, and would miss a stale edition the input
  // does name. The newest entry is never the match: selecting it
  // would verify an input that names the superseded edition.
  const namedEntry = sameCitation.find(
    (version) =>
      !!version.effectiveDate &&
      (version.effectiveDate === input.sourceEffectiveDate?.trim() ||
        version.effectiveDate === asDate(input.sourceVersion)),
  );
  const supersededOutcome = (entry: KnownSourceVersion): JurisdictionOutcome => ({
    resolution: "needs_verification",
    jurisdiction: null,
    missing: [
      `jurisdiction source ${sourceCitation} is superseded${
        entry.supersededByCitation ? ` by ${entry.supersededByCitation}` : ""
      }`,
    ],
    whyItMatters,
    nextHumanAction: entry.supersededByCitation
      ? `Use the superseding source ${entry.supersededByCitation} and confirm the parcel jurisdiction with the issuing authority.`
      : "Ask the issuer which version superseded this jurisdiction source and confirm the parcel jurisdiction.",
  });
  if (namedEntry?.status === "superseded") {
    return supersededOutcome(namedEntry);
  }
  // A named edition older than the newest known edition for the same
  // citation is stale, even when no entry is marked superseded — the
  // same comparison resolveSourceVersion makes. An equal-date current
  // edition stays valid.
  const newest = newestByEffectiveDate(sameCitation);
  const editionDate = namedEntry?.effectiveDate ?? asDate(input.sourceEffectiveDate) ?? asDate(input.sourceVersion);
  if (editionDate && newest?.effectiveDate && editionDate < newest.effectiveDate) {
    return {
      resolution: "needs_verification",
      jurisdiction: null,
      missing: [
        `jurisdiction source ${sourceCitation} cites the ${editionDate} edition, but the registry holds a newer ${newest.effectiveDate} edition`,
      ],
      whyItMatters,
      nextHumanAction: "Verify the current adopted version and effective date directly with the issuing authority.",
    };
  }
  // Fail closed when the edition the input names cannot be matched to a
  // registry entry and the citation has a superseded entry: the input
  // cannot be established as naming the current edition.
  if (!namedEntry) {
    const supersededEntry = sameCitation.find((version) => version.status === "superseded");
    if (supersededEntry) {
      return supersededOutcome(supersededEntry);
    }
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
 * Source-family key for the no-exact-match stale check: the citation
 * with its trailing section/edition segment removed, so "675 IAC 13-2.6"
 * and "675 IAC 13-2.9" share a family ("675 IAC 13") but "675 IAC 17-1"
 * does not ("675 IAC 17") — a shared leading number alone never proves
 * a newer edition of the same source.
 */
function citationFamilyKey(citation: string): string {
  const normalized = citation.trim().replace(/\s+/g, " ").toUpperCase();
  const tokens = normalized.split(" ");
  if (tokens.length >= 3) {
    const article = /^(\d+)(?:[.-]|$)/.exec(tokens[2]);
    if (article) return `${tokens[0]} ${tokens[1]} ${article[1]}`;
  }
  const last = tokens[tokens.length - 1];
  if (/^§?\d+([.-]\d+)*$/.test(last) && tokens.length > 1) {
    return tokens.slice(0, -1).join(" ");
  }
  return normalized;
}

/** A date-like (YYYY-MM-DD) version label, or null when the label is not a plain date. */
function asDate(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

/** Newest entry by effective date; undated entries sort as oldest. */
function newestByEffectiveDate(entries: readonly KnownSourceVersion[]): KnownSourceVersion | null {
  let newest: KnownSourceVersion | null = null;
  for (const entry of entries) {
    if (!newest) {
      newest = entry;
      continue;
    }
    if (entry.effectiveDate && (!newest.effectiveDate || entry.effectiveDate > newest.effectiveDate)) {
      newest = entry;
    }
  }
  return newest;
}

/**
 * Version resolution against the TODO 2 source registry. Same-citation
 * entries are ordered by effective date: the NEWEST entry decides. A
 * superseded newest entry is still returned readably (with its
 * successor pointer) — history is never deleted or hidden. A reference
 * older than the newest known version for the same citation is `stale`.
 * No match, or a citation from an unrelated source family, is
 * `unknown`: the caller must verify with the issuer instead of
 * assuming currentness.
 *
 * Null dates: when the reference has no sourceDate, or the newest entry
 * has no effectiveDate, no dated staleness can be established, so the
 * newest known version stands as `current` — the caller must still
 * reconfirm currentness on the job date (see nextHumanAction).
 */
export function resolveSourceVersion(
  reference: VersionReferenceInput,
  knownVersions: readonly KnownSourceVersion[],
): SourceVersionOutcome {
  const citation = reference.citation.trim();
  const matched = newestByEffectiveDate(
    knownVersions.filter((version) => version.citation.trim() === citation),
  );
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
    if (reference.sourceDate && matched.effectiveDate && reference.sourceDate < matched.effectiveDate) {
      return {
        status: "stale",
        matched,
        supersededByCitation: null,
        whyItMatters:
          "The cited source is an older edition than the newest known version for the same citation; quoting from it risks a non-compliant installation.",
        nextHumanAction: "Verify the current adopted version and effective date directly with the issuing authority.",
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
      citationFamilyKey(version.citation) === citationFamilyKey(citation) &&
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
  const jurisdiction = resolveAdvisoryJurisdiction(jurisdictionInput, knownVersions);
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
