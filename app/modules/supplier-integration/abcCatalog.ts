import { z } from "zod";
import { loadAbcSupplyAuthConfig, SANDBOX_TOKEN_URL } from "./abcSupply";

/**
 * Provider-backed ABC catalog reads for Third-Party Aggregator apps.
 *
 * Important: ABC API Terms (April 9, 2026) prohibit building databases or
 * permanent copies of API content without express permission. This module
 * does NOT persist, cache, or prefetch catalog content. It never requests
 * customer-specific pricing, uses customer refresh tokens, or writes Materials.
 * It is sandbox-only until ABC grants production TPA access.
 *
 * Contract: https://apidocs.abcsupply.com/get-all-items/
 *           https://apidocs.abcsupply.com/search-items/
 */
const ITEMS_URL = "https://partners-sb.abcsupply.com/api/product/v1/items";
const SEARCH_URL = "https://partners-sb.abcsupply.com/api/product/v1/search/items";
const REQUEST_TIMEOUT_MS = 12_000;
const TOKEN_EXPIRY_MARGIN_MS = 60_000;
const MAX_ATTEMPTS = 3;
const MIN_REQUEST_SPACING_MS = 125; // per-instance conservative throttle, not a global quota

const tokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
}).passthrough();

const catalogItemSchema = z.object({
  itemNumber: z.string().trim().min(1),
  itemDescription: z.string().nullable().optional(),
  familyId: z.string().nullable().optional(),
  familyName: z.string().nullable().optional(),
  supplierName: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  isDimensional: z.boolean().nullable().optional(),
  uoms: z.unknown().optional(),
  dimensions: z.unknown().optional(),
  color: z.unknown().optional(),
  finish: z.unknown().optional(),
  prop65Warnings: z.unknown().optional(),
  variations: z.unknown().optional(),
}).passthrough();

const detailSchema = catalogItemSchema.extend({
  status: z.string().trim().min(1),
  marketingDescription: z.string().nullable().optional(),
  hierarchy: z.unknown().optional(),
  familyItems: z.array(z.object({
    itemNumber: z.string().trim().min(1),
    itemDescription: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
  }).passthrough()).nullable().optional(),
}).passthrough();

const pageSchema = z.object({
  pagination: z.object({
    itemsPerPage: z.number().int().min(1).max(1000),
    pageNumber: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
    totalItems: z.number().int().nonnegative(),
  }),
  items: z.array(catalogItemSchema).max(1000),
}).passthrough();

export type AbcCatalogItem = {
  itemNumber: string;
  name: string;
  familyId: string | null;
  familyName: string | null;
  manufacturer: string | null;
  isDimensional: boolean;
  uoms: unknown[];
  dimensions: unknown | null;
  color: unknown | null;
  finish: unknown | null;
  variations: unknown[];
  prop65Warnings: unknown[];
  source: "ABC Supply";
  priceStatus: "unpriced";
};

export interface AbcCatalogDetail extends AbcCatalogItem {
  marketingDescription: string | null;
  hierarchyLabels: string[];
  familyItems: Array<{ itemNumber: string; name: string; color: string | null }>;
  environment: "sandbox";
  persisted: false;
  pricing: "not-requested";
  branchAvailability: "not-verified";
}

export interface AbcCatalogPage {
  items: AbcCatalogItem[];
  pagination: { itemsPerPage: number; pageNumber: number; totalPages: number; totalItems: number };
  source: "ABC Supply";
  environment: "sandbox";
  pricing: "not-requested";
  persisted: false;
}

export interface AbcCatalogQuery {
  pageNumber: number;
  itemsPerPage: number;
  q?: string;
  searchBy?: "itemDescription" | "itemNumber";
  familyId?: string;
}

export function isCatalogEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ABC_SUPPLY_CATALOG_BROWSE_ENABLED === "true";
}

function arrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function hierarchyLabels(hierarchy: unknown): string[] {
  if (!hierarchy || typeof hierarchy !== "object" || Array.isArray(hierarchy)) return [];
  let node: unknown = (hierarchy as Record<string, unknown>).productGroup;
  const levels = ["category", "productType", "materialComposition", "warranty", "brandLine"];
  const names: string[] = [];
  for (const key of [null, ...levels]) {
    if (!node || typeof node !== "object" || Array.isArray(node)) break;
    const row = node as Record<string, unknown>;
    if (typeof row.label === "string" && row.label.trim()) names.push(row.label.trim());
    node = key === null ? row.category : row[key];
    // The first node is the product group; each subsequent level is nested
    // under the previous level with the next level's name.
  }
  return names;
}

function dimensionVariations(value: unknown): unknown[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return arrayOrEmpty((value as Record<string, unknown>).variations);
}

function mapItem(item: z.infer<typeof catalogItemSchema>): AbcCatalogItem {
  return {
    itemNumber: item.itemNumber,
    name: item.itemDescription ?? "",
    familyId: item.familyId ?? null,
    familyName: item.familyName ?? null,
    manufacturer: item.supplierName ?? null,
    isDimensional: item.isDimensional === true,
    uoms: arrayOrEmpty(item.uoms),
    dimensions: item.dimensions ?? null,
    color: item.color ?? null,
    finish: item.finish ?? null,
    variations: arrayOrEmpty(item.variations).length > 0
      ? arrayOrEmpty(item.variations) : dimensionVariations(item.dimensions),
    prop65Warnings: arrayOrEmpty(item.prop65Warnings),
    source: "ABC Supply",
    priceStatus: "unpriced",
  };
}

export class AbcCatalogClient {
  private token: { value: string; expiresAt: number } | null = null;
  private nextRequestAt = 0;

