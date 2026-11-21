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
