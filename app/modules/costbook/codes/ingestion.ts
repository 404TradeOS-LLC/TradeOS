/**
 * Governed official-source ingestion service (issue #946, TODO 3).
 *
 * Pipeline (explicit human trigger ONLY — there is no background fetch,
 * scraper, or cron anywhere in this slice; a scheduled fetcher is a
 * separate, separately-approved slice):
 *
 *   1. Authorize: ingest/approve/reject require `costbook.manage`
 *      (owner/admin). Reads require `costbook.read`. These service checks
 *      are defense-in-depth — the controller enforces the same gates —
 *      mirroring the BLS/Jones ingestion services.
 *   2. Validate the URL against the official-host allowlist BEFORE any
 *      network call (`./sourceAllowlist.ts`). Untrusted URLs are refused
 *      with no fetch attempted.
 *   3. Fetch the source, hash the exact bytes (sha256). The bytes are
 *      hashed and discarded — never stored, parsed, or logged. No full
 *      code text is ever persisted.
 *   4. Hash-compare against the current head under an advisory lock.
 *      Unchanged content is an idempotent no-op: re-running ingestion is
 *      safe and writes nothing.
 *   5. On a hash change, insert a NEW version row with status `research`
 *      and a history entry. The old head is superseded, never mutated.
 *      Nothing is ever auto-published: only an explicit human approval
 *      flips `research` -> `reviewed`.
 *
 * Dates are NULL unless the caller supplies source-stated dates. The
 * service never invents a published/amended/effective/expiry date, and
 * it never infers one from a fetch timestamp or a filename.
 *
 * Review decisions are claimed with a status predicate (approve/reject
 * are mutually exclusive under concurrent review) and recorded twice in
 * the same transaction: a `codes_source_history` entry and an
 * org-scoped `ActivityEvent`. A rejection reason lives in the audit
 * event metadata — the TODO 2 contract has no reason column, so the
 * reason is deliberately NOT stored on the row.
 */
import { hasPermission } from "../../../domain";
import type { AuthContext } from "../../../backend/auth/context";
import { ApiError } from "../../../backend/middleware/errorHandler";
import {
  assertOfficialSourceUrl,
  fetchOfficialSourceBytes,
  sourceHashesEqual,
} from "./sourceAllowlist";
import { codesSourceStore, type CodesSourceStore, type IngestVersionInput } from "./store";
import { toCodeSourceDTO, type CodeSourceDTO, type CodeSourceStatus } from "./types";

/** Caller-supplied metadata for one source. Dates must come from the source itself; omit (NULL) when unstated. */
export interface IngestCodeSourceInput {
  jurisdictionId: string;
  authorityId: string;
  codeFamily: string;
  section?: string | null;
  citation: string;
  title: string;
  sourceUrl: string;
  licenseNote?: string | null;
  publishedDate?: string | null;
  amendedDate?: string | null;
  effectiveDate?: string | null;
  expiryDate?: string | null;
}

export interface IngestCodeSourceResult {
  outcome: "created" | "unchanged";
  source: CodeSourceDTO;
  /** sha256 hex of the exact bytes fetched. */
  sourceHash: string;
  fetchedBytes: number;
}

