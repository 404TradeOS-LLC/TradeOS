import { AbcCatalogClient, type AbcCatalogPage, type AbcCatalogRawItem } from "../modules/supplier-integration/abcCatalog";
import { loadAbcSupplyAuthConfig } from "../modules/supplier-integration/abcSupply";

export interface AbcCatalogProbeSummary {
  status: "verified_sandbox_page";
  provider: "ABC Supply";
  environment: "sandbox";
  productScope: "product.read";
  pagesVerified: number;
  providerReportedTotalItems: number;
  providerReportedTotalPages: number;
  activeProductsReturned: number;
  uniqueActiveProductIdentitiesChecked: number;
  storedProducts: 0;
  providerPricingRequested: false;
}

/**
 * Phase 0 (#735) summary: counts, latencies, and a field census only.
 * No item numbers, names, descriptions, or any provider payload content
 * leaves this function — the census reports per-field population counts.
 */
export interface AbcCatalogPhase0Summary {
  status: "verified_sandbox_phase0";
  provider: "ABC Supply";
  environment: "sandbox";
  productScope: "product.read";
  pagesVerified: number;
  itemsPerPage: 1000;
  providerReportedTotalItems: number;
  providerReportedTotalPages: number;
  itemsSampled: number;
  activeItemsReturned: number;
  inactiveItemsReturned: number;
  otherStatusItemsReturned: number;
  uniqueItemIdentitiesChecked: number;
  pageLatenciesMs: number[];
  pageLatencyP50Ms: number;
  pageLatencyP95Ms: number;
  latencyMethod: string;
  hierarchyLatencyMs: number;
  hierarchyTotalItems: number;
  hierarchyTotalPages: number;
  hierarchyPathsSampled: number;
  fieldCensus: Record<string, { populated: number; total: number }>;
  uomCensus: {
    itemsWithUoms: number;
    totalUomEntries: number;
    entriesWithCode: number;
    entriesWithName: number;
    entriesWithDescription: number;
  };
  dimensionalCensus: {
    dimensionalItems: number;
    withDimensionVariations: number;
    withWidthThicknessHeight: number;
  };
  hierarchyCensus: {
    itemsWithHierarchy: number;
    fullSixLevel: number;
    partialHierarchy: number;
    hierarchyShapeFindings: Record<string, number>;
    nestingOrder: "productGroup>category>productType>materialComposition>warranty>brandLine";
  };
  priceKeysFound: 0;
  estimatedStorageBytesLow: number;
  estimatedStorageBytesHigh: number;
  estimatedBytesPerItemLow: 2048;
  estimatedBytesPerItemHigh: 5120;
  storedProducts: 0;
  providerPricingRequested: false;
}

type CatalogPageReader = Pick<AbcCatalogClient, "list">;
type Phase0CatalogReader = Pick<AbcCatalogClient, "listRaw" | "listHierarchyRaw">;
type TailCatalogReader = Pick<AbcCatalogClient, "listRaw">;

/**
 * Tail probe (#735) summary: counts only, per requested page.
 * No item numbers, names, descriptions, or any provider payload content
 * leaves this function — duplicates are counted, never listed.
 */
export interface AbcCatalogTailPageSummary {
  pageNumber: number;
  itemsReturned: number;
  uniqueItemNumbers: number;
  duplicateItemNumbers: number;
  itemsWithoutIdentity: number;
  activeItems: number;
  inactiveItems: number;
  otherStatusItems: number;
  latencyMs: number;
  providerTotalItems: number;
  providerTotalPages: number;
}

export interface AbcCatalogTailProbeSummary {
  status: "verified_sandbox_tail_pages";
  provider: "ABC Supply";
  environment: "sandbox";
  productScope: "product.read";
  itemsPerPage: 1000;
  pagesProbed: number[];
  providerReportedTotalItems: number;
  providerReportedTotalPages: number;
  totalItemsReturned: number;
  totalUniqueItemNumbers: number;
  totalDuplicateItemNumbers: number;
  pages: AbcCatalogTailPageSummary[];
  storedProducts: 0;
  providerPricingRequested: false;
}

/** Tail probe bounds: at most 10 arbitrary pages, at the importer's 1000/page. */
const TAIL_PROBE_MAX_PAGES = 10;
const TAIL_PROBE_ITEMS_PER_PAGE = 1000;

