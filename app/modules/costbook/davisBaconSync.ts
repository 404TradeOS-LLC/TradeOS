/**
 * Davis-Bacon sync service: discovery → change detection → fetch + parse →
 * persist. Only determinations whose revision or modified date changed since
 * the last sync are re-downloaded; everything else is skipped. Per-WD
 * failures are captured in the report and never abort the whole sync.
 */
import {
  DavisBaconClient,
  DavisBaconDetermination,
  DavisBaconDocument,
  DavisBaconRate,
  defaultDavisBaconClient,
  fetchDeterminationText,
  parseDeterminationText,
  searchDeterminations,
} from "./davisBaconSamGov";

export interface DavisBaconSyncJobSpec {
  orgId: string;
  userId: string;
  state: string;
  county: string;
  label?: string;
}

export interface DavisBaconSyncFailure {
  wdNumber: string;
  error: string;
}

export interface DavisBaconSyncReport {
  orgId: string;
  state: string;
  county: string;
  label?: string;
  checked: number;
  added: number;
  updated: number;
  unchanged: number;
  retired: number;
  failed: DavisBaconSyncFailure[];
  fetchedAt: string;
}

/** Stored determination shape (mirrors the Prisma model). */
export interface StoredDavisBaconDetermination {
  id: string;
  wdNumber: string;
  revisionNumber: number;
  modifiedDate: string | null;
  counties?: string[];
  isActive?: boolean;
}

/**
 * Persistence boundary. The Prisma implementation lives in davisBaconStore.ts;
 * tests inject a fake.
 */
export interface DavisBaconStore {
  listDeterminations(orgId: string, state: string): Promise<StoredDavisBaconDetermination[]>;
  upsertDetermination(input: {
    orgId: string;
    determination: DavisBaconDetermination;
  }): Promise<{ id: string; created: boolean }>;
  retireMissingCounty(orgId: string, state: string, county: string, seenWdNumbers: string[]): Promise<number>;
  replaceRates(input: {
    determinationId: string;
    orgId: string;
    wdNumber: string;
    revisionNumber: number;
    rates: DavisBaconRate[];
  }): Promise<number>;
}

export interface DavisBaconSyncDeps {
  client?: DavisBaconClient;
  store: DavisBaconStore;
  /** Keep only persistence in a short RLS-scoped database transaction. */
  withStoreSession?: <T>(operation: () => Promise<T>) => Promise<T>;
  /** Parse override for tests; defaults to the production parser. */
  parseDocument?: (text: string, revisionNumber: number) => DavisBaconDocument;
  fetchText?: (wdNumber: string, revisionNumber: number) => Promise<string>;
  /** Discovery override for tests; defaults to the SAM.gov search. */
  discover?: (spec: DavisBaconSyncJobSpec) => Promise<DavisBaconDetermination[]>;
}

function needsRefresh(
  discovered: DavisBaconDetermination,
  stored: StoredDavisBaconDetermination | undefined,
): boolean {
  if (!stored || stored.isActive === false) return true;
  if (stored.counties && [...stored.counties].sort().join("|") !== [...discovered.counties].sort().join("|")) return true;
  if (discovered.revisionNumber !== stored.revisionNumber) return true;
  const discoveredModified = discovered.modifiedDate || "";
  const storedModified = stored.modifiedDate || "";
  return discoveredModified !== storedModified;
}

