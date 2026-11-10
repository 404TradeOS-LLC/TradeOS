/**
 * Codes & Permits — jurisdiction matching and job-assessment types (issue #946, TODO 4).
 *
 * These types are the consumer contract for the TODO 2 authority/jurisdiction/
 * source tables (codes_authority / codes_jurisdiction / codes_source). This
 * module deliberately does NOT define those tables: the matcher is a pure
 * function over caller-supplied records, so it stays buildable and testable
 * before TODO 2 lands and never invents a governing rule from thin air.
 *
 * Fail-closed invariant: a resolution is `verified` only when every required
 * fact is supplied by a reviewed, current record. Anything else is
 * `needs_verification`. The resolution shape intentionally carries NO numeric
 * rule values — no setback, footing size/depth, wiring method, or permit fee
 * may ever be inferred by this module.
 */

export type AssessmentStatus = "needs_review" | "in_review" | "owner_approved" | "needs_verification";

export const assessmentStatuses: readonly AssessmentStatus[] = [
  "needs_review",
  "in_review",
  "owner_approved",
  "needs_verification",
];

/** A single citable authority reference carried by an assessment or resolution. */
export interface AssessmentCitation {
  /** Identifier of the reviewed source (TODO 2 codes_source id or pilot registry id). */
  source_id: string;
  /** Why this source is pertinent to the proposed work. Never a rule value. */
  rationale: string;
}

export type JurisdictionLevel = "state" | "county" | "municipal" | "special";

/**
 * One reviewed jurisdiction record, as TODO 2 will persist it. Until the
 * TODO 2 tables land, the only record store is the empty fail-closed store
 * (see jurisdiction.ts); tests supply fixture records in this shape.
 */
export interface JurisdictionRecord {
  id: string;
  authority: string;
  level: JurisdictionLevel;
  state: string;
  county?: string | null;
  municipality?: string | null;
  /** Only `reviewed` records may support a verified match. */
  status: "reviewed" | "research" | "superseded" | "stale";
  reviewedAt: string;
  effectiveFrom?: string | null;
  expiresAt?: string | null;
  topics: readonly string[];
  citation: string;
  sourceUrl: string;
}

/**
 * Site facts for one Project. Every field is optional because the Project
 * record only stores a free-text site address — there is no parcel store.
 * Missing facts are unknowns, never defaults: the matcher fails closed on
 * each one instead of guessing.
 */
export interface SiteInput {
  /** Authoritative parcel identifier, when the contractor supplies a verified one. */
  parcelId?: string | null;
  /** Free-text site address from the Project record. */
  siteAddress?: string | null;
  city?: string | null;
  county?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** True = inside incorporated city/town limits; false = unincorporated county land. Null = unknown. */
  incorporated?: boolean | null;
  /** Zoning district for the parcel, when verified (e.g. from the planning office). */
  zoningDistrict?: string | null;
  /** On- vs off-premises sign classification, when confirmed. Never inferred. */
  signCategory?: "on-premises" | "off-premises" | null;
  /** The proposed work path runs near a state road or road edge. */
  nearStateRoad?: boolean | null;
  /** The proposed work crosses the road edge. */
  crossesRoadEdge?: boolean | null;
  /** A surveyed right-of-way / easement boundary has been verified for this site. */
  rightOfWayBoundaryVerified?: boolean | null;
  /** Sign height, sign type, and structural/foundation design confirmed (signage work). */
  signDetailsVerified?: boolean | null;
  /** Electrical listing, wiring method, installer, and connection confirmed (electrical work). */
  electricalConnectionVerified?: boolean | null;
}

export type DistinctionState = "verified" | "unknown" | "not_applicable";

/**
 * The five distinctions issue #946 requires the matcher to keep apart.
 * Each is recorded as verified or unknown; none is ever defaulted.
 */
export interface JurisdictionDistinctions {
  /** Legal parcel boundary is established (parcel id or surveyed coordinates). */
  parcelBoundary: DistinctionState;
  /** Road right-of-way / easement boundary is established, distinct from the road edge. */
  rightOfWay: DistinctionState;
  /** Incorporated vs unincorporated status is established. */
  incorporatedStatus: DistinctionState;
  /** Zoning district and overlays are established. */
  zoningOverlays: DistinctionState;
  /** On- vs off-premises sign category is established (signage work only). */
  signCategory: DistinctionState;
}

export interface JurisdictionResolution {
  outcome: "verified" | "needs_verification";
  /** Records that support a verified match. Empty unless outcome is verified. */
  matched: JurisdictionRecord[];
  /** Citations with rationale, for assessment and hint surfaces. */
  citations: AssessmentCitation[];
  /** Human-actionable open questions. No question asserts a rule value. */
  openQuestions: string[];
  /** Machine-readable reasons the outcome is what it is. */
  reasons: string[];
  distinctions: JurisdictionDistinctions;
  /** Work type the resolution was computed for. */
  workType: string;
}

export interface CodesJobAssessmentDTO {
  id: string;
  orgId: string;
  projectId: string;
  estimateId: string | null;
  workType: string;
  status: AssessmentStatus;
  citations: AssessmentCitation[];
  unknowns: string[];
  ownerSignoff: boolean;
  signedOffBy: string | null;
  signedOffAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssessmentInput {
  orgId: string;
  projectId: string;
  estimateId?: string | null;
  workType: string;
  /** Owner approval is never set at creation; it requires the sign-off path. */
  status?: Exclude<AssessmentStatus, "owner_approved">;
  citations: AssessmentCitation[];
  unknowns: string[];
  createdBy?: string | null;
}

/** Read-only hints payload for one estimate. Financially inert by construction. */
export interface EstimateHints {
  estimateId: string;
  projectId: string;
  /** Echo of the saved estimate total, read-only. Hints never recompute it. */
  estimateTotal: number;
  /** Hints never change estimated cost. */
  financialEffect: "none";
  jurisdiction: JurisdictionResolution;
  assessments: CodesJobAssessmentDTO[];
  /** Quiet, nonblocking hint lines for the Scope/Review disclosure. */
  hints: string[];
  openQuestions: string[];
  citations: AssessmentCitation[];
  disclaimer: string;
}
