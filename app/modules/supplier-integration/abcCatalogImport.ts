import { randomUUID, createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  AbcCatalogClient,
  AbcCatalogRawItem,
} from "./abcCatalog";

/**
 * ABC shared-catalog full import, Phase 2 (issue #735).
 *
 * Reuses `AbcCatalogClient.listRaw` (the only read path that returns
 * `Inactive` items — `list()` filters them out, and the importer must store
 * them with `is_displayable = false` so a later reactivation is a hash
 * update, not a re-insert). Pages the full catalog at itemsPerPage=1000 in
 * page order with the client's retry/backoff and 125 ms spacing.
 *
 * Invariants (scope §4):
 * - Checkpoint-after-commit: each page is upserted in one transaction and
 *   the run row's `checkpoint_page` + counts are persisted only after that
 *   transaction commits. Re-running continues from `checkpoint_page + 1`.
 * - Content-hash upsert keyed on `item_number`: SHA-256 over the
 *   canonicalized stored fields. Hash-identical rows are touched
 *   (`last_seen_at`) only, so a second identical run is 0 adds / 0 updates.
 * - Per-item failures are captured in the run report and never abort the
 *   sync; a database transaction failure aborts the run, not the item.
 * - Bounded page validation: page/items-per-page echo and duplicate item
 *   numbers are enforced by the client; `totalItems`/`totalPages` drift
 *   mid-run aborts as `partial` with the checkpoint preserved.
 * - Never erase on an empty provider response: a 0-item first page fails
 *   the run closed and retains all stored data.
 * - No prices are ever stored: the mapper is an explicit field allowlist
 *   and the canonical hash input is scanned for price-like keys.
 * - No `SupplierProduct` / `Material` rows are created: this module has no
 *   access to those models — adoption stays a tenant action (scope §5).
 *
 * Writes run under the transaction-local `app.abc_catalog_ingestion` flag
 * (the Phase 1 RLS model): the flag is set inside every write transaction,
 * exactly like `app.codes_ingestion` in `modules/costbook/codes/store.ts`.
 * The service never sets org/user session state and never touches tenant
 * tables. All ABC hosts are the sandbox constants in `abcCatalog.ts`.
 */

export const ABC_CATALOG_IMPORT_ITEMS_PER_PAGE = 1000;
export const ABC_CATALOG_IMPORT_HIERARCHY_PER_PAGE = 50;
/** Minimum free database space required before an import may start. */
export const ABC_CATALOG_IMPORT_MIN_FREE_BYTES = 2 * 1024 * 1024 * 1024;

const HIERARCHY_KEYS = [
  "productGroup",
  "category",
  "productType",
  "materialComposition",
  "warranty",
  "brandLine",
] as const;

export type AbcCatalogImportStatus = "succeeded" | "failed" | "partial";

export interface AbcCatalogImportReport {
  runId: string | null;
  kind: "full";
  status: AbcCatalogImportStatus;
  dryRun: boolean;
  correlationId: string;
  providerTotalItems: number | null;
  providerTotalPages: number | null;
  pagesProcessed: number;
  itemsSeen: number;
  itemsAdded: number;
  itemsUpdated: number;
  itemsDeactivated: number;
  itemsFailed: number;
  hierarchyPathsSeen: number;
  hierarchyAdded: number;
  hierarchyUpdated: number;
  hierarchySkipped: number;
  checkpointPage: number;
  databaseUsedBytes: number | null;
  databaseFreeBytes: number | null;
  error: string | null;
}

export interface AbcCatalogImportOptions {
  dryRun?: boolean;
  /** Bound the run to this many item pages (operator proof slice). 0/unset = all pages. */
  maxPages?: number;
  /** Resume a previous run instead of starting a new one. */
  resumeRunId?: string;
  correlationId?: string;
  /**
   * Total database capacity in bytes, recorded by the operator from the
   * Supabase dashboard (Settings → Database → disk usage vs plan) or, for
   * a disposable database, the host's known capacity. Required: without it
   * the pre-flight gate fails closed — the importer never guesses headroom.
   * Falls back to `ABC_CATALOG_DB_CAPACITY_BYTES`.
   */
  dbCapacityBytes?: number;
  now?: () => Date;
  log?: (line: string) => void;
}

export type AbcCatalogImportCatalog = Pick<
  AbcCatalogClient,
  "listRaw" | "listHierarchyRaw"
>;

export class AbcCatalogImportError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "AbcCatalogImportError";
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

/** Deterministic JSON: object keys sorted recursively, so the hash is stable. */
export function canonicalizeForHash(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(canonicalizeForHash).join(",") + "]";
  const record = value as Record<string, unknown>;
  return "{" + Object.keys(record).sort().map((key) =>
    JSON.stringify(key) + ":" + canonicalizeForHash(record[key]),
  ).join(",") + "}";
}

/**
 * True when any key at any depth of the value is price-like. No depth cap:
 * the payload comes from JSON.parse (acyclic by construction) and the
 * stored value is traversed without a limit by `canonicalizeForHash`, so a
 * capped scan would let a deeply nested price key through while the hash
 * still covers it.
 */
function containsPriceKey(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((entry) => containsPriceKey(entry));
  const record = value as Record<string, unknown>;
  return Object.keys(record).some(
    (key) => /price/i.test(key) || containsPriceKey(record[key]),
  );
}

export interface MappedCatalogItem {
  itemNumber: string;
  description: string | null;
  marketingDescription: string | null;
  manufacturer: string | null;
  familyId: string | null;
  familyName: string | null;
  status: string;
  isDimensional: boolean;
  uoms: unknown[];
  dimensions: unknown | null;
  color: unknown | null;
  finish: unknown | null;
  weights: unknown[];
  variations: unknown[];
  prop65Warnings: unknown[];
  /** Six-level path as stored; null when the item carries no hierarchy object. */
  hierarchyPath: Array<{ level: string; code: string; label: string; name: string | null }> | null;
  isDisplayable: boolean;
  contentHash: string;
}