  constructor(
    private readonly config: { clientId: string; clientSecret: string },
    private readonly fetchFn: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  private async serverToken(): Promise<string> {
    if (this.token && this.token.expiresAt - TOKEN_EXPIRY_MARGIN_MS > this.now()) return this.token.value;
    const response = await this.callWithRetry(SANDBOX_TOKEN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: "Basic " + Buffer.from(this.config.clientId + ":" + this.config.clientSecret, "utf8").toString("base64"),
      },
      body: new URLSearchParams({ grant_type: "client_credentials", scope: "product.read" }),
    });
    const parsed = tokenSchema.parse(await response.json());
    this.token = { value: parsed.access_token, expiresAt: this.now() + parsed.expires_in * 1000 };
    return parsed.access_token;
  }

  private async callWithRetry(url: string, init: RequestInit): Promise<Response> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const until = this.nextRequestAt - this.now();
      if (until > 0) await this.sleep(until);
      this.nextRequestAt = Math.max(this.nextRequestAt, this.now()) + MIN_REQUEST_SPACING_MS;
      try {
        const response = await this.fetchFn(url, {
          ...init,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (response.ok) return response;
        if (response.status !== 429 && response.status < 500) {
          throw new Error("ABC catalog provider denied request: HTTP " + response.status);
        }
        if (attempt === MAX_ATTEMPTS - 1) {
          throw new Error("ABC catalog provider unavailable: HTTP " + response.status);
        }
        const retryAfter = response.headers?.get("retry-after");
        const retrySeconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : null;
        await this.sleep(retrySeconds === null ? 250 * 2 ** attempt : Math.min(retrySeconds * 1000, 5000));
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        // Authentication errors and explicit provider denials must not be retried.
        if (message.startsWith("ABC catalog provider denied") ||
            message.startsWith("ABC catalog provider unavailable")) throw error;
        if (attempt === MAX_ATTEMPTS - 1) throw new Error("ABC catalog provider request failed");
        await this.sleep(250 * 2 ** attempt);
      }
    }
    throw new Error("ABC catalog provider request failed");
  }

  /** A bounded on-demand product detail read; never a stored Material. */
  async getItem(itemNumber: string): Promise<AbcCatalogDetail> {
    // ABC item numbers are opaque identifiers; retain leading zeroes and case.
    // Restrict path grammar before URL construction (no slashes, hosts or query).
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(itemNumber)) {
      throw new Error("Invalid ABC item number");
    }
    const token = await this.serverToken();
    const response = await this.callWithRetry(
      ITEMS_URL + "/" + encodeURIComponent(itemNumber) + "?embed=variations&familyItems=true",
      { method: "GET", headers: { authorization: "Bearer " + token } },
    );
    const raw = detailSchema.parse(await response.json());
    if (raw.itemNumber !== itemNumber) {
      throw new Error("ABC product identity mismatch");
    }
    if (raw.status.toLowerCase() !== "active") {
      throw new Error("ABC product is not active");
    }
    return {
      ...mapItem(raw),
      marketingDescription: raw.marketingDescription ?? null,
      hierarchyLabels: hierarchyLabels(raw.hierarchy),
      familyItems: (raw.familyItems ?? []).map((family) => ({
        itemNumber: family.itemNumber,
        name: family.itemDescription ?? "",
        color: family.color ?? null,
      })),
      environment: "sandbox",
      persisted: false,
      pricing: "not-requested",
      branchAvailability: "not-verified",
    };
  }

  async list(query: AbcCatalogQuery): Promise<AbcCatalogPage> {
    if (!Number.isInteger(query.pageNumber) || query.pageNumber < 1 ||
        !Number.isInteger(query.itemsPerPage) || query.itemsPerPage < 1 || query.itemsPerPage > 1000) {
      throw new Error("Invalid ABC catalog pagination");
    }
    const token = await this.serverToken();
    const search = Boolean(query.q || query.familyId);
    let url = ITEMS_URL;
    let init: RequestInit = { method: "GET", headers: { authorization: "Bearer " + token } };

    if (search) {
      url = SEARCH_URL;
      const filters: Array<{ key: string; condition: string; values: string[]; joinCondition: string | null }> = [];
      if (query.q) filters.push({
        key: query.searchBy ?? "itemDescription", condition: "contains", values: [query.q], joinCondition: null,
      });
      if (query.familyId) filters.push({
        key: "productFamilyId", condition: "equals", values: [query.familyId],
        joinCondition: filters.length ? "and" : null,
      });
      init = {
        method: "POST",
        headers: { authorization: "Bearer " + token, "content-type": "application/json" },
        body: JSON.stringify({ filters, pagination: { pageNumber: query.pageNumber, itemsPerPage: query.itemsPerPage } }),
      };
    } else {
      const params = new URLSearchParams({
        pageNumber: String(query.pageNumber), itemsPerPage: String(query.itemsPerPage), familyItems: "false",
      });
      url += "?" + params.toString();
    }

    const response = await this.callWithRetry(url, init);
    const parsed = pageSchema.parse(await response.json());
    if (parsed.pagination.pageNumber !== query.pageNumber ||
        parsed.pagination.itemsPerPage !== query.itemsPerPage ||
        (parsed.pagination.totalPages > 0 && parsed.pagination.pageNumber > parsed.pagination.totalPages) ||
        parsed.items.length > query.itemsPerPage) {
      throw new Error("ABC catalog pagination does not match the requested page");
    }
    const seen = new Set<string>();
    for (const item of parsed.items) {
      if (seen.has(item.itemNumber)) throw new Error("Duplicate ABC item number in provider page");
      seen.add(item.itemNumber);
    }
    return {
      items: parsed.items.filter((item) => item.status?.toLowerCase() !== "inactive").map(mapItem),
      pagination: parsed.pagination,
      source: "ABC Supply",
      environment: "sandbox",
      pricing: "not-requested",
      persisted: false,
    };
  }
}

let sandboxCatalogClient: AbcCatalogClient | null = null;

/** Reuses TradeOS's existing sandbox TPA client ID/secret, NOT its customer refresh token. */
export function getSandboxAbcCatalogClient(): AbcCatalogClient | null {
  const auth = loadAbcSupplyAuthConfig();
  if (!auth) return null;
  if (!sandboxCatalogClient) sandboxCatalogClient = new AbcCatalogClient(auth);
  return sandboxCatalogClient;
}