/** Fixed Phase 0 bounds: three full pages at the documented 1000/page max, plus one hierarchy page. */
const PHASE0_PAGES = 3;
const PHASE0_ITEMS_PER_PAGE = 1000;
const PHASE0_HIERARCHY_ITEMS_PER_PAGE = 50;

const CENSUS_FIELDS = [
  "itemNumber", "itemDescription", "marketingDescription", "familyId", "familyName",
  "supplierName", "status", "isDimensional", "uoms", "dimensions", "color", "finish",
  "weights", "prop65Warnings", "specifications", "images", "hierarchy",
  "branches", "familyItems",
] as const;
// NOTE: no top-level "variations" field — Get All Items has no such field;
// dimensional variations live under dimensions.variations and are counted
// separately in dimensionalCensus. familyItems is requested explicitly
// (familyItems=true) because the provider returns it as null otherwise.

const HIERARCHY_LEVELS = [
  "productGroup", "category", "productType", "materialComposition", "warranty", "brandLine",
] as const;

/** A field counts as populated when it carries a real value: false/0 count; null, "", [] and {} do not. */
function isPopulated(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A dimension counts only when its nested value carries a real measurement — a null value or {} wrapper does not. */
function hasDimensionValue(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const v = value.value;
  return (typeof v === "string" && v.trim().length > 0) ||
    (typeof v === "number" && Number.isFinite(v));
}

/**
 * Any price-like key at any depth fails the probe. Parsed provider JSON is
 * shallow, but the walk is depth-capped so a pathological payload cannot
 * exhaust the stack.
 */
function containsPriceKey(value: unknown, depth = 0): boolean {
  if (depth > 10 || value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((entry) => containsPriceKey(entry, depth + 1));
  const record = value as Record<string, unknown>;
  return Object.keys(record).some(
    (key) => /price/i.test(key) || containsPriceKey(record[key], depth + 1),
  );
}

/** Nearest-rank percentile over a small sorted sample (p95 of 3 samples is the max). */
function nearestRankPercentile(sortedAscending: number[], percentile: number): number {
  const rank = Math.max(1, Math.ceil((percentile / 100) * sortedAscending.length));
  return sortedAscending[Math.min(rank, sortedAscending.length) - 1];
}

/**
 * Live, deliberately non-persistent Product API proof.
 * No response bodies or item IDs are logged, saved, or uploaded.
 * Full-import and delta-sync code remain blocked on ABC data-use permission.
 */
export async function probeAbcSandboxCatalog(
  client: CatalogPageReader,
  options: { maxPages?: 1 | 2; itemsPerPage?: number } = {},
): Promise<AbcCatalogProbeSummary> {
  const maxPages = options.maxPages ?? 1;
  const itemsPerPage = options.itemsPerPage ?? 25;
  if (![1, 2].includes(maxPages) || !Number.isInteger(itemsPerPage) ||
    itemsPerPage < 1 || itemsPerPage > 50) {
    throw new Error("invalid_probe_bounds");
  }

  let providerTotalItems: number | null = null;
  let providerTotalPages: number | null = null;
  let pagesVerified = 0;
  let activeProductsReturned = 0;
  const seen = new Set<string>();

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
    if (providerTotalPages !== null && pageNumber > providerTotalPages) break;

    const page: AbcCatalogPage = await client.list({ pageNumber, itemsPerPage });
    const pagination = page.pagination;

    if (page.environment !== "sandbox" || page.source !== "ABC Supply" ||
      page.persisted !== false || page.pricing !== "not-requested" ||
      pagination.pageNumber !== pageNumber || pagination.itemsPerPage !== itemsPerPage) {
      throw new Error("catalog_probe_contract_mismatch");
    }

    if (pageNumber === 1) {
      providerTotalItems = pagination.totalItems;
      providerTotalPages = pagination.totalPages;
      if (providerTotalItems < 1 || providerTotalPages < 1 || page.items.length < 1) {
        throw new Error("catalog_probe_empty_first_page");
      }
    } else if (providerTotalItems !== pagination.totalItems ||
               providerTotalPages !== pagination.totalPages) {
      throw new Error("catalog_probe_pagination_drift");
    }

    for (const item of page.items) {
      if (item.priceStatus !== "unpriced" || !item.itemNumber ||
          seen.has(item.itemNumber)) {
        throw new Error("catalog_probe_identity_or_pricing_mismatch");
      }
      seen.add(item.itemNumber);
    }
    activeProductsReturned += page.items.length;
    pagesVerified++;
  }

  if (providerTotalItems === null || providerTotalPages === null) {
    throw new Error("catalog_probe_missing_pagination");
  }

  return {
    status: "verified_sandbox_page",
    provider: "ABC Supply",
    environment: "sandbox",
    productScope: "product.read",
    pagesVerified,
    providerReportedTotalItems: providerTotalItems,
    providerReportedTotalPages: providerTotalPages,
    activeProductsReturned,
    uniqueActiveProductIdentitiesChecked: seen.size,
    storedProducts: 0,
    providerPricingRequested: false,
  };
}

/**
 * Phase 0 (#735): prove the catalog numbers before any importer is built.
 * Fetches exactly three pages at itemsPerPage=1000 plus one hierarchy page,
 * times each page, and records a field census over the sampled raw items.
 * familyItems=true is requested so the census measures that field instead of
 * the provider's null default. Read-only: nothing is persisted, nothing is
 * priced, and only counts, latencies, and population tallies are returned —
 * never item content.
 */
export async function probeAbcSandboxCatalogPhase0(
  client: Phase0CatalogReader,
  options: { now?: () => number } = {},
): Promise<AbcCatalogPhase0Summary> {
  const now = options.now ?? Date.now;
  const fieldCensus: Record<string, { populated: number; total: number }> = {};
  for (const field of CENSUS_FIELDS) fieldCensus[field] = { populated: 0, total: 0 };
  const uomCensus = {
    itemsWithUoms: 0, totalUomEntries: 0,
    entriesWithCode: 0, entriesWithName: 0, entriesWithDescription: 0,
  };
  const dimensionalCensus = {
    dimensionalItems: 0, withDimensionVariations: 0, withWidthThicknessHeight: 0,
  };
  const hierarchyCensus = {
    itemsWithHierarchy: 0, fullSixLevel: 0, partialHierarchy: 0,
    hierarchyShapeFindings: {} as Record<string, number>,
    nestingOrder: "productGroup>category>productType>materialComposition>warranty>brandLine" as const,
  };

  let providerTotalItems: number | null = null;
  let providerTotalPages: number | null = null;
  let pagesVerified = 0;
  let itemsSampled = 0;
  let activeItemsReturned = 0;
  let inactiveItemsReturned = 0;
  let otherStatusItemsReturned = 0;
  const seen = new Set<string>();
  const pageLatenciesMs: number[] = [];

  for (let pageNumber = 1; pageNumber <= PHASE0_PAGES; pageNumber++) {
    if (providerTotalPages !== null && pageNumber > providerTotalPages) break;
    const startedAt = now();
    const page = await client.listRaw({ pageNumber, itemsPerPage: PHASE0_ITEMS_PER_PAGE, familyItems: true });
    pageLatenciesMs.push(now() - startedAt);
    const pagination = page.pagination;

    if (page.environment !== "sandbox" || page.source !== "ABC Supply" ||
      page.persisted !== false || page.pricing !== "not-requested" ||
      pagination.pageNumber !== pageNumber || pagination.itemsPerPage !== PHASE0_ITEMS_PER_PAGE) {
      throw new Error("catalog_probe_contract_mismatch");
    }

    if (pageNumber === 1) {
      providerTotalItems = pagination.totalItems;
      providerTotalPages = pagination.totalPages;
      if (providerTotalItems < 1 || providerTotalPages < 1 || page.items.length < 1) {
        throw new Error("catalog_probe_empty_first_page");
      }
    } else if (providerTotalItems !== pagination.totalItems ||
               providerTotalPages !== pagination.totalPages) {
      throw new Error("catalog_probe_pagination_drift");
    }

    for (const item of page.items) {
      censusRawItem(item, seen, fieldCensus, uomCensus, dimensionalCensus, hierarchyCensus);
      const status = typeof item.status === "string" ? item.status.toLowerCase() : "";
      if (status === "active") activeItemsReturned++;
      else if (status === "inactive") inactiveItemsReturned++;
      else otherStatusItemsReturned++;
    }
    itemsSampled += page.items.length;
    pagesVerified++;
  }

  if (providerTotalItems === null || providerTotalPages === null || pageLatenciesMs.length < 1) {
    throw new Error("catalog_probe_missing_pagination");
  }
  // Phase 0 is a fixed three-page contract: a catalog that fits in fewer
  // pages cannot produce a p50/p95 over 3 pages, so it fails closed with a
  // distinct code instead of reporting a one-page "verified" summary.
  if (pagesVerified < PHASE0_PAGES) {
    throw new Error("catalog_probe_insufficient_pages");
  }

  const hierarchyStartedAt = now();
  // Raw hierarchy read: the strict `listHierarchy()` maps through
  // `hierarchyPath` and throws on a level missing code/label, which would
  // abort Phase 0 on the same data the census is meant to describe.
  const hierarchyPage = await client.listHierarchyRaw(1, PHASE0_HIERARCHY_ITEMS_PER_PAGE);
  const hierarchyLatencyMs = now() - hierarchyStartedAt;
  if (hierarchyPage.environment !== "sandbox" || hierarchyPage.source !== "ABC Supply" ||
    hierarchyPage.persisted !== false || hierarchyPage.pricing !== "not-requested" ||
    hierarchyPage.pagination.pageNumber !== 1 ||
    hierarchyPage.pagination.itemsPerPage !== PHASE0_HIERARCHY_ITEMS_PER_PAGE) {
    throw new Error("catalog_probe_contract_mismatch");
  }
  // Census the hierarchy page too (findings only — the full/partial path
  // counts describe sampled items). A non-object entry is itself a finding.
  for (const rawHierarchy of hierarchyPage.hierarchies) {
    if (!isRecord(rawHierarchy)) {
      const kind = Array.isArray(rawHierarchy) ? "array" : typeof rawHierarchy;
      const key = `hierarchy:not-object:${kind}`;
      hierarchyCensus.hierarchyShapeFindings[key] = (hierarchyCensus.hierarchyShapeFindings[key] ?? 0) + 1;
      continue;
    }
    censusHierarchyLevels(rawHierarchy, hierarchyCensus, false);
  }

  const sortedLatencies = [...pageLatenciesMs].sort((a, b) => a - b);
  return {
    status: "verified_sandbox_phase0",
    provider: "ABC Supply",
    environment: "sandbox",
    productScope: "product.read",
    pagesVerified,
    itemsPerPage: PHASE0_ITEMS_PER_PAGE,
    providerReportedTotalItems: providerTotalItems,
    providerReportedTotalPages: providerTotalPages,
    itemsSampled,
    activeItemsReturned,
    inactiveItemsReturned,
    otherStatusItemsReturned,
    uniqueItemIdentitiesChecked: seen.size,
    pageLatenciesMs,
    pageLatencyP50Ms: nearestRankPercentile(sortedLatencies, 50),
    pageLatencyP95Ms: nearestRankPercentile(sortedLatencies, 95),
    latencyMethod: `nearest-rank over ${pageLatenciesMs.length} page latencies`,
    hierarchyLatencyMs,
    hierarchyTotalItems: hierarchyPage.pagination.totalItems,
    hierarchyTotalPages: hierarchyPage.pagination.totalPages,
    hierarchyPathsSampled: hierarchyPage.hierarchies.length,
    fieldCensus,
    uomCensus,
    dimensionalCensus,
    hierarchyCensus,
    priceKeysFound: 0,
    estimatedStorageBytesLow: providerTotalItems * 2048,
    estimatedStorageBytesHigh: providerTotalItems * 5120,
    estimatedBytesPerItemLow: 2048,
    estimatedBytesPerItemHigh: 5120,
    storedProducts: 0,
    providerPricingRequested: false,
  };
}

function censusRawItem(
  item: AbcCatalogRawItem,
  seen: Set<string>,
  fieldCensus: Record<string, { populated: number; total: number }>,
  uomCensus: { itemsWithUoms: number; totalUomEntries: number; entriesWithCode: number; entriesWithName: number; entriesWithDescription: number },
  dimensionalCensus: { dimensionalItems: number; withDimensionVariations: number; withWidthThicknessHeight: number },
  hierarchyCensus: HierarchyCensus,
): void {
  const record = item as unknown as Record<string, unknown>;
  if (!isNonEmptyString(item.itemNumber) || seen.has(item.itemNumber)) {
    throw new Error("catalog_probe_identity_or_pricing_mismatch");
  }
  seen.add(item.itemNumber);

  // No pricing may ride along with a catalog payload: any price-like key at
  // any depth fails the probe instead of being silently counted.
  if (containsPriceKey(record)) throw new Error("catalog_probe_price_key_found");

  for (const field of CENSUS_FIELDS) {
    fieldCensus[field].total++;
    if (isPopulated(record[field])) fieldCensus[field].populated++;
  }

  const uoms = Array.isArray(record.uoms) ? record.uoms : [];
  if (uoms.length > 0) {
    uomCensus.itemsWithUoms++;
    for (const entry of uoms) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const row = entry as Record<string, unknown>;
      uomCensus.totalUomEntries++;
      if (isNonEmptyString(row.code)) uomCensus.entriesWithCode++;
      if (isNonEmptyString(row.name)) uomCensus.entriesWithName++;
      if (isNonEmptyString(row.description)) uomCensus.entriesWithDescription++;
    }
  }

  if (item.isDimensional === true) {
    dimensionalCensus.dimensionalItems++;
    const dimensions = record.dimensions;
    if (isRecord(dimensions)) {
      const variations = Array.isArray(dimensions.variations) ? dimensions.variations : [];
      if (variations.length > 0) dimensionalCensus.withDimensionVariations++;
      if (hasDimensionValue(dimensions.width) && hasDimensionValue(dimensions.thickness) &&
          hasDimensionValue(dimensions.height)) {
        dimensionalCensus.withWidthThicknessHeight++;
      }
    }
  }

  const hierarchy = record.hierarchy;
  censusHierarchyLevels(hierarchy, hierarchyCensus);
}