export interface MappedHierarchyPath {
  pathKey: string;
  levels: Array<{ level: string; code: string; label: string; name: string | null }>;
}

/**
 * Map one raw provider item onto exactly the stored fields (allowlist).
 * Throws `catalog_import_price_key_found` if any stored value carries a
 * price-like key, and `catalog_import_invalid_item` when the item number
 * is missing. Hierarchy levels that are present but missing code/label
 * are preserved with empty strings (Phase 1 decision); a level node that
 * is absent ends the path (a partial path, not a failure).
 */
export function mapCatalogItem(raw: AbcCatalogRawItem): MappedCatalogItem {
  const record = raw as unknown as Record<string, unknown>;
  const itemNumber = typeof raw.itemNumber === "string" ? raw.itemNumber : "";
  if (!itemNumber.trim()) throw new AbcCatalogImportError("catalog_import_invalid_item");
  const status = nonEmptyString(raw.status) ?? "Active";
  const dimensions = isRecord(record.dimensions) ? record.dimensions : null;
  const rawVariations = asArray(record.variations);
  const dimensionVariations = dimensions ? asArray(dimensions.variations) : [];
  const hierarchyPath = mapHierarchyLevels(record.hierarchy);
  const stored = {
    itemNumber,
    description: nonEmptyString(raw.itemDescription),
    marketingDescription: nonEmptyString(record.marketingDescription),
    manufacturer: nonEmptyString(raw.supplierName),
    familyId: nonEmptyString(raw.familyId),
    familyName: nonEmptyString(raw.familyName),
    status,
    isDimensional: raw.isDimensional === true,
    uoms: asArray(record.uoms),
    dimensions,
    color: isRecord(record.color) ? record.color : null,
    finish: isRecord(record.finish) ? record.finish : null,
    weights: asArray(record.weights),
    variations: rawVariations.length > 0 ? rawVariations : dimensionVariations,
    prop65Warnings: asArray(record.prop65Warnings),
    hierarchyPath,
  };
  if (containsPriceKey(stored)) {
    throw new AbcCatalogImportError("catalog_import_price_key_found");
  }
  return {
    ...stored,
    isDisplayable: status.toLowerCase() === "active",
    contentHash: createHash("sha256").update(canonicalizeForHash(stored)).digest("hex"),
  };
}

/**
 * Map a provider hierarchy object onto the stored six-level path. Returns
 * null when there is no hierarchy object (or no `productGroup` at all):
 * the caller treats that as "no path", never as a failure. A level node
 * that is present but malformed keeps its level with empty code/label so
 * the path is stored as returned.
 */
export function mapHierarchyLevels(hierarchy: unknown): MappedCatalogItem["hierarchyPath"] {
  if (!isRecord(hierarchy)) return null;
  let current: unknown = hierarchy;
  const levels: Array<{ level: string; code: string; label: string; name: string | null }> = [];
  for (const level of HIERARCHY_KEYS) {
    if (!isRecord(current)) break;
    const node = current[level];
    if (node === undefined) break;
    if (!isRecord(node)) {
      levels.push({ level, code: "", label: "", name: null });
      break;
    }
    levels.push({
      level,
      code: typeof node.code === "string" ? node.code : "",
      label: typeof node.label === "string" ? node.label : "",
      name: nonEmptyString(node.name),
    });
    current = node;
  }
  return levels.length > 0 ? levels : null;
}

export function hierarchyPathKey(
  levels: Array<{ code: string }>,
): string {
  const codes = HIERARCHY_KEYS.map((_, index) => levels[index]?.code ?? "");
  return codes.join("/");
}

function toHierarchyRow(path: MappedHierarchyPath): {
  pathKey: string;
  level1Code: string | null;
  level1Label: string | null;
  level1Name: string | null;
  level2Code: string | null;
  level2Label: string | null;
  level2Name: string | null;
  level3Code: string | null;
  level3Label: string | null;
  level3Name: string | null;
  level4Code: string | null;
  level4Label: string | null;
  level4Name: string | null;
  level5Code: string | null;
  level5Label: string | null;
  level5Name: string | null;
  level6Code: string | null;
  level6Label: string | null;
  level6Name: string | null;
  levels: Prisma.InputJsonValue;
} {
  const at = (index: number) => path.levels[index] ?? null;
  const code = (index: number) => (at(index)?.code ?? "") || null;
  const label = (index: number) => (at(index)?.label ?? "") || null;
  return {
    pathKey: path.pathKey,
    level1Code: code(0), level1Label: label(0), level1Name: at(0)?.name ?? null,
    level2Code: code(1), level2Label: label(1), level2Name: at(1)?.name ?? null,
    level3Code: code(2), level3Label: label(2), level3Name: at(2)?.name ?? null,
    level4Code: code(3), level4Label: label(3), level4Name: at(3)?.name ?? null,
    level5Code: code(4), level5Label: label(4), level5Name: at(4)?.name ?? null,
    level6Code: code(5), level6Label: label(5), level6Name: at(5)?.name ?? null,
    levels: path.levels as unknown as Prisma.InputJsonValue,
  };
}

/**
 * Expected item count for a page, from the provider's own totals under the
 * 1000-item page contract. Returns null when the totals do not fit that
 * contract at all (e.g. a 3-item catalog reported as 2 pages): with no
 * baseline the count check is skipped and the existing drift/empty checks
 * still apply. A truncated page against consistent totals is a partial,
 * never a silent skip — the checkpoint must not advance past missing items.
 */