export async function syncCountyWageDeterminations(
  spec: DavisBaconSyncJobSpec,
  deps: DavisBaconSyncDeps,
): Promise<DavisBaconSyncReport> {
  const client = deps.client ?? defaultDavisBaconClient;
  const inStoreSession = deps.withStoreSession ?? (async <T>(operation: () => Promise<T>) => operation());
  const parseDocument = deps.parseDocument ?? parseDeterminationText;
  const fetchText =
    deps.fetchText ?? ((wdNumber, revisionNumber) => fetchDeterminationText(wdNumber, revisionNumber, undefined, client));
  const discover =
    deps.discover ?? ((jobSpec) => searchDeterminations({ state: jobSpec.state, county: jobSpec.county, client }));

  const report: DavisBaconSyncReport = {
    orgId: spec.orgId,
    state: spec.state,
    county: spec.county,
    ...(spec.label ? { label: spec.label } : {}),
    checked: 0,
    added: 0,
    updated: 0,
    unchanged: 0,
    retired: 0,
    failed: [],
    fetchedAt: new Date().toISOString(),
  };

  let discovered: DavisBaconDetermination[];
  try {
    discovered = await discover(spec);
  } catch (error) {
    throw new Error(
      `Davis-Bacon discovery failed for ${spec.state}/${spec.county}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  report.checked = discovered.length;

  const stored = await inStoreSession(() => deps.store.listDeterminations(spec.orgId, spec.state));
  // Empty search results can mean an upstream outage, not that all wage
  // floors were withdrawn. Never erase a county on a single empty response.
  if (
    discovered.length === 0 &&
    stored.some((row) => row.isActive !== false &&
      row.counties?.some((county) => county.toLowerCase() === spec.county.toLowerCase()))
  ) {
    throw new Error(`Davis-Bacon discovery returned no active determinations for ${spec.state}/${spec.county}; retaining existing county coverage`);
  }
  const storedByWd = new Map(stored.map((row) => [row.wdNumber, row]));

  for (const determination of discovered) {
    const existing = storedByWd.get(determination.wdNumber);
    if (!needsRefresh(determination, existing)) {
      report.unchanged += 1;
      continue;
    }
    let document: DavisBaconDocument;
    try {
      const text = await fetchText(determination.wdNumber, determination.revisionNumber);
      document = parseDocument(text, determination.revisionNumber);
    } catch (error) {
      // A bad upstream document is recoverable for this determination.
      report.failed.push({
        wdNumber: determination.wdNumber,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    // Database failures are *not* recoverable document errors. Let the
    // transaction reject and abort this job instead of retiring other WDs.
    const { created } = await inStoreSession(async () => {
      const { id, created } = await deps.store.upsertDetermination({
        orgId: spec.orgId,
        determination,
      });
      await deps.store.replaceRates({
        determinationId: id,
        orgId: spec.orgId,
        wdNumber: determination.wdNumber,
        revisionNumber: determination.revisionNumber,
        rates: document.rates,
      });
      return { created };
    });
    if (created) report.added += 1;
    else report.updated += 1;
  }

  // Only reconcile after complete successful discovery. A withdrawn WD must
  // stop appearing for this county; multi-county WDs remain valid elsewhere.
  report.retired = await inStoreSession(() =>
    deps.store.retireMissingCounty(spec.orgId, spec.state, spec.county, discovered.map((d) => d.wdNumber)),
  );
  return report;
}

/**
 * Parse DAVIS_BACON_SYNC_JOBS env config:
 * JSON array of { orgId, userId, state, county, label? }.
 */
export function parseDavisBaconSyncJobSpecs(raw: string | undefined): DavisBaconSyncJobSpec[] {
  if (!raw || raw.trim().length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("DAVIS_BACON_SYNC_JOBS is not valid JSON");
  }
  if (!Array.isArray(parsed)) throw new Error("DAVIS_BACON_SYNC_JOBS must be a JSON array");
  return parsed.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`DAVIS_BACON_SYNC_JOBS[${index}] must be an object`);
    }
    const record = entry as Record<string, unknown>;
    for (const field of ["orgId", "userId", "state", "county"] as const) {
      if (typeof record[field] !== "string" || (record[field] as string).trim().length === 0) {
        throw new Error(`DAVIS_BACON_SYNC_JOBS[${index}].${field} must be a non-empty string`);
      }
    }
    const spec: DavisBaconSyncJobSpec = {
      orgId: record.orgId as string,
      userId: record.userId as string,
      state: (record.state as string).trim().toUpperCase(),
      county: (record.county as string).trim(),
    };
    if (typeof record.label === "string" && record.label.length > 0) spec.label = record.label;
    return spec;
  });
}