type HierarchyCensus = {
  itemsWithHierarchy: number; fullSixLevel: number; partialHierarchy: number;
  hierarchyShapeFindings: Record<string, number>;
};

/**
 * Walks one hierarchy object level by level. A present but malformed level
 * is recorded as a census finding (`<level>:missing-code`,
 * `<level>:missing-label`, `<level>:not-object:<kind>`) — never a throw:
 * Phase 0 measures the real sandbox shape, and the strict `hierarchyPath`
 * mapping in `listHierarchy()` would abort the run on the same data (live
 * run 45904451563). Only level names and missing fields/kinds are recorded,
 * never payload values. With `countPath` false (the hierarchy page), only
 * findings are recorded; the full/partial path counts describe sampled items.
 */
function censusHierarchyLevels(
  hierarchy: unknown,
  census: HierarchyCensus,
  countPath = true,
): void {
  if (!isRecord(hierarchy)) return;
  if (countPath) census.itemsWithHierarchy++;
  let current: unknown = hierarchy;
  let depth = 0;
  for (const level of HIERARCHY_LEVELS) {
    if (!isRecord(current)) break;
    const node = current[level];
    // Absent next level: a genuinely partial path, counted not failed.
    if (node === undefined) break;
    // Present but malformed: record the deviation as census data, never fail.
    if (!isRecord(node)) {
      const kind = Array.isArray(node) ? "array" : typeof node;
      const key = `${level}:not-object:${kind}`;
      census.hierarchyShapeFindings[key] = (census.hierarchyShapeFindings[key] ?? 0) + 1;
      break;
    }
    if (!isNonEmptyString(node.code)) {
      const key = `${level}:missing-code`;
      census.hierarchyShapeFindings[key] = (census.hierarchyShapeFindings[key] ?? 0) + 1;
    }
    if (!isNonEmptyString(node.label)) {
      const key = `${level}:missing-label`;
      census.hierarchyShapeFindings[key] = (census.hierarchyShapeFindings[key] ?? 0) + 1;
    }
    if (isNonEmptyString(node.code) && isNonEmptyString(node.label)) depth++;
    current = node;
  }
  if (countPath) {
    if (depth === HIERARCHY_LEVELS.length) census.fullSixLevel++;
    else census.partialHierarchy++;
  }
}