export function expectedPageItemCount(
  pageNumber: number,
  totalItems: number,
  totalPages: number,
): number | null {
  const perPage = ABC_CATALOG_IMPORT_ITEMS_PER_PAGE;
  if (pageNumber < 1 || pageNumber > totalPages) return null;
  const remaining = totalItems - (pageNumber - 1) * perPage;
  if (remaining < 1) return null;
  const expected = Math.min(perPage, remaining);
  // A non-final page must be full; if the totals say otherwise the
  // baseline is inconsistent with the page contract and the check is skipped.
  if (pageNumber < totalPages && expected !== perPage) return null;
  return expected;
}

type ImportTx = Prisma.TransactionClient;

async function setIngestionFlag(tx: ImportTx): Promise<void> {
  await tx.$queryRaw(Prisma.sql`select set_config('app.abc_catalog_ingestion', 'true', true)`);
}

/**
 * Serialize run-ownership claims (key 735001 = issue #735): two concurrent
 * CLI invocations must not both pass the already-running guard. The lock is
 * transaction-scoped, so the guard + create (or load + mark-running) in the
 * same transaction is atomic — the second claim sees the first run's row.
 * It does not hold across the page loop: two operators resuming the same
 * run id concurrently is an operator error, and the workflow's concurrency
 * group is the guard for workflow runs.
 */
async function takeImportOwnershipLock(tx: ImportTx): Promise<void> {
  // $executeRaw, not $queryRaw: pg_advisory_xact_lock returns void and
  // Prisma cannot deserialize a void column (P2010).
  await tx.$executeRaw(Prisma.sql`select pg_advisory_xact_lock(735001)`);
}

async function readDatabaseUsedBytes(db: PrismaClient): Promise<number> {
  const rows = await db.$queryRaw<Array<{ size: bigint | number | string }>>(
    Prisma.sql`select pg_database_size(current_database()) as size`,
  );
  const size = rows[0]?.size;
  if (typeof size === "bigint") return Number(size);
  if (typeof size === "number") return size;
  const parsed = Number(size);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new AbcCatalogImportError("catalog_import_headroom_unreadable");
  }
  return parsed;
}

function headroomErrorMessage(freeBytes: number, usedBytes: number, capacityBytes: number): string {
  return "catalog_import_insufficient_headroom: " +
    `database uses ${(usedBytes / 1024 / 1024).toFixed(1)} MB of ` +
    `${(capacityBytes / 1024 / 1024 / 1024).toFixed(2)} GB capacity, ` +
    `${(freeBytes / 1024 / 1024).toFixed(1)} MB free, ` +
    `minimum ${(ABC_CATALOG_IMPORT_MIN_FREE_BYTES / 1024 / 1024 / 1024).toFixed(0)} GB free required`;
}

interface RunState {
  id: string;
  status: string;
  checkpointPage: number;
  providerTotalItems: number | null;
  providerTotalPages: number | null;
}

