/**
 * Persistence boundary for the governed Codes & Permits source pipeline
 * (issue #946, TODO 3).
 *
 * The service in `./ingestion.ts` depends only on the `CodesSourceStore`
 * interface below (the Davis-Bacon store-injection pattern), so unit tests
 * run against an in-memory fake and never touch Postgres.
 *
 * `PrismaCodesSourceStore` is the production adapter. It uses raw SQL on
 * purpose: TODO 2 (PR #960, `feat/codes-permits-registry-946`) owns the
 * `codes_source` / `codes_source_history` Prisma models, which do not exist
 * on this branch yet (this branch is based on `main`; #960 is stacked on
 * the #945 pilot branch). Raw SQL against the exact TODO 2 column contract
 * — verified live against #960 head `9cdea60d` — keeps this slice compiling
 * and typechecking without those models, and keeps working unchanged once
 * they land.
 *
 * Write discipline (mirrors `app/db/resendDeliveryJournalStore.ts`):
 * - Every write runs in one transaction that FIRST sets the
 *   transaction-local `app.codes_ingestion` flag. The RLS policies in
 *   migration `20261109220000_add_codes_source_ingestion_rls` allow writes
 *   ONLY under that flag, and reads globally for any authenticated tenant
 *   session — so no tenant session can write these tables directly, and
 *   the governed service is the only writer. (The global SELECT policies
 *   themselves come from TODO 2's migration; this slice's migration adds
 *   only the flag function, the flag-scoped SELECT policies, and the
 *   flag-gated write policies — it must not re-create TODO 2's policies.)
 * - Version inserts take a per-citation advisory lock (the BLS/Jones
 *   ingestion pattern), so concurrent ingests of the same URL cannot fork
 *   the version chain.
 * - Every insert and every status transition appends one
 *   `codes_source_history` entry — `(source_id, version_label,
 *   source_hash, status, change_summary, recorded_by)` per #960 — and one
 *   org-scoped `ActivityEvent` (`entityType: "codes_source"`) in the same
 *   transaction, so a decision and its evidence commit together. History
 *   is an event log, not a full-row snapshot: there is no `snapshot`
 *   column. A superseded TODO 2 seed row (unversioned, `version_label`
 *   NULL) is recorded as `'unversioned'`, because the history
 *   `version_label` is NOT NULL.
 *
 * Contract notes reconciled from #960 (not the abbreviated TODO 2 text):
 * - `reviewed_by` is TEXT, not uuid: the reviewer id is written as plain
 *   text, never cast to uuid.
 * - `source_hash` and `version_label` are NULLABLE (TODO 2 seed rows carry
 *   NULL for both until the first governed fetch versions them).
 * - `codes_source` also carries presentation columns `topics` (text[],
 *   default '{}'), `summary`, `next_action`, which ingestion leaves at
 *   their defaults; and a UNIQUE on
 *   `(authority_id, code_family, citation, version_label)`, so two
 *   versions of one citation must differ in `version_label`.
 */
import { Prisma } from "@prisma/client";
import { ApiError } from "../../../backend/middleware/errorHandler";
import { basePrisma, prisma } from "../../../db/client";
import { runInDatabaseTransaction } from "../../../db/requestSession";
import type { CodeSourceRow, CodeSourceStatus } from "./types";

/** Input for one new `codes_source` version. Dates are NULL unless the source states them. */
export interface IngestVersionInput {
  jurisdictionId: string;
  authorityId: string;
  codeFamily: string;
  section: string | null;
  citation: string;
  title: string;
  sourceUrl: string;
  sourceHash: string;
  licenseNote: string | null;
  publishedDate: string | null;
  amendedDate: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
}

export interface InsertVersionResult {
  row: CodeSourceRow;
  /** False when the fetched bytes hash-matched the current head: idempotent no-op, nothing written. */
  created: boolean;
}