export interface CodesIngestionDeps {
  store?: CodesSourceStore;
  /** HTTP client; injectable for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function requireManage(auth: AuthContext): void {
  if (!hasPermission(auth.role, "costbook.manage")) {
    throw new ApiError(403, `Role "${auth.role}" does not have costbook.manage; cannot govern Codes & Permits sources`);
  }
}

function requireRead(auth: AuthContext): void {
  if (!hasPermission(auth.role, "costbook.read")) {
    throw new ApiError(403, `Role "${auth.role}" does not have costbook.read; cannot read Codes & Permits sources`);
  }
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function toInput(input: IngestCodeSourceInput, sourceHash: string): IngestVersionInput {
  return {
    jurisdictionId: input.jurisdictionId,
    authorityId: input.authorityId,
    codeFamily: input.codeFamily,
    section: input.section ?? null,
    citation: input.citation,
    title: input.title,
    sourceUrl: input.sourceUrl,
    sourceHash,
    licenseNote: input.licenseNote ?? null,
    publishedDate: input.publishedDate ?? null,
    amendedDate: input.amendedDate ?? null,
    effectiveDate: input.effectiveDate ?? null,
    expiryDate: input.expiryDate ?? null,
  };
}

/**
 * Fetch one official source and version it. Idempotent: a hash match with
 * the current head writes nothing and reports `unchanged`. A hash change
 * creates a new `research` version and supersedes the old head — never
 * auto-publishes, never edits a reviewed row in place.
 */
export async function ingestOfficialCodeSource(
  auth: AuthContext,
  input: IngestCodeSourceInput,
  deps: CodesIngestionDeps = {},
): Promise<IngestCodeSourceResult> {
  requireManage(auth);
  // Allowlist first: an untrusted URL throws before any fetch is attempted.
  assertOfficialSourceUrl(input.sourceUrl);
  const store = deps.store ?? codesSourceStore;

  const fetched = await fetchOfficialSourceBytes(input.sourceUrl, {
    fetchImpl: deps.fetchImpl,
    timeoutMs: deps.timeoutMs,
  });

  let result;
  try {
    result = await store.insertVersionIfChanged(toInput(input, fetched.sourceHash), {
      userId: auth.userId,
      orgId: auth.orgId,
    });
  } catch (error) {
    if (error instanceof Error && /violates foreign key constraint/i.test(error.message)) {
      throw new ApiError(422, "Unknown jurisdictionId or authorityId for this codes source");
    }
    throw error;
  }

  // The store already compared hashes under its lock; re-assert here so a
  // store that reports `created` for identical bytes can never publish a
  // duplicate version through this service.
  if (result.created && result.row.sourceHash !== fetched.sourceHash) {
    throw new ApiError(500, "Codes source version hash mismatch after insert");
  }
  if (!result.created && !sourceHashesEqual(result.row.sourceHash, fetched.sourceHash)) {
    throw new ApiError(500, "Codes source unchanged report does not match the fetched hash");
  }

  return {
    outcome: result.created ? "created" : "unchanged",
    source: toCodeSourceDTO({ ...result.row, hasNewerVersion: false }, { todayUtc: todayUtc() }),
    sourceHash: fetched.sourceHash,
    fetchedBytes: fetched.fetchedBytes,
  };
}

/** All sources, with stale/superseded warnings attached to each row. */
export async function listCodeSources(
  auth: AuthContext,
  filter: { status?: CodeSourceStatus; limit?: number } = {},
  deps: CodesIngestionDeps = {},
): Promise<{ status: "advisory"; disclaimer: string; total: number; items: CodeSourceDTO[] }> {
  requireRead(auth);
  const store = deps.store ?? codesSourceStore;
  const rows = await store.list(filter);
  const today = todayUtc();
  return {
    status: "advisory",
    disclaimer:
      "Source links are research leads only. Verify current amendments, parcel jurisdiction, code edition and permit applicability with the authority having jurisdiction before construction or pricing.",
    total: rows.length,
    items: rows.map((row) => toCodeSourceDTO(row, { todayUtc: today })),
  };
}

/** Pending review queue: `research`-status versions awaiting a human decision.
 * Only current heads are listed: a `research` row with a newer version is
 * stale (its successor superseded it) and cannot be approved, so it stays
 * visible in the full list with its warning instead of clogging the queue. */
export async function listCodeSourceReviewQueue(
  auth: AuthContext,
  deps: CodesIngestionDeps = {},
): Promise<{ status: "advisory"; total: number; items: CodeSourceDTO[] }> {
  requireRead(auth);
  const store = deps.store ?? codesSourceStore;
  const rows = await store.list({ status: "research", limit: 100 });
  const today = todayUtc();
  const heads = rows.filter((row) => !row.hasNewerVersion);
  return { status: "advisory", total: heads.length, items: heads.map((row) => toCodeSourceDTO(row, { todayUtc: today })) };
}

/** One source version by id, with warnings. */
export async function getCodeSource(
  auth: AuthContext,
  id: string,
  deps: CodesIngestionDeps = {},
): Promise<CodeSourceDTO> {
  requireRead(auth);
  const store = deps.store ?? codesSourceStore;
  const row = await store.getById(id);
  if (!row) throw new ApiError(404, `Codes source ${id} not found`);
  return toCodeSourceDTO(row, { todayUtc: todayUtc() });
}

async function loadReviewableHead(
  store: CodesSourceStore,
  id: string,
): Promise<{ id: string }> {
  const row = await store.getById(id);
  if (!row) throw new ApiError(404, `Codes source ${id} not found`);
  if (row.status !== "research") {
    throw new ApiError(409, `Codes source ${id} has already been reviewed (${row.status})`);
  }
  if (row.hasNewerVersion) {
    throw new ApiError(409, `Codes source ${id} has a newer version; review the latest version instead`);
  }
  return { id: row.id };
}

/**
 * Approve a `research` version: `research` -> `reviewed`, with
 * `reviewedBy` = the authenticated caller's real user id and
 * `reviewedAt` = now. Only the current head may be approved. A rejected
 * or already-reviewed row cannot be approved (409).
 */
export async function approveCodeSource(
  auth: AuthContext,
  id: string,
  options: { reviewNotes?: string | null } = {},
  deps: CodesIngestionDeps = {},
): Promise<CodeSourceDTO> {
  requireManage(auth);
  const store = deps.store ?? codesSourceStore;
  await loadReviewableHead(store, id);
  const row = await store.transition({
    id,
    toStatus: "reviewed",
    decision: "approved",
    actorUserId: auth.userId,
    orgId: auth.orgId,
    reviewNotes: options.reviewNotes ?? null,
  });
  return toCodeSourceDTO({ ...row, hasNewerVersion: false }, { todayUtc: todayUtc() });
}

/**
 * Reject a `research` version: `research` -> `superseded`, with the
 * reason recorded in the audit event. A reason is required — a silent
 * rejection leaves no trace of why. Only the current head may be rejected.
 */
export async function rejectCodeSource(
  auth: AuthContext,
  id: string,
  options: { reason: string; reviewNotes?: string | null },
  deps: CodesIngestionDeps = {},
): Promise<CodeSourceDTO> {
  requireManage(auth);
  if (!options.reason || options.reason.trim().length === 0) {
    throw new ApiError(400, "A rejection reason is required");
  }
  const store = deps.store ?? codesSourceStore;
  await loadReviewableHead(store, id);
  const row = await store.transition({
    id,
    toStatus: "superseded",
    decision: "rejected",
    actorUserId: auth.userId,
    orgId: auth.orgId,
    reason: options.reason,
    reviewNotes: options.reviewNotes ?? null,
  });
  return toCodeSourceDTO({ ...row, hasNewerVersion: false }, { todayUtc: todayUtc() });
}