export async function runFullCatalogImport(
  db: PrismaClient,
  catalog: AbcCatalogImportCatalog,
  options: AbcCatalogImportOptions = {},
): Promise<AbcCatalogImportReport> {
  const dryRun = options.dryRun === true;
  const maxPages = options.maxPages ?? 0;
  const now = options.now ?? (() => new Date());
  const log = options.log ?? (() => undefined);
  const correlationId = options.correlationId ?? randomUUID();
  if (!Number.isInteger(maxPages) || maxPages < 0) {
    throw new AbcCatalogImportError("catalog_import_invalid_bounds");
  }

  const report: AbcCatalogImportReport = {
    runId: null,
    kind: "full",
    status: "succeeded",
    dryRun,
    correlationId,
    providerTotalItems: null,
    providerTotalPages: null,
    pagesProcessed: 0,
    itemsSeen: 0,
    itemsAdded: 0,
    itemsUpdated: 0,
    itemsDeactivated: 0,
    itemsFailed: 0,
    hierarchyPathsSeen: 0,
    hierarchyAdded: 0,
    hierarchyUpdated: 0,
    hierarchySkipped: 0,
    checkpointPage: 0,
    databaseUsedBytes: null,
    databaseFreeBytes: null,
    error: null,
  };
  const failedItemNumbers: string[] = [];
  const recordFailedItem = (itemNumber: string): void => {
    report.itemsFailed += 1;
    if (failedItemNumbers.length < 50) failedItemNumbers.push(itemNumber);
  };

  // Dry-run is counts only: no run row, no writes of any kind. The counts
  // are computed against live reads and returned, never persisted.
  if (dryRun) {
    return runDryCount(db, catalog, report, {
      maxPages,
      now,
      log,
      recordFailedItem,
      dbCapacityBytes: options.dbCapacityBytes,
    });
  }

  let run: RunState | null = null;
  const finishRun = async (
    status: AbcCatalogImportStatus,
    error: string | null,
    // The run row keeps the full audit detail; the stdout report carries
    // counts only (see the failure note below) — never item numbers.
    reportError: string | null = error,
  ): Promise<void> => {
    if (!run) return;
    report.status = status;
    report.error = reportError;
    await db.$transaction(async (tx) => {
      await setIngestionFlag(tx);
      await tx.abcCatalogSyncRun.update({
        where: { id: run!.id },
        data: {
          status,
          finishedAt: now(),
          providerTotalItems: report.providerTotalItems,
          providerTotalPages: report.providerTotalPages,
          pagesProcessed: report.pagesProcessed,
          itemsSeen: report.itemsSeen,
          itemsAdded: report.itemsAdded,
          itemsUpdated: report.itemsUpdated,
          itemsDeactivated: report.itemsDeactivated,
          itemsFailed: report.itemsFailed,
          checkpointPage: report.checkpointPage,
          error,
        },
      });
      if (status === "succeeded") {
        await tx.abcCatalogSyncState.upsert({
          where: { id: "abc-catalog" },
          create: {
            id: "abc-catalog",
            lastFullSyncAt: now(),
            lastSeenTotalItems: report.providerTotalItems,
            lastSeenTotalPages: report.providerTotalPages,
            lastSuccessfulRunId: run!.id,
          },
          update: {
            lastFullSyncAt: now(),
            lastSeenTotalItems: report.providerTotalItems,
            lastSeenTotalPages: report.providerTotalPages,
            lastSuccessfulRunId: run!.id,
          },
        });
      }
    });
  };

  try {
    // Resume: continue an interrupted run from its checkpoint. A second
    // trigger while a run is live is refused — one catalog sync at a time.
    // The load + mark-running happen in one locked transaction so two
    // concurrent resumes cannot both claim the run.
    if (options.resumeRunId) {
      const existing = await db.$transaction(async (tx) => {
        await setIngestionFlag(tx);
        await takeImportOwnershipLock(tx);
        const row = await tx.abcCatalogSyncRun.findUnique({ where: { id: options.resumeRunId } });
        if (!row) throw new AbcCatalogImportError("catalog_import_unknown_run");
        if (row.kind !== "full") throw new AbcCatalogImportError("catalog_import_wrong_run_kind");
        if (row.status === "succeeded") throw new AbcCatalogImportError("catalog_import_run_already_succeeded");
        if (!["running", "partial", "failed"].includes(row.status)) {
          throw new AbcCatalogImportError("catalog_import_run_not_resumable");
        }
        await tx.abcCatalogSyncRun.update({
          where: { id: row.id },
          data: { status: "running", finishedAt: null, error: null },
        });
        return row;
      });
      const committedPages = existing.checkpointPage ?? 0;
      // A run with no committed page has no trustworthy baseline: a failed
      // first page may have persisted empty totals (0 items / 0 pages),
      // which would skip every item page and succeed vacuously. Restart it
      // under the same run id with fresh totals and zeroed counts; only a
      // run with committed pages keeps its baseline and cumulative counts.
      const keepBaseline = committedPages > 0;
      run = {
        id: existing.id,
        status: "running",
        checkpointPage: committedPages,
        providerTotalItems: keepBaseline ? existing.providerTotalItems : null,
        providerTotalPages: keepBaseline ? existing.providerTotalPages : null,
      };
      report.runId = run.id;
      // The run row is the audit trail for the whole run, so a resume
      // carries the previous attempt's cumulative counts forward; only the
      // remaining pages add to them.
      report.checkpointPage = run.checkpointPage;
      report.providerTotalItems = run.providerTotalItems;
      report.providerTotalPages = run.providerTotalPages;
      report.pagesProcessed = keepBaseline ? existing.pagesProcessed : 0;
      report.itemsSeen = keepBaseline ? existing.itemsSeen : 0;
      report.itemsAdded = keepBaseline ? existing.itemsAdded : 0;
      report.itemsUpdated = keepBaseline ? existing.itemsUpdated : 0;
      report.itemsDeactivated = keepBaseline ? existing.itemsDeactivated : 0;
      report.itemsFailed = keepBaseline ? existing.itemsFailed : 0;
    } else {
      // Guard + create in one locked transaction: without the lock, two
      // concurrent invocations can both read "no running run" and both
      // start, importing the same items twice under two run ids.
      const created = await db.$transaction(async (tx) => {
        await setIngestionFlag(tx);
        await takeImportOwnershipLock(tx);
        const live = await tx.abcCatalogSyncRun.findFirst({
          where: { kind: "full", status: "running" },
          orderBy: { startedAt: "desc" },
        });
        if (live) {
          throw new AbcCatalogImportError(
            "catalog_import_already_running",
            `catalog_import_already_running: run ${live.id} is still running; resume it instead of starting a new import`,
          );
        }
        return tx.abcCatalogSyncRun.create({
          data: {
            kind: "full",
            status: "running",
            checkpointPage: 0,
            correlationId,
          },
        });
      });
      run = {
        id: created.id,
        status: "running",
        checkpointPage: 0,
        providerTotalItems: null,
        providerTotalPages: null,
      };
      report.runId = run.id;
    }

    // Pre-flight headroom gate (Phase 1 open check): the operator records
    // total capacity from the Supabase dashboard; the importer measures
    // live usage and refuses to start below ~2 GB free. No guesswork.
    const capacityRaw = options.dbCapacityBytes ??
      (process.env.ABC_CATALOG_DB_CAPACITY_BYTES ? Number(process.env.ABC_CATALOG_DB_CAPACITY_BYTES) : null);
    const usedBytes = await readDatabaseUsedBytes(db);
    report.databaseUsedBytes = usedBytes;
    if (capacityRaw === null || capacityRaw === undefined || !Number.isFinite(capacityRaw) || capacityRaw <= 0) {
      throw new AbcCatalogImportError(
        "catalog_import_headroom_unconfigured",
        "catalog_import_headroom_unconfigured: set ABC_CATALOG_DB_CAPACITY_BYTES to the database plan's included storage " +
          "(Supabase dashboard → Settings → Database → disk usage vs plan) before importing",
      );
    }
    const freeBytes = capacityRaw - usedBytes;
    report.databaseFreeBytes = freeBytes;
    if (freeBytes < ABC_CATALOG_IMPORT_MIN_FREE_BYTES) {
      throw new AbcCatalogImportError(
        "catalog_import_insufficient_headroom",
        headroomErrorMessage(freeBytes, usedBytes, capacityRaw),
      );
    }
    log(`[abc-catalog-import] run ${run.id} headroom ok: ${(usedBytes / 1048576).toFixed(1)} MB used, ${(freeBytes / 1048576).toFixed(1)} MB free`);

    // Hierarchy seed (idempotent upsert; re-run in full on resume).
    await seedHierarchy(db, catalog, report, { now, log });

    // Item pages from the checkpoint.
    const startPage = report.checkpointPage + 1;
    let pageNumber = startPage;
    for (;;) {
      if (report.providerTotalPages !== null && pageNumber > report.providerTotalPages) break;
      if (maxPages > 0 && report.pagesProcessed >= maxPages) {
        await finishRun(
          "partial",
          `catalog_import_bounded_stop: stopped after ${report.pagesProcessed} page(s) at checkpoint ${report.checkpointPage}; resume with --resume ${run.id}`,
        );
        return report;
      }
      const page = await catalog.listRaw({
        pageNumber,
        itemsPerPage: ABC_CATALOG_IMPORT_ITEMS_PER_PAGE,
      });
      const pagination = page.pagination;
      if (report.providerTotalItems === null) {
        report.providerTotalItems = pagination.totalItems;
        report.providerTotalPages = pagination.totalPages;
        if (pagination.totalItems < 1 || pagination.totalPages < 1 || page.items.length < 1) {
          const stored = await db.$transaction(async (tx) => {
            await setIngestionFlag(tx);
            return tx.abcCatalogItem.count();
          });
          throw new AbcCatalogImportError(
            "catalog_import_empty_provider_response",
            `catalog_import_empty_provider_response: provider returned 0 items on page 1 with ${stored} stored item(s); failing closed, stored data retained`,
          );
        }
      } else if (pagination.totalItems !== report.providerTotalItems ||
        pagination.totalPages !== report.providerTotalPages) {
        await finishRun(
          "partial",
          `catalog_import_pagination_drift: provider totals changed ${report.providerTotalItems}/${report.providerTotalPages} -> ${pagination.totalItems}/${pagination.totalPages} on page ${pageNumber}; checkpoint ${report.checkpointPage} preserved`,
        );
        return report;
      }
      if (page.items.length < 1) {
        await finishRun(
          "partial",
          `catalog_import_pagination_drift: provider returned an empty page ${pageNumber} of ${report.providerTotalPages}; checkpoint ${report.checkpointPage} preserved`,
        );
        return report;
      }
      // A truncated page against consistent totals is a partial, never a
      // silent skip: the checkpoint must not advance past missing items.
      // (When the totals do not fit the 1000-item page contract at all,
      // there is no baseline and the check is skipped.)
      const expectedCount = expectedPageItemCount(
        pageNumber,
        report.providerTotalItems ?? pagination.totalItems,
        report.providerTotalPages ?? pagination.totalPages,
      );
      if (expectedCount !== null && page.items.length !== expectedCount) {
        await finishRun(
          "partial",
          `catalog_import_short_page: provider returned ${page.items.length} items on page ${pageNumber}, expected ${expectedCount} (totals ${report.providerTotalItems}/${report.providerTotalPages}); checkpoint ${report.checkpointPage} preserved`,
        );
        return report;
      }

      const mapped: MappedCatalogItem[] = [];
      for (const rawItem of page.items) {
        try {
          mapped.push(mapCatalogItem(rawItem));
        } catch (error) {
          const itemNumber = typeof rawItem.itemNumber === "string" ? rawItem.itemNumber : "(unknown)";
          recordFailedItem(itemNumber);
          log(`[abc-catalog-import] run ${run.id} page ${pageNumber}: item ${itemNumber} failed: ${error instanceof Error ? error.message : "unknown"}`);
        }
      }

      // One transaction per page: flag, upserts, hierarchy upserts. A
      // failure here aborts the run, not the item — the page is not
      // half-written and the checkpoint does not advance past it. Prisma 6
      // defaults interactive transactions to a 5 s timeout; a 1000-item
      // page (1000 sequential upserts + distinct-path hierarchy upserts)
      // exceeds that against a remote database, so the page gets an
      // explicit 120 s budget. Hierarchy paths are batched per page (one
      // read for all distinct paths, one write per path) instead of a
      // read + write per item.
      const pageCounts = await db.$transaction(async (tx) => {
        await setIngestionFlag(tx);
        const existing = await tx.abcCatalogItem.findMany({
          where: { itemNumber: { in: mapped.map((item) => item.itemNumber) } },
          select: { itemNumber: true, contentHash: true, isDisplayable: true },
        });
        const byNumber = new Map(existing.map((row) => [row.itemNumber, row]));
        let added = 0;
        let updated = 0;
        let deactivated = 0;
        for (const item of mapped) {
          const previous = byNumber.get(item.itemNumber);
          if (previous && previous.contentHash === item.contentHash) {
            await tx.abcCatalogItem.update({
              where: { itemNumber: item.itemNumber },
              data: { lastSeenAt: now() },
            });
            continue;
          }
          await tx.abcCatalogItem.upsert({
            where: { itemNumber: item.itemNumber },
            create: itemRow(item, now()),
            update: itemUpdate(item, now()),
          });
          if (!previous) {
            added += 1;
            if (!item.isDisplayable) deactivated += 1;
          } else {
            updated += 1;
            if (previous.isDisplayable && !item.isDisplayable) deactivated += 1;
          }
        }
        // Item-payload hierarchies land in the same page transaction.
        const hierarchyCounts = await upsertHierarchyPaths(
          tx,
          mapped
            .filter((item) => item.hierarchyPath)
            .map((item) => ({
              pathKey: hierarchyPathKey(item.hierarchyPath!),
              levels: item.hierarchyPath!,
            })),
          now(),
        );
        report.hierarchyAdded += hierarchyCounts.added;
        report.hierarchyUpdated += hierarchyCounts.updated;
        report.hierarchySkipped += hierarchyCounts.skipped;
        return { added, updated, deactivated };
      }, { timeout: 120_000, maxWait: 10_000 });

      report.pagesProcessed += 1;
      report.itemsSeen += page.items.length;
      report.itemsAdded += pageCounts.added;
      report.itemsUpdated += pageCounts.updated;
      report.itemsDeactivated += pageCounts.deactivated;

      // Checkpoint-after-commit: only now, with the page committed, does
      // the run row advance. If this update fails the page stays committed
      // and the resume re-processes it idempotently (hash compare).
      report.checkpointPage = pageNumber;
      await db.$transaction(async (tx) => {
        await setIngestionFlag(tx);
        await tx.abcCatalogSyncRun.update({
          where: { id: run!.id },
          data: {
            providerTotalItems: report.providerTotalItems,
            providerTotalPages: report.providerTotalPages,
            pagesProcessed: report.pagesProcessed,
            itemsSeen: report.itemsSeen,
            itemsAdded: report.itemsAdded,
            itemsUpdated: report.itemsUpdated,
            itemsDeactivated: report.itemsDeactivated,
            itemsFailed: report.itemsFailed,
            checkpointPage: report.checkpointPage,
          },
        });
      });
      log(`[abc-catalog-import] run ${run.id} page ${pageNumber}/${report.providerTotalPages} committed: seen ${report.itemsSeen}, +${report.itemsAdded}/~${report.itemsUpdated}`);
      pageNumber += 1;
    }

    // The run row keeps the failing item numbers for the operator audit
    // trail; the stdout report carries counts only — never item numbers.
    const failureNote = failedItemNumbers.length > 0
      ? `failed_items: ${report.itemsFailed}; first item numbers: ${failedItemNumbers.join(",")}`
      : null;
    const failureNoteForReport = report.itemsFailed > 0
      ? `failed_items: ${report.itemsFailed}`
      : null;
    const hierarchyNote = report.hierarchySkipped > 0
      ? `hierarchy_skipped: ${report.hierarchySkipped}`
      : null;
    await finishRun(
      "succeeded",
      [failureNote, hierarchyNote].filter(Boolean).join("; ") || null,
      [failureNoteForReport, hierarchyNote].filter(Boolean).join("; ") || null,
    );
    return report;
  } catch (error) {
    const code = error instanceof AbcCatalogImportError ? error.code : "catalog_import_failed";
    const message = error instanceof Error ? error.message : code;
    // A drift/partial finish already persisted its own status; anything
    // else fails the run with the checkpoint preserved.
    if (run && report.status === "succeeded") {
      try {
        await finishRun("failed", message.startsWith(code) ? message : `${code}: ${sanitizeErrorMessage(message)}`);
      } catch {
        // The run row itself could not be updated; the thrown error still
        // carries the code and the checkpoint on disk is untouched.
      }
      report.status = "failed";
      report.error = message.startsWith(code) ? message : `${code}: ${sanitizeErrorMessage(message)}`;
    }
    if (error instanceof AbcCatalogImportError) throw error;
    throw new AbcCatalogImportError(code, report.error ?? code);
  }
}