/**
 * Parses a comma-separated tail-page list ("257,258,259") into sorted,
 * deduplicated page numbers. Anything else is an invalid probe argument.
 */
export function parseTailPages(value: string): number[] {
  const parts = value.split(",").map((part) => part.trim());
  if (parts.length < 1 || parts.some((part) => part.length === 0)) {
    throw new Error("invalid_probe_arguments");
  }
  const pages = parts.map((part) => Number(part));
  if (pages.length > TAIL_PROBE_MAX_PAGES ||
      pages.some((page) => !Number.isInteger(page) || page < 1)) {
    throw new Error("invalid_probe_arguments");
  }
  return [...new Set(pages)].sort((a, b) => a - b);
}

/**
 * Tail probe (#735): re-reads explicit catalog pages in isolation through
 * the importer's own read path (`listRaw`, `familyItems: false`, 1000/page)
 * to diagnose the final-page shortfall two full imports hit identically
 * (page 259 returning 491 items against provider totals 258,494/259).
 * A repeated isolated 491 means the listing holds 258,491 items while
 * `totalItems` reports 258,494; a repeated 494 means transient pagination
 * instability. Per-page counts, uniqueness, and status split only — never
 * item content. A duplicate identity across the probed pages is reported,
 * not failed: the probe exists to describe the provider's pagination,
 * including any repeat, and a throw would hide the counts that diagnose it.
 * Provider totals drifting across pages still fail the probe.
 */
