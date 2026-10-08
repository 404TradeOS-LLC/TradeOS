/**
 * Davis-Bacon prevailing-wage determinations via SAM.gov.
 *
 * Correction note: the DOL API catalog carries no Davis-Bacon datasets, so the
 * production source is SAM.gov (wdol.gov retired into sam.gov). This module
 * ships the pilot path first:
 *
 *   Path B (key-free, pilot): sam.gov's own search backend
 *     GET https://sam.gov/api/prod/sgs/v1/search/?index=dbra
 *     (Accept: application/hal+json is mandatory — plain application/json 406s)
 *   plus the key-free WD document download
 *     GET https://sam.gov/api/prod/wdol/v1/wd/{wdNumber}/{revision}/download?api_key=null
 *     (303s to a presigned S3 object; fetch follows it)
 *
 *   Path A (production): the documented api.sam.gov Wage Determinations API
 *   behind a free SAM_GOV_API_KEY. Wire the key into this client when it
 *   lands; Path B is undocumented and may change, so treat it as pilot-only.
 *
 * Davis-Bacon rates are government-contract floors, not open-market rates —
 * keep them flagged by provenance alongside the BLS OEWS benchmarks and
 * store base rate + fringe separately (burdened labor = base + fringe).
 */

/** The four DOL construction types carried on every determination. */
export type DavisBaconConstructionType = "Building" | "Residential" | "Heavy" | "Highway";

export interface DavisBaconDetermination {
  /** Full WD number, e.g. "IN20260050". */
  wdNumber: string;
  revisionNumber: number;
  state: string;
  stateName: string;
  counties: string[];
  constructionTypes: DavisBaconConstructionType[];
  modifiedDate: string;
  isActive: boolean;
}

export interface DavisBaconRate {
  wdNumber: string;
  revisionNumber: number;
  /** Union/survey identifier, e.g. "ELEC0153-006" or "UAVGIN0010". */
  rateIdentifier: string;
  /** Effective date of the identifier, MM/DD/YYYY. */
  identifierDate: string;
  /** Occupation/classification as printed, e.g. "ELECTRICIAN". */
  occupation: string;
  /** Published base rate in dollars (some classifications use daily units). */
  baseRate: number;
  /** Published unit; never interpret a daily rate as an hourly wage. */
  rateUnit: "hour" | "day";
  /** Numeric fringe; null when missing or given as an unevaluated formula. */
  fringe: number | null;
  /** Original unevaluated fringe expression, retained for review. */
  fringeExpression?: string;
}

export interface DavisBaconDocument {
  determination: DavisBaconDetermination;
  rates: DavisBaconRate[];
}

export const SAM_GOV_SEARCH_BASE = "https://sam.gov/api/prod/sgs/v1/search/";
export const SAM_GOV_WDOL_BASE = "https://sam.gov/api/prod/wdol/v1";

/** Raised when SAM.gov answers with a non-2xx status. */
export class DavisBaconApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "DavisBaconApiError";
  }
}

interface SearchOptions {
  state?: string;
  county?: string;
  signal?: AbortSignal;
}

const CONSTRUCTION_TYPES: DavisBaconConstructionType[] = [
  "Building",
  "Residential",
  "Heavy",
  "Highway",
];

const SEARCH_PAGE_SIZE = 100;
const MAX_SEARCH_PAGES = 100;

function isConstructionType(value: unknown): value is DavisBaconConstructionType {
  return (
    typeof value === "string" &&
    (CONSTRUCTION_TYPES as string[]).includes(value)
  );
}

/**
 * Discovery: find active Davis-Bacon determinations for a state/county.
 * The search index records are metadata only — rate tables come from the
 * per-WD document download.
 */
export async function searchDeterminations(
  options: SearchOptions = {},
): Promise<DavisBaconDetermination[]> {
  const params = new URLSearchParams({ index: "dbra", size: String(SEARCH_PAGE_SIZE) });
  const queryParts: string[] = [];
  if (options.county) queryParts.push(options.county);
  if (options.state) queryParts.push(options.state);
  if (queryParts.length > 0) params.set("q", queryParts.join(" "));
  const records: Array<Record<string, unknown>> = [];
  let page = 0;
  let totalPages = 1;

  while (page < totalPages) {
    if (page >= MAX_SEARCH_PAGES) {
      throw new DavisBaconApiError(
        502,
        `SAM.gov WD search exceeds the ${MAX_SEARCH_PAGES}-page pilot limit`,
      );
    }
    params.set("page", String(page));
    const response = await fetch(`${SAM_GOV_SEARCH_BASE}?${params.toString()}`, {
      headers: { Accept: "application/hal+json" },
      signal: options.signal,
    });
    if (!response.ok) {
      throw new DavisBaconApiError(
        response.status,
        `SAM.gov WD search failed with status ${response.status}`,
      );
    }
    const body = (await response.json()) as {
      _embedded?: { results?: Array<Record<string, unknown>> };
      page?: { totalPages?: unknown };
    };
    records.push(...(body._embedded?.results ?? []));
    const reportedTotalPages = body.page?.totalPages;
    totalPages = typeof reportedTotalPages === "number" && Number.isInteger(reportedTotalPages)
      ? Math.max(1, reportedTotalPages)
      : 1;
    page += 1;
  }

  return records
    .filter((record) => record.isActive === true)
    .map(parseDeterminationRecord)
    .filter((determination): determination is DavisBaconDetermination => determination !== null);
}