export interface ReviewTransitionInput {
  id: string;
  /** The only terminal states a review decision may set. */
  toStatus: "reviewed" | "superseded";
  decision: "approved" | "rejected";
  actorUserId: string;
  orgId: string;
  /** Required for rejections; recorded in the audit event (there is no reason column on the contract). */
  reason?: string | null;
  reviewNotes?: string | null;
}

export interface SourceIdentity {
  authorityId: string;
  codeFamily: string;
  citation: string;
}

export interface CodesSourceStore {
  /**
   * Current head of one cited source's version chain. The chain key is
   * (authority_id, code_family, citation) — TODO 2's unique key (#960).
   * It is deliberately NOT the URL: one official URL can host several
   * citations (the INDOT permits page serves both the sign-permit and the
   * occupancy guidance), and those are separate version chains.
   */
  findLatestByCitation(identity: SourceIdentity): Promise<(CodeSourceRow & { hasNewerVersion: boolean }) | null>;
  list(filter: { status?: CodeSourceStatus; limit?: number }): Promise<Array<CodeSourceRow & { hasNewerVersion: boolean }>>;
  getById(id: string): Promise<(CodeSourceRow & { hasNewerVersion: boolean }) | null>;
  /**
   * Hash-compare against the current head under an advisory lock, then
   * either no-op (hash matches) or insert a new `research` version that
   * supersedes the old head. Never auto-publishes.
   */
  insertVersionIfChanged(
    input: IngestVersionInput,
    actor: { userId: string; orgId: string },
  ): Promise<InsertVersionResult>;
  /**
   * Claim a `research` row for a human decision (409 if already decided,
   * 404 if unknown) and flip it to `reviewed` (approved) or `superseded`
   * (rejected), with history entry + audit event.
   */
  transition(input: ReviewTransitionInput): Promise<CodeSourceRow>;
}

/** Raw row shape returned by the SELECTs below (pg driver types). */
interface CodeSourceRawRow {
  id: string;
  jurisdiction_id: string;
  authority_id: string;
  code_family: string;
  section: string | null;
  citation: string;
  title: string;
  source_url: string;
  source_hash: string | null;
  license_note: string | null;
  published_date: string | null;
  amended_date: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  status: string;
  reviewed_at: Date | string | null;
  reviewed_by: string | null;
  version_label: string | null;
  supersedes_id: string | null;
  has_newer_version: boolean;
}

/** Bare column list, usable in SELECT and RETURNING. Date columns are cast to text (`YYYY-MM-DD`). */
const CODE_SOURCE_COLUMNS = Prisma.sql`
  id,
  jurisdiction_id,
  authority_id,
  code_family,
  section,
  citation,
  title,
  source_url,
  source_hash,
  license_note,
  published_date::text AS published_date,
  amended_date::text AS amended_date,
  effective_date::text AS effective_date,
  expiry_date::text AS expiry_date,
  status,
  reviewed_at,
  reviewed_by,
  version_label,
  supersedes_id
`;

function toCodeSourceRow(raw: CodeSourceRawRow): CodeSourceRow & { hasNewerVersion: boolean } {
  return {
    id: raw.id,
    jurisdictionId: raw.jurisdiction_id,
    authorityId: raw.authority_id,
    codeFamily: raw.code_family,
    section: raw.section,
    citation: raw.citation,
    title: raw.title,
    sourceUrl: raw.source_url,
    sourceHash: raw.source_hash,
    licenseNote: raw.license_note,
    publishedDate: raw.published_date,
    amendedDate: raw.amended_date,
    effectiveDate: raw.effective_date,
    expiryDate: raw.expiry_date,
    status: raw.status as CodeSourceStatus,
    reviewedAt:
      raw.reviewed_at instanceof Date
        ? raw.reviewed_at.toISOString()
        : typeof raw.reviewed_at === "string"
          ? raw.reviewed_at
          : null,
    reviewedBy: raw.reviewed_by,
    versionLabel: raw.version_label,
    supersedesId: raw.supersedes_id,
    hasNewerVersion: raw.has_newer_version,
  };
}