export async function probeAbcCatalogTailPages(
  client: TailCatalogReader,
  pageNumbers: number[],
  options: { now?: () => number } = {},
): Promise<AbcCatalogTailProbeSummary> {
  const now = options.now ?? Date.now;
  if (pageNumbers.length < 1 || pageNumbers.length > TAIL_PROBE_MAX_PAGES ||
      pageNumbers.some((page) => !Number.isInteger(page) || page < 1)) {
    throw new Error("invalid_probe_arguments");
  }
  const pages: AbcCatalogTailPageSummary[] = [];
  let providerTotalItems: number | null = null;
  let providerTotalPages: number | null = null;
  let totalItemsReturned = 0;
  let totalDuplicateItemNumbers = 0;
  const seen = new Set<string>();

  for (const pageNumber of [...pageNumbers].sort((a, b) => a - b)) {
    const startedAt = now();
    const page = await client.listRaw({ pageNumber, itemsPerPage: TAIL_PROBE_ITEMS_PER_PAGE, familyItems: false });
    const latencyMs = now() - startedAt;
    const pagination = page.pagination;

    if (page.environment !== "sandbox" || page.source !== "ABC Supply" ||
      page.persisted !== false || page.pricing !== "not-requested" ||
      pagination.pageNumber !== pageNumber || pagination.itemsPerPage !== TAIL_PROBE_ITEMS_PER_PAGE) {
      throw new Error("catalog_probe_contract_mismatch");
    }

    if (providerTotalItems === null) {
      providerTotalItems = pagination.totalItems;
      providerTotalPages = pagination.totalPages;
      if (providerTotalItems < 1 || providerTotalPages < 1) {
        throw new Error("catalog_probe_empty_first_page");
      }
    } else if (providerTotalItems !== pagination.totalItems ||
               providerTotalPages !== pagination.totalPages) {
      throw new Error("catalog_probe_pagination_drift");
    }

    let uniqueItemNumbers = 0;
    let duplicateItemNumbers = 0;
    let itemsWithoutIdentity = 0;
    let activeItems = 0;
    let inactiveItems = 0;
    let otherStatusItems = 0;
    for (const item of page.items) {
      if (!isNonEmptyString(item.itemNumber)) itemsWithoutIdentity++;
      else if (seen.has(item.itemNumber)) duplicateItemNumbers++;
      else { seen.add(item.itemNumber); uniqueItemNumbers++; }
      const status = typeof item.status === "string" ? item.status.toLowerCase() : "";
      if (status === "active") activeItems++;
      else if (status === "inactive") inactiveItems++;
      else otherStatusItems++;
    }
    totalItemsReturned += page.items.length;
    totalDuplicateItemNumbers += duplicateItemNumbers;
    pages.push({
      pageNumber,
      itemsReturned: page.items.length,
      uniqueItemNumbers,
      duplicateItemNumbers,
      itemsWithoutIdentity,
      activeItems,
      inactiveItems,
      otherStatusItems,
      latencyMs,
      providerTotalItems,
      providerTotalPages,
    });
  }

  if (providerTotalItems === null || providerTotalPages === null) {
    throw new Error("catalog_probe_missing_pagination");
  }

  return {
    status: "verified_sandbox_tail_pages",
    provider: "ABC Supply",
    environment: "sandbox",
    productScope: "product.read",
    itemsPerPage: TAIL_PROBE_ITEMS_PER_PAGE,
    pagesProbed: pages.map((page) => page.pageNumber),
    providerReportedTotalItems: providerTotalItems,
    providerReportedTotalPages: providerTotalPages,
    totalItemsReturned,
    totalUniqueItemNumbers: seen.size,
    totalDuplicateItemNumbers,
    pages,
    storedProducts: 0,
    providerPricingRequested: false,
  };
}