function parseDeterminationRecord(record: Record<string, unknown>): DavisBaconDetermination | null {
  const wdNumber = record.fullReferenceNumber;
  if (typeof wdNumber !== "string" || wdNumber.length === 0) return null;
  const location = (record.location ?? {}) as Record<string, unknown>;
  const state = (location.state ?? {}) as Record<string, unknown>;
  const counties = (location.counties ?? []) as Array<Record<string, unknown>>;
  const constructionTypes = Array.isArray(record.constructionTypes)
    ? (record.constructionTypes as unknown[]).filter(isConstructionType)
    : [];
  return {
    wdNumber,
    revisionNumber: typeof record.revisionNumber === "number" ? record.revisionNumber : 0,
    state: typeof state.code === "string" ? state.code : "",
    stateName: typeof state.name === "string" ? state.name : "",
    counties: counties
      .map((county) => county.value)
      .filter((value): value is string => typeof value === "string"),
    constructionTypes,
    modifiedDate: typeof record.modifiedDate === "string" ? record.modifiedDate : "",
    isActive: record.isActive === true,
  };
}

/** Document URL for a determination revision (key-free pilot path). */
export function determinationDownloadUrl(wdNumber: string, revisionNumber: number): string {
  return `${SAM_GOV_WDOL_BASE}/wd/${encodeURIComponent(wdNumber)}/${revisionNumber}/download?api_key=null`;
}

/**
 * Fetch the raw determination text. The endpoint 303-redirects to a
 * presigned S3 object; fetch follows the redirect transparently.
 */
export async function fetchDeterminationText(
  wdNumber: string,
  revisionNumber: number,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(determinationDownloadUrl(wdNumber, revisionNumber), { signal });
  if (!response.ok) {
    throw new DavisBaconApiError(
      response.status,
      `SAM.gov WD download for ${wdNumber} rev ${revisionNumber} failed with status ${response.status}`,
    );
  }
  return response.text();
}

// ---------------------------------------------------------------------------
// Determination text parser
// ---------------------------------------------------------------------------

const HEADER_WD_RE = /^"General Decision Number:\s*([A-Z]{2}\d+)\s+(\d{2}\/\d{2}\/\d{4})/;
const HEADER_STATE_RE = /^State:\s*(.+)$/;
const HEADER_TYPES_RE = /^Construction Types:\s*(.+)$/;
const HEADER_COUNTIES_RE = /^Counties:\s*(.*)$/;
/** e.g. " ELEC0153-006 06/08/2023" or " UAVGIN0010 01/17/2024" */
const RATE_IDENTIFIER_RE = /^\*?\s*[A-Z0-9-]{4,16}\s+\d{2}\/\d{2}\/\d{4}$/;
/** e.g. "ELECTRICIAN.....$ 27.00  18.29" (fringe optional) */
const RATE_LINE_RE = /^(.*?)\.{2,}\$\s*([\d,]+\.\d{2})(?:\s*\*+)?(?:\s+(.+?))?\s*$/;
const RULE_LINE_RE = /^-{5,}$/;
const RATES_HEADER_RE = /^\s*Rates\s+Fringes\s*$/;

function parseMoney(value: string): number {
  return Number(value.replace(/,/g, ""));
}