function sanitizeErrorMessage(message: string): string {
  // Run-report errors carry codes and counts only — never provider payload
  // content, tokens, or connection strings.
  return message
    .replace(/:\/\/[^@\s]+@/g, "://***@")
    .replace(/Bearer\s+\S+/gi, "Bearer ***")
    .slice(0, 500);
}

function itemRow(item: MappedCatalogItem, at: Date) {
  return {
    itemNumber: item.itemNumber,
    description: item.description,
    marketingDescription: item.marketingDescription,
    manufacturer: item.manufacturer,
    familyId: item.familyId,
    familyName: item.familyName,
    status: item.status,
    isDimensional: item.isDimensional,
    uoms: item.uoms as unknown as Prisma.InputJsonValue,
    dimensions: (item.dimensions ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
    color: (item.color ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
    finish: (item.finish ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
    weights: item.weights as unknown as Prisma.InputJsonValue,
    variations: item.variations as unknown as Prisma.InputJsonValue,
    prop65Warnings: item.prop65Warnings as unknown as Prisma.InputJsonValue,
    hierarchyPath: (item.hierarchyPath ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
    contentHash: item.contentHash,
    firstSeenAt: at,
    lastSeenAt: at,
    lastSyncedAt: at,
    isDisplayable: item.isDisplayable,
  };
}

function itemUpdate(item: MappedCatalogItem, at: Date) {
  const row = itemRow(item, at);
  const { itemNumber: _itemNumber, firstSeenAt: _firstSeenAt, ...rest } = row;
  return { ...rest, lastSeenAt: at, lastSyncedAt: at };
}

/**
 * Upsert a batch of hierarchy paths: one read for all distinct paths, one
 * write per path. A single failing path counts as skipped without aborting
 * the batch — the page transaction's own failure still aborts the run.
 */
async function upsertHierarchyPaths(
  tx: ImportTx,
  paths: MappedHierarchyPath[],
  at: Date,
): Promise<{ added: number; updated: number; skipped: number }> {
  const distinct = new Map(paths.map((path) => [path.pathKey, path]));
  if (distinct.size === 0) return { added: 0, updated: 0, skipped: 0 };
  const existing = await tx.abcCatalogHierarchy.findMany({
    where: { pathKey: { in: [...distinct.keys()] } },
    select: { pathKey: true, levels: true },
  });
  const byKey = new Map(existing.map((row) => [row.pathKey, row]));
  let added = 0;
  let updated = 0;
  let skipped = 0;
  for (const path of distinct.values()) {
    try {
      const previous = byKey.get(path.pathKey);
      const row = toHierarchyRow(path);
      if (previous && canonicalizeForHash(previous.levels) === canonicalizeForHash(path.levels)) {
        await tx.abcCatalogHierarchy.update({
          where: { pathKey: path.pathKey },
          data: { lastSeenAt: at },
        });
        continue;
      }
      await tx.abcCatalogHierarchy.upsert({
        where: { pathKey: path.pathKey },
        create: { ...row, firstSeenAt: at, lastSeenAt: at },
        update: { ...row, lastSeenAt: at },
      });
      if (previous) updated += 1;
      else added += 1;
    } catch {
      skipped += 1;
    }
  }
  return { added, updated, skipped };
}

async function seedHierarchy(
  db: PrismaClient,
  catalog: AbcCatalogImportCatalog,
  report: AbcCatalogImportReport,
  deps: { now: () => Date; log: (line: string) => void },
): Promise<void> {
  let pageNumber = 1;
  let providerTotalItems: number | null = null;
  let providerTotalPages: number | null = null;
  for (;;) {
    if (providerTotalPages !== null && pageNumber > providerTotalPages) break;
    const page = await catalog.listHierarchyRaw(pageNumber, ABC_CATALOG_IMPORT_HIERARCHY_PER_PAGE);
    const pagination = page.pagination;
    if (providerTotalItems === null) {
      providerTotalItems = pagination.totalItems;
      providerTotalPages = pagination.totalPages;
    } else if (pagination.totalItems !== providerTotalItems ||
      pagination.totalPages !== providerTotalPages) {
      throw new AbcCatalogImportError(
        "catalog_import_hierarchy_drift",
        `catalog_import_hierarchy_drift: hierarchy totals changed ${providerTotalItems}/${providerTotalPages} -> ${pagination.totalItems}/${pagination.totalPages} on page ${pageNumber}`,
      );
    }
    const paths: MappedHierarchyPath[] = [];
    for (const entry of page.hierarchies) {
      const levels = mapHierarchyLevels(entry);
      if (!levels) {
        report.hierarchySkipped += 1;
        continue;
      }
      paths.push({ pathKey: hierarchyPathKey(levels), levels });
      report.hierarchyPathsSeen += 1;
    }
    await db.$transaction(async (tx) => {
      await setIngestionFlag(tx);
      const counts = await upsertHierarchyPaths(tx, paths, deps.now());
      report.hierarchyAdded += counts.added;
      report.hierarchyUpdated += counts.updated;
      report.hierarchySkipped += counts.skipped;
    });
    deps.log(`[abc-catalog-import] hierarchy page ${pageNumber}/${providerTotalPages ?? "?"} committed: ${report.hierarchyPathsSeen} paths seen`);
    pageNumber += 1;
  }
}

async function runDryCount(
  db: PrismaClient,
  catalog: AbcCatalogImportCatalog,
  report: AbcCatalogImportReport,
  deps: {
    maxPages: number;
    now: () => Date;
    log: (line: string) => void;
    recordFailedItem: (itemNumber: string) => void;
    dbCapacityBytes?: number;
  },
): Promise<AbcCatalogImportReport> {
  // Counts only, no writes: reads run under the ingestion flag (the ingest
  // SELECT policy is the only read path without an org session) inside
  // transactions that perform no writes.
  const capacityRaw = deps.dbCapacityBytes ??
    (process.env.ABC_CATALOG_DB_CAPACITY_BYTES
      ? Number(process.env.ABC_CATALOG_DB_CAPACITY_BYTES)
      : null);
  const usedBytes = await readDatabaseUsedBytes(db);
  report.databaseUsedBytes = usedBytes;
  if (capacityRaw === null || !Number.isFinite(capacityRaw) || capacityRaw <= 0) {
    throw new AbcCatalogImportError(
      "catalog_import_headroom_unconfigured",
      "catalog_import_headroom_unconfigured: set ABC_CATALOG_DB_CAPACITY_BYTES to the database plan's included storage " +
        "(Supabase dashboard → Settings → Database → disk usage vs plan) before importing",
    );
  }
  const freeBytes = capacityRaw - usedBytes;
  report.databaseFreeBytes = freeBytes;
  if (freeBytes < ABC_CATALOG_IMPORT_MIN_FREE_BYTES) {
    throw new AbcCatalogImportError(
      "catalog_import_insufficient_headroom",
      headroomErrorMessage(freeBytes, usedBytes, capacityRaw),
    );
  }
  // Dry runs were silent: no per-page lines at all, so a stall (run
  // 45926477998, ~113 min with no output) left no signal about where it
  // stopped. Log progress like the write path does — counts only.
  deps.log(`[abc-catalog-import] dry run headroom ok: ${(usedBytes / 1048576).toFixed(1)} MB used, ${(freeBytes / 1048576).toFixed(1)} MB free`);

  let providerTotalItems: number | null = null;
  let providerTotalPages: number | null = null;
  const countHierarchyDry = async (): Promise<void> => {
    let pageNumber = 1;
    let totals: { totalItems: number; totalPages: number } | null = null;
    for (;;) {
      if (totals && pageNumber > totals.totalPages) break;
      const page = await catalog.listHierarchyRaw(pageNumber, ABC_CATALOG_IMPORT_HIERARCHY_PER_PAGE);
      if (!totals) totals = { totalItems: page.pagination.totalItems, totalPages: page.pagination.totalPages };
      else if (page.pagination.totalItems !== totals.totalItems ||
        page.pagination.totalPages !== totals.totalPages) {
        throw new AbcCatalogImportError("catalog_import_hierarchy_drift");
      }
      const paths: MappedHierarchyPath[] = [];
      for (const entry of page.hierarchies) {
        const levels = mapHierarchyLevels(entry);
        if (!levels) {
          report.hierarchySkipped += 1;
          continue;
        }
        paths.push({ pathKey: hierarchyPathKey(levels), levels });
        report.hierarchyPathsSeen += 1;
      }
      const existingPaths = await db.$transaction(async (tx) => {
        await setIngestionFlag(tx);
        return tx.abcCatalogHierarchy.findMany({
          where: { pathKey: { in: paths.map((path) => path.pathKey) } },
          select: { pathKey: true, levels: true },
        });
      });
      const byKey = new Map(existingPaths.map((row) => [row.pathKey, row]));
      for (const path of paths) {
        const previous = byKey.get(path.pathKey);
        if (!previous) report.hierarchyAdded += 1;
        else if (canonicalizeForHash(previous.levels) !== canonicalizeForHash(path.levels)) {
          report.hierarchyUpdated += 1;
        }
      }
      deps.log(`[abc-catalog-import] hierarchy page ${pageNumber}/${totals.totalPages} counted (dry run): ${report.hierarchyPathsSeen} paths seen`);
      pageNumber += 1;
    }
  };
  await countHierarchyDry();

  let pageNumber = 1;
  for (;;) {
    if (providerTotalPages !== null && pageNumber > providerTotalPages) break;
    if (deps.maxPages > 0 && report.pagesProcessed >= deps.maxPages) break;
    const page = await catalog.listRaw({ pageNumber, itemsPerPage: ABC_CATALOG_IMPORT_ITEMS_PER_PAGE });
    const pagination = page.pagination;
    if (providerTotalItems === null) {
      providerTotalItems = pagination.totalItems;
      providerTotalPages = pagination.totalPages;
      report.providerTotalItems = providerTotalItems;
      report.providerTotalPages = providerTotalPages;
      if (pagination.totalItems < 1 || pagination.totalPages < 1 || page.items.length < 1) {
        const stored = await db.$transaction(async (tx) => {
          await setIngestionFlag(tx);
          return tx.abcCatalogItem.count();
        });
        throw new AbcCatalogImportError(
          "catalog_import_empty_provider_response",
          `catalog_import_empty_provider_response: provider returned 0 items on page 1 with ${stored} stored item(s); failing closed, stored data retained`,
        );
      }
    } else if (pagination.totalItems !== providerTotalItems ||
      pagination.totalPages !== providerTotalPages) {
      report.status = "partial";
      report.error = `catalog_import_pagination_drift: provider totals changed ${providerTotalItems}/${providerTotalPages} -> ${pagination.totalItems}/${pagination.totalPages} on page ${pageNumber}; no writes performed`;
      return report;
    }
    if (page.items.length < 1) {
      report.status = "partial";
      report.error = `catalog_import_pagination_drift: provider returned an empty page ${pageNumber} of ${providerTotalPages}; no writes performed`;
      return report;
    }
    // Same truncated-page rule as the write path: a short page against
    // consistent totals is a partial, never a silent skip.
    const expectedCount = expectedPageItemCount(pageNumber, providerTotalItems, providerTotalPages);
    if (expectedCount !== null && page.items.length !== expectedCount) {
      report.status = "partial";
      report.error = `catalog_import_short_page: provider returned ${page.items.length} items on page ${pageNumber}, expected ${expectedCount} (totals ${providerTotalItems}/${providerTotalPages}); no writes performed`;
      return report;
    }
    const mapped: MappedCatalogItem[] = [];
    for (const rawItem of page.items) {
      try {
        mapped.push(mapCatalogItem(rawItem));
      } catch {
        deps.recordFailedItem(typeof rawItem.itemNumber === "string" ? rawItem.itemNumber : "(unknown)");
      }
    }
    const existing = await db.$transaction(async (tx) => {
      await setIngestionFlag(tx);
      return tx.abcCatalogItem.findMany({
        where: { itemNumber: { in: mapped.map((item) => item.itemNumber) } },
        select: { itemNumber: true, contentHash: true, isDisplayable: true },
      });
    });
    const byNumber = new Map(existing.map((row) => [row.itemNumber, row]));
    for (const item of mapped) {
      const previous = byNumber.get(item.itemNumber);
      if (!previous) {
        report.itemsAdded += 1;
        if (!item.isDisplayable) report.itemsDeactivated += 1;
      } else if (previous.contentHash !== item.contentHash) {
        report.itemsUpdated += 1;
        if (previous.isDisplayable && !item.isDisplayable) report.itemsDeactivated += 1;
      }
    }
    report.pagesProcessed += 1;
    report.itemsSeen += page.items.length;
    deps.log(`[abc-catalog-import] page ${pageNumber}/${providerTotalPages ?? "?"} counted (dry run): seen ${report.itemsSeen}, +${report.itemsAdded}/~${report.itemsUpdated}`);
    pageNumber += 1;
  }
  // A bounded dry run is a partial count, not a completed one: the report
  // must not claim success with items_seen below the provider total, or
  // the workflow's reconciliation rejects it.
  if (deps.maxPages > 0 && report.pagesProcessed >= deps.maxPages &&
    providerTotalPages !== null && pageNumber <= providerTotalPages) {
    report.status = "partial";
    report.error = `catalog_import_bounded_stop: counted ${report.pagesProcessed} page(s) of ${providerTotalPages}; dry run, no writes performed`;
    return report;
  }
  report.status = "succeeded";
  return report;
}