async function main(): Promise<void> {
  // No arbitrary URLs, SKUs, accounts, branch numbers, tokens, or response bodies
  // are accepted as input. The operator can only opt into a second bounded page,
  // the fixed Phase 0 three-page census, or an explicit tail-page list
  // (--tail-pages 257,258,259) for the #735 final-page diagnosis.
  const arg = process.argv[2];
  const isTailProbe = arg === "--tail-pages";
  if (process.argv.length > (isTailProbe ? 4 : 3) ||
      (arg !== undefined && arg !== "--two-pages" && arg !== "--phase0" && !isTailProbe)) {
    throw new Error("invalid_probe_arguments");
  }
  const tailPages = isTailProbe ? parseTailPages(process.argv[3] ?? "") : null;
  const config = loadAbcSupplyAuthConfig();
  if (!config) throw new Error("missing_sandbox_client_credentials");
  // Phase 0 and the tail probe read 1000-item pages, which exceed the 12 s
  // interactive timeout (a 25-item page was once observed taking ~29 s). The
  // probe gets a 120 s per-request budget with 2 attempts; the workflow
  // allows 20 minutes.
  const client = (arg === "--phase0" || isTailProbe)
    ? new AbcCatalogClient(
      { clientId: config.clientId, clientSecret: config.clientSecret },
      fetch, Date.now, undefined, { requestTimeoutMs: 120_000, maxAttempts: 2 },
    )
    : new AbcCatalogClient({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    });
  if (isTailProbe) {
    const result = await probeAbcCatalogTailPages(client, tailPages as number[]);
    // Metadata, counts, and latencies only. No item numbers, names,
    // descriptions, tokens, or raw response.
    process.stdout.write(JSON.stringify(result) + "\n");
    return;
  }
  if (arg === "--phase0") {
    const result = await probeAbcSandboxCatalogPhase0(client);
    // Metadata, counts, latencies, and census tallies only. No item numbers,
    // names, descriptions, tokens, or raw response.
    process.stdout.write(JSON.stringify(result) + "\n");
    return;
  }
  const result = await probeAbcSandboxCatalog(client, {
    maxPages: arg === "--two-pages" ? 2 : 1,
    itemsPerPage: 25,
  });
  // Metadata only. No item names, SKUs, bearer tokens, or raw response.
  process.stdout.write(JSON.stringify(result) + "\n");
}

