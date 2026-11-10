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

function requiredTopics(workType: string, site: SiteInput): string[] {
  const topics: string[] = ["permits"];
  if (SIGNAGE_WORK.test(workType)) topics.push("signage");
  if (ELECTRICAL_WORK.test(workType)) topics.push("electrical");
  if (STRUCTURAL_WORK.test(workType)) topics.push("structural");
  if (/right-of-way|right of way|\brow\b/i.test(workType)) topics.push("right-of-way");
  if (site.nearStateRoad === true || site.crossesRoadEdge === true) topics.push("right-of-way");
  return [...new Set(topics)];
}

function isCurrent(record: JurisdictionRecord, now: Date): boolean {
  if (record.status !== "reviewed") return false;
  if (record.expiresAt) {
    const expiry = new Date(record.expiresAt);
    if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime()) return false;
  }
  const reviewed = new Date(record.reviewedAt);
  if (Number.isNaN(reviewed.getTime())) return false;
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
  // alone does not identify the site.
  const hasParcelId = Boolean(site.parcelId?.trim());
  const hasCoordinates =
    typeof site.latitude === "number" &&
    Number.isFinite(site.latitude) &&
    typeof site.longitude === "number" &&
    Number.isFinite(site.longitude);
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
    return needsVerificationResult();
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
    distinctions.rightOfWay = "not_applicable";
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
      citations: records
        .filter((record) => record.status === "reviewed")
        .map((record) =>
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