/** Parse the header block (decision number, state, types, counties). */
function parseHeader(lines: string[]): Partial<DavisBaconDetermination> {
  const header: Partial<DavisBaconDetermination> = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().length === 0) {
      i += 1;
      continue;
    }
    let match = HEADER_WD_RE.exec(line);
    if (match) {
      header.wdNumber = match[1];
      i += 1;
      continue;
    }
    match = HEADER_STATE_RE.exec(line.trim());
    if (match) {
      header.stateName = match[1].trim();
      i += 1;
      continue;
    }
    match = HEADER_TYPES_RE.exec(line.trim());
    if (match) {
      header.constructionTypes = match[1]
        .replace(/\band\b/gi, ",")
        .split(",")
        .map((part) => part.trim())
        .filter(isConstructionType);
      i += 1;
      continue;
    }
    match = HEADER_COUNTIES_RE.exec(line.trim());
    if (match) {
      // Counties can wrap across lines: "Indiana Counties of \nClay, ... and Vigo"
      const chunks: string[] = [match[1]];
      let j = i + 1;
      while (j < lines.length && lines[j].trim().length > 0) {
        chunks.push(lines[j].trim());
        j += 1;
      }
      const joined = chunks
        .join(" ")
        .replace(/^.*?Counties of\s*/i, "")
        .replace(/\band\b/gi, ",");
      header.counties = joined
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
      i = j;
      continue;
    }
    // Stop at the first rate identifier — header is done.
    if (RATE_IDENTIFIER_RE.test(line.trim())) break;
    i += 1;
  }
  return header;
}

interface RateBlock {
  identifier: string;
  identifierDate: string;
  rates: DavisBaconRate[];
}

/** Parse the rate blocks (identifier + occupation/rate/fringe lines). */
function parseRateBlocks(
  lines: string[],
  wdNumber: string,
  revisionNumber: number,
): RateBlock[] {
  const blocks: RateBlock[] = [];
  let current: RateBlock | null = null;
  let pendingOccupation = "";

  const flushPending = () => {
    pendingOccupation = "";
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.length === 0) {
      flushPending();
      continue;
    }
    if (RULE_LINE_RE.test(line)) {
      flushPending();
      current = null;
      continue;
    }
    if (RATES_HEADER_RE.test(line)) continue;

    const identifierMatch = RATE_IDENTIFIER_RE.test(line);
    if (identifierMatch) {
      const parts = line.split(/\s+/);
      current = {
        identifier: parts[0].replace(/^\*/, ""),
        identifierDate: parts[parts.length - 1],
        rates: [],
      };
      blocks.push(current);
      flushPending();
      continue;
    }
    if (!current) continue;

    const rateMatch = RATE_LINE_RE.exec(line);
    if (rateMatch) {
      const occupation = `${pendingOccupation} ${rateMatch[1]}`
        .replace(/\.+$/, "")
        .replace(/\s+/g, " ")
        .trim();
      flushPending();
      const publishedFringe = rateMatch[3]?.trim();
      const numericFringe = publishedFringe && /^[\d,]+\.\d{2}$/.test(publishedFringe)
        ? parseMoney(publishedFringe)
        : null;
      current.rates.push({
        wdNumber,
        revisionNumber,
        rateIdentifier: current.identifier,
        identifierDate: current.identifierDate,
        occupation,
        baseRate: parseMoney(rateMatch[2]),
        rateUnit: /\b(?:per[\s-]+day|daily)\b|\/day\b/i.test(occupation) ? "day" : "hour",
        fringe: numericFringe,
        ...(publishedFringe && numericFringe === null
          ? { fringeExpression: publishedFringe }
          : {}),
      });
      continue;
    }

    // Continuation line: wrapped occupation name with no rate yet.
    if (!line.includes("$")) {
      pendingOccupation = `${pendingOccupation} ${line}`.trim();
    } else {
      flushPending();
    }
  }
  return blocks;
}

/**
 * Parse a full determination text document into metadata + rate tables.
 * `revisionNumber` comes from the search record (the text prints the
 * modification table but not a machine-readable revision field).
 */
export function parseDeterminationText(text: string, revisionNumber: number): DavisBaconDocument {
  const lines = text.split(/\r?\n/);
  const header = parseHeader(lines);
  const wdNumber = header.wdNumber ?? "";
  const blocks = parseRateBlocks(lines, wdNumber, revisionNumber);
  return {
    determination: {
      wdNumber,
      revisionNumber,
      state: header.state ?? "",
      stateName: header.stateName ?? "",
      counties: header.counties ?? [],
      constructionTypes: header.constructionTypes ?? [],
      modifiedDate: "",
      isActive: true,
    },
    rates: blocks.flatMap((block) => block.rates),
  };
}

/** County-scoped service: discovery + document fetch + parse per WD. */
export async function getCountyRates(
  state: string,
  county: string,
  signal?: AbortSignal,
): Promise<DavisBaconDocument[]> {
  const determinations = await searchDeterminations({ state, county, signal });
  const documents: DavisBaconDocument[] = [];
  for (const determination of determinations) {
    const text = await fetchDeterminationText(
      determination.wdNumber,
      determination.revisionNumber,
      signal,
    );
    const parsed = parseDeterminationText(text, determination.revisionNumber);
    documents.push({
      determination,
      rates: parsed.rates,
    });
  }
  return documents;
}