const PROBE_ERROR_CODES = new Set([
  "invalid_probe_arguments",
  "missing_sandbox_client_credentials",
  "catalog_probe_contract_mismatch",
  "catalog_probe_empty_first_page",
  "catalog_probe_pagination_drift",
  "catalog_probe_identity_or_pricing_mismatch",
  "catalog_probe_missing_pagination",
  "catalog_probe_price_key_found",
  "catalog_probe_insufficient_pages",
]);

/**
 * Maps a probe failure to one redacted code for the operator. Never prints
 * provider response bodies, tokens, credentials, or raw exceptions. A schema
 * failure reports only the failing field paths and issue codes — never the
 * received values — so the next failure names the field without leaking data.
 */
export function classifyProbeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (PROBE_ERROR_CODES.has(message)) return message;
  if (/^ABC catalog provider denied request: HTTP \d{3}$/.test(message)) return "provider_denied";
  if (message === "ABC catalog provider request failed") return "provider_request_failed";
  const unavailable = /^ABC catalog provider unavailable: HTTP (\d{3})$/.exec(message);
  if (unavailable) return "provider_unavailable_http_" + unavailable[1];
  if (error && typeof error === "object" && Array.isArray((error as { issues?: unknown }).issues)) {
    const issues = (error as { issues: Array<{ path?: unknown; code?: unknown }> }).issues;
    const paths = [...new Set(issues.map((issue) => {
      const path = Array.isArray(issue.path) ? issue.path.map(String).join(".") : "";
      const code = typeof issue.code === "string" ? issue.code : "unknown";
      return (path ? path + ":" : "") + code;
    }))].slice(0, 5);
    return paths.length > 0 ? "schema_mismatch:" + paths.join(";") : "schema_mismatch";
  }
  return "provider_or_schema_failure";
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    // Never print provider response bodies, token, credential, or raw exception.
    process.stderr.write("ABC sandbox Product API validation failed: " + classifyProbeError(error) + "\n");
    process.exitCode = 1;
  });
}
