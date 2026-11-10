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
/**
 * Codes & Permits governed source registry — contract types (issue #946,
 * TODO 3: official source/review pipeline).
 *
 * These types mirror the TODO 2 table contract EXACTLY as implemented in
 * PR #960 (`feat/codes-permits-registry-946`, head `9cdea60d`, migration
 * `20261109220000_add_codes_authority_jurisdiction_source` — verified live
 * against that branch; the TODO 2 text handed to this slice was
 * abbreviated, and the differences below were reconciled from #960):
 *
 *   codes_source (id, jurisdiction_id NULLABLE, authority_id, code_family,
 *   section, citation, title, source_url, source_hash NULLABLE,
 *   license_note, published_date, amended_date, effective_date,
 *   expiry_date, status research|reviewed|superseded, reviewed_at,
 *   reviewed_by TEXT, version_label NULLABLE, supersedes_id,
 *   topics text[] DEFAULT '{}', summary, next_action,
 *   created_at, updated_at)
 *   UNIQUE (authority_id, code_family, citation, version_label), plus a
 *   partial unique index enforcing the singleton when version_label IS NULL.
 *
 *   codes_source_history (id, source_id FK -> codes_source(id),
 *   version_label NOT NULL, source_hash NULLABLE, status,
 *   change_summary, recorded_at DEFAULT now(), recorded_by TEXT)
 *   — an event log, NOT a full-row snapshot: there is NO `snapshot` jsonb
 *   column and NO `codes_source_id` column. History entries record the
 *   version label, hash, status, a change summary, and who recorded it.
 *   Seed rows are unversioned (version_label NULL, source_hash NULL);
 *   the first governed fetch versions them, and a superseded seed row's
 *   history entry records version_label as 'unversioned'.
 *
 * Rules this module enforces everywhere downstream:
 * - No full code text is ever stored: only citation + URL + sha256 hash +
 *   metadata. Copyrighted model codes must not be copied.
 * - No guessed dates: published/amended/effective/expiry dates are NULL
 *   unless the source itself states them.
 * - A reviewed row's content is never edited in place: a new version
 *   supersedes it (old status -> 'superseded', `supersedesId` linkage).
 * - Nothing is ever auto-published: a new version always starts as
 *   'research' and only an explicit human approval flips research ->
 *   reviewed.
 */

/** Lifecycle of one `codes_source` version row. */
export type CodeSourceStatus = "research" | "reviewed" | "superseded";

/** One version row of `codes_source`, exactly the TODO 2 columns. */
export interface CodeSourceRow {
  id: string;
  jurisdictionId: string;
  authorityId: string;
  codeFamily: string;
  section: string | null;
  citation: string;
  title: string;
  sourceUrl: string;
  /**
   * Lowercase hex sha256 of the exact bytes fetched from `sourceUrl`.
   * NULL on TODO 2 seed rows: the hash is set on the first governed fetch.
   * Rows created by ingestion always carry a hash.
   */
  sourceHash: string | null;
  licenseNote: string | null;
  /** YYYY-MM-DD, or null when the source itself states no date. Never guessed. */
  publishedDate: string | null;
  /** YYYY-MM-DD, or null when the source itself states no date. Never guessed. */
  amendedDate: string | null;
  /** YYYY-MM-DD, or null when the source itself states no date. Never guessed. */
  effectiveDate: string | null;
  /** YYYY-MM-DD, or null when the source itself states no date. Never guessed. */
  expiryDate: string | null;
  status: CodeSourceStatus;
  /** ISO timestamp of the human approve/reject decision, or null while unreviewed. */
  reviewedAt: string | null;
  /** Real authenticated user id of the human reviewer, or null while unreviewed. Never a free-text name. Stored as text (TODO 2 column type). */
  reviewedBy: string | null;
  /**
   * Auto-generated `v<n>` within one cited source (authority, family,
   * citation), assigned under an advisory lock.
   * NULL on TODO 2 seed rows (unversioned); rows created by ingestion always carry one.
   */
  versionLabel: string | null;
  /** Previous head this version supersedes, or null for the first version. */
  supersedesId: string | null;
}

/** Stale/superseded signals surfaced on reads. Never silently hidden. */
export type CodeSourceWarning = "expired" | "superseded" | "superseded_by_newer_version";

/** A `codes_source` row as returned by the API, with computed warnings. */
export interface CodeSourceDTO extends CodeSourceRow {
  /** True when another version row names this row in its `supersedesId`. */
  hasNewerVersion: boolean;
  warnings: CodeSourceWarning[];
}

/**
 * Compute stale/superseded warnings for one row.
 *
 * - `expired`: a reviewed source whose `expiryDate` has passed.
 * - `superseded`: the row's own status is `superseded`.
 * - `superseded_by_newer_version`: a newer version exists but this row was
 *   not itself flipped to `superseded` (defensive: the pipeline always
 *   flips the old head on insert, so this should not occur through the
 *   service — it guards against rows written by another path).
 *
 * `todayUtc` is a `YYYY-MM-DD` UTC date; callers pass it so tests can pin it.
 */
export function computeSourceWarnings(
  row: Pick<CodeSourceRow, "status" | "expiryDate">,
  options: { hasNewerVersion: boolean; todayUtc?: string },
): CodeSourceWarning[] {
  const warnings: CodeSourceWarning[] = [];
  const today = options.todayUtc ?? new Date().toISOString().slice(0, 10);
  if (row.status === "reviewed" && row.expiryDate && row.expiryDate < today) {
    warnings.push("expired");
  }
  if (row.status === "superseded") {
    warnings.push("superseded");
  } else if (options.hasNewerVersion) {
    warnings.push("superseded_by_newer_version");
  }
  return warnings;
}

/** Attach computed warnings to a store row. */
export function toCodeSourceDTO(
  row: CodeSourceRow & { hasNewerVersion: boolean },
  options: { todayUtc?: string } = {},
): CodeSourceDTO {
  const { hasNewerVersion, ...rest } = row;
  return {
    ...rest,
    hasNewerVersion,
    warnings: computeSourceWarnings(row, { hasNewerVersion, todayUtc: options.todayUtc }),
  };
}