/** One append-only `codes_source_history` event entry (PR #960 columns). */
async function insertHistoryEntry(
  transaction: Prisma.TransactionClient,
  row: CodeSourceRow,
  changeSummary: string,
  recordedBy: string,
): Promise<void> {
  // History version_label is NOT NULL in #960, but TODO 2 seed rows are
  // unversioned (NULL). A superseded seed row is recorded as
  // 'unversioned' rather than dropping its history entry.
  await transaction.$queryRaw(
    Prisma.sql`
      insert into codes_source_history (source_id, version_label, source_hash, status, change_summary, recorded_by)
      values (${row.id}::uuid, ${row.versionLabel ?? "unversioned"}, ${textParam(row.sourceHash)}, ${row.status}, ${changeSummary}, ${recordedBy})
    `,
  );
}

const uuidParam = (value: string | null): Prisma.Sql =>
  value === null ? Prisma.sql`NULL` : Prisma.sql`${value}::uuid`;
const dateParam = (value: string | null): Prisma.Sql =>
  value === null ? Prisma.sql`NULL` : Prisma.sql`${value}::date`;
const textParam = (value: string | null): Prisma.Sql =>
  value === null ? Prisma.sql`NULL` : Prisma.sql`${value}`;

async function setIngestionFlag(transaction: Prisma.TransactionClient): Promise<void> {
  await transaction.$queryRaw(Prisma.sql`select set_config('app.codes_ingestion', 'true', true)`);
}

async function recordAuditEvent(
  transaction: Prisma.TransactionClient,
  input: {
    orgId: string;
    sourceId: string;
    eventType: string;
    title: string;
    actorUserId: string;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  // Mirrors CostbookCandidateService.recordCandidateAuditEvent: the
  // activityEvent model is optional on the transaction type only so
  // lightweight mocked-Prisma tests do not have to stub it; in a real
  // request it is always present.
  const activityEvent = (transaction as Prisma.TransactionClient | undefined)?.activityEvent;
  if (!activityEvent || typeof activityEvent.create !== "function") return;
  await activityEvent.create({
    data: {
      orgId: input.orgId,
      entityType: "codes_source",
      entityId: input.sourceId,
      eventType: input.eventType,
      title: input.title,
      actorUserId: input.actorUserId,
      metadataJson: input.metadata as Prisma.InputJsonValue,
      occurredAt: new Date(),
    },
  });
}

export class PrismaCodesSourceStore implements CodesSourceStore {
  private readonly client: typeof basePrisma;

  constructor(client: typeof basePrisma = basePrisma) {
    this.client = client;
  }

  async findLatestByCitation(identity: SourceIdentity): Promise<(CodeSourceRow & { hasNewerVersion: boolean }) | null> {
    const rows = await prisma.$queryRaw<CodeSourceRawRow[]>(Prisma.sql`
      select ${CODE_SOURCE_COLUMNS},
        exists (select 1 from codes_source s2 where s2.supersedes_id = codes_source.id) as has_newer_version
      from codes_source
      where authority_id = ${identity.authorityId}::uuid
        and code_family = ${identity.codeFamily}
        and citation = ${identity.citation}
        and not exists (select 1 from codes_source s2 where s2.supersedes_id = codes_source.id)
      order by length(version_label) desc nulls last, version_label desc nulls last
      limit 1
    `);
    return rows.length === 1 ? toCodeSourceRow(rows[0]) : null;
  }

  async list(filter: { status?: CodeSourceStatus; limit?: number }): Promise<Array<CodeSourceRow & { hasNewerVersion: boolean }>> {
    const limit = Math.min(Math.max(filter.limit ?? 25, 1), 100);
    const rows = await prisma.$queryRaw<CodeSourceRawRow[]>(
      filter.status
        ? Prisma.sql`
            select ${CODE_SOURCE_COLUMNS},
              exists (select 1 from codes_source s2 where s2.supersedes_id = codes_source.id) as has_newer_version
            from codes_source
            where status = ${filter.status}
            order by source_url asc, length(version_label) desc nulls last, version_label desc nulls last
            limit ${limit}
          `
        : Prisma.sql`
            select ${CODE_SOURCE_COLUMNS},
              exists (select 1 from codes_source s2 where s2.supersedes_id = codes_source.id) as has_newer_version
            from codes_source
            order by source_url asc, length(version_label) desc nulls last, version_label desc nulls last
            limit ${limit}
          `,
    );
    return rows.map(toCodeSourceRow);
  }

  async getById(id: string): Promise<(CodeSourceRow & { hasNewerVersion: boolean }) | null> {
    const rows = await prisma.$queryRaw<CodeSourceRawRow[]>(Prisma.sql`
      select ${CODE_SOURCE_COLUMNS},
        exists (select 1 from codes_source s2 where s2.supersedes_id = codes_source.id) as has_newer_version
      from codes_source
      where id = ${id}::uuid
      limit 1
    `);
    return rows.length === 1 ? toCodeSourceRow(rows[0]) : null;
  }

  async insertVersionIfChanged(
    input: IngestVersionInput,
    actor: { userId: string; orgId: string },
  ): Promise<InsertVersionResult> {
    return runInDatabaseTransaction(this.client, async (transaction) => {
      await setIngestionFlag(transaction);
      // Serialize concurrent ingests of the same cited source so two
      // simultaneous fetches cannot both see the same head and fork the
      // version chain. The lock key is the citation identity, not the URL.
      await transaction.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${"codes-source-ingest:" + input.authorityId + ":" + input.codeFamily + ":" + input.citation}, 0))`,
      );

      const latest = await this.findLatestInTransaction(transaction, input);
      if (latest && latest.sourceHash === input.sourceHash) {
        // Idempotent no-op: same bytes, same hash — nothing is written, no
        // history entry, no audit event. Re-running ingestion is safe.
        return { row: latest, created: false };
      }

      const counted = await transaction.$queryRaw<Array<{ total: number }>>(Prisma.sql`
        select count(*)::int as total from codes_source
        where authority_id = ${input.authorityId}::uuid
          and code_family = ${input.codeFamily}
          and citation = ${input.citation}
      `);
      const versionLabel = `v${(counted[0]?.total ?? 0) + 1}`;

      const inserted = await transaction.$queryRaw<CodeSourceRawRow[]>(Prisma.sql`
        insert into codes_source (
          jurisdiction_id, authority_id, code_family, section, citation, title,
          source_url, source_hash, license_note,
          published_date, amended_date, effective_date, expiry_date,
          status, version_label, supersedes_id
        ) values (
          ${input.jurisdictionId}::uuid, ${input.authorityId}::uuid, ${input.codeFamily}, ${textParam(input.section)},
          ${input.citation}, ${input.title}, ${input.sourceUrl}, ${input.sourceHash}, ${textParam(input.licenseNote)},
          ${dateParam(input.publishedDate)}, ${dateParam(input.amendedDate)},
          ${dateParam(input.effectiveDate)}, ${dateParam(input.expiryDate)},
          'research', ${versionLabel}, ${uuidParam(latest?.id ?? null)}
        )
        returning ${CODE_SOURCE_COLUMNS}
      `);
      if (inserted.length !== 1) {
        throw new ApiError(500, "Codes source version insert did not return a row");
      }
      const row = toCodeSourceRow({ ...inserted[0], has_newer_version: false });
      await insertHistoryEntry(
        transaction,
        row,
        `Governed ingest created ${versionLabel}${latest ? `; supersedes ${latest.versionLabel ?? "unversioned"}` : ""}`,
        actor.userId,
      );

      if (latest) {
        // Supersede, never mutate: the old head keeps its content and
        // becomes 'superseded'; the new row carries the linkage.
        const superseded = await transaction.$queryRaw<CodeSourceRawRow[]>(Prisma.sql`
          update codes_source set status = 'superseded'
          where id = ${latest.id}::uuid and status <> 'superseded'
          returning ${CODE_SOURCE_COLUMNS}
        `);
        if (superseded.length === 1) {
          await insertHistoryEntry(
            transaction,
            toCodeSourceRow({ ...superseded[0], has_newer_version: true }),
            `Superseded by ${versionLabel}`,
            actor.userId,
          );
        }
      }

      await recordAuditEvent(transaction, {
        orgId: actor.orgId,
        sourceId: row.id,
        eventType: "costbook.codes_source.ingested",
        title: `Codes source ingested: ${row.citation} (${row.versionLabel})`,
        actorUserId: actor.userId,
        metadata: {
          sourceUrl: row.sourceUrl,
          sourceHash: row.sourceHash,
          versionLabel: row.versionLabel,
          supersedesId: row.supersedesId,
          previousSourceHash: latest?.sourceHash ?? null,
          status: "research",
        },
      });

      return { row, created: true };
    });
  }

  async transition(input: ReviewTransitionInput): Promise<CodeSourceRow> {
    return runInDatabaseTransaction(this.client, async (transaction) => {
      await setIngestionFlag(transaction);

      const existing = await transaction.$queryRaw<CodeSourceRawRow[]>(Prisma.sql`
        select ${CODE_SOURCE_COLUMNS}, false as has_newer_version
        from codes_source
        where id = ${input.id}::uuid
        limit 1
      `);
      if (existing.length !== 1) {
        throw new ApiError(404, `Codes source ${input.id} not found`);
      }
      const current = toCodeSourceRow(existing[0]);
      if (current.status !== "research") {
        throw new ApiError(409, `Codes source ${input.id} has already been reviewed (${current.status})`);
      }

      // Claim the review before mutating anything else: the status
      // predicate makes approve/reject mutually exclusive under
      // concurrent review (candidate-review pattern).
      // `reviewed_by` is TEXT in TODO 2 (#960): the reviewer id is written
      // as plain text, never cast to uuid.
      const updated = await transaction.$queryRaw<CodeSourceRawRow[]>(Prisma.sql`
        update codes_source
        set status = ${input.toStatus}, reviewed_at = now(), reviewed_by = ${input.actorUserId}
        where id = ${input.id}::uuid and status = 'research'
        returning ${CODE_SOURCE_COLUMNS}
      `);
      if (updated.length !== 1) {
        throw new ApiError(409, `Codes source ${input.id} is no longer open for review`);
      }
      const row = toCodeSourceRow({ ...updated[0], has_newer_version: false });
      await insertHistoryEntry(
        transaction,
        row,
        input.decision === "approved"
          ? `Approved by ${input.actorUserId}`
          : `Rejected by ${input.actorUserId}: ${input.reason ?? ""}`,
        input.actorUserId,
      );
      await recordAuditEvent(transaction, {
        orgId: input.orgId,
        sourceId: row.id,
        eventType: `costbook.codes_source.${input.decision}`,
        title: `Codes source ${input.decision}: ${row.citation} (${row.versionLabel})`,
        actorUserId: input.actorUserId,
        metadata: {
          decision: input.decision,
          reason: input.reason ?? null,
          reviewNotes: input.reviewNotes ?? null,
          previousStatus: "research",
          sourceUrl: row.sourceUrl,
          sourceHash: row.sourceHash,
          versionLabel: row.versionLabel,
        },
      });
      return row;
    });
  }

  private async findLatestInTransaction(
    transaction: Prisma.TransactionClient,
    identity: SourceIdentity,
  ): Promise<CodeSourceRow | null> {
    const rows = await transaction.$queryRaw<CodeSourceRawRow[]>(Prisma.sql`
      select ${CODE_SOURCE_COLUMNS}, false as has_newer_version
      from codes_source
      where authority_id = ${identity.authorityId}::uuid
        and code_family = ${identity.codeFamily}
        and citation = ${identity.citation}
        and not exists (select 1 from codes_source s2 where s2.supersedes_id = codes_source.id)
      order by length(version_label) desc nulls last, version_label desc nulls last
      limit 1
    `);
    return rows.length === 1 ? toCodeSourceRow(rows[0]) : null;
  }
}

/** Production store singleton, mirroring the candidate-service module shape. */
export const codesSourceStore = new PrismaCodesSourceStore();
