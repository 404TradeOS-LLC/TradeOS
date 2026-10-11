import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../../db/client";
import type { SupplierFeedFetcher } from "./types";

/**
 * ABC Supply Connect Partner APIs — sandbox feed fetcher.
 *
 * Pulls customer-specific pricing from the ABC Supply sandbox and returns it
 * as supplier price quotes, which the SupplierIntegrationService enqueues as
 * *proposals* — approval is still required before any Material price changes.
 *
 * Sandbox-only by design: the TradeOSCostbook developer-portal app currently
 * has sandbox access only. Production hosts are deliberately absent from this
 * module so nothing can accidentally run against production before ABC grants
 * production access. See the TradeOS costbook research notes for the access
 * path (Developer Portal -> "Request Production Access" -> ABC demo).
 *
 * Auth notes (from apidocs.abcsupply.com):
 * - Pricing is NOT available via client_credentials for third-party
 *   aggregators. A user token with the pricing.read scope is required, so
 *   this module mints user access tokens with the refresh_token grant from a
 *   refresh token the operator stores after completing the authorization_code
 *   flow once (e.g. via the ABC Developer Portal / OAuth tooling).
 * - Access tokens live 30 minutes; they are cached in memory and refreshed
 *   with a 60s margin.
 * - API base: https://partners-sb.abcsupply.com ; pricing endpoint
 *   POST /api/pricing/v2/prices ; token endpoint
 *   https://sandbox.auth.partners.abcsupply.com/oauth2/aus1vp07knpuqf6Xz0h8/v1/token
 * - Endpoint hosts are hardcoded constants below. They never come from env,
 *   the database, or an HTTP request, so this fetcher cannot be turned into
 *   an SSRF primitive the way a configurable-URL fetcher could.
 *
 * Request notes:
 * - purpose is always "estimating": TradeOS consumes these prices for
 *   costbook estimates, never to place orders.
 * - ABC prices up to 50 line items per request; larger catalogs are batched.
 * - Lines that come back non-OK or $0.00 are skipped: $0.00 means the branch
 *   has not entered pricing and ABC's own guidance is to call the branch.
 * - uom is omitted from requests so ABC uses its stocking UOM. The response
 *   UOM must match Material.unitOfMeasure before a price can enter review.
 *
 * Environment (all required, otherwise the fetcher is a no-op returning []):
 * - ABC_SUPPLY_SANDBOX_CLIENT_ID / ABC_SUPPLY_SANDBOX_CLIENT_SECRET
 * - ABC_SUPPLY_SANDBOX_REFRESH_TOKEN (bootstrap/recovery user refresh token, pricing.read;
 *   the default TradeOS feed persists provider rotations in Supabase Vault)
 * - ABC_SUPPLY_BRANCH_NUMBER (e.g. "579" for Terre Haute; sandbox test
 *   ship-tos only serve their own branches — the sandbox feed currently uses
 *   "340" until production access lands)
 * - ABC_SUPPLY_SHIP_TO_NUMBER
 *
 * Routing: the default supplier feed fetcher (feed.ts) sends a sync target to
 * this ABC fetcher only when its supplierId equals ABC_SUPPLY_SANDBOX_SUPPLIER_ID.
 */

const SANDBOX_TOKEN_URL =
  "https://sandbox.auth.partners.abcsupply.com/oauth2/aus1vp07knpuqf6Xz0h8/v1/token";
const SANDBOX_API_BASE = "https://partners-sb.abcsupply.com";
const PRICING_PATH = "/api/pricing/v2/prices";
const MAX_LINES_PER_REQUEST = 50;
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

export interface AbcSupplyConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  branchNumber: string;
  shipToNumber: string;
}

/** Returns null when the ABC Supply sandbox integration is not configured. */
export function loadAbcSupplyConfig(env: NodeJS.ProcessEnv = process.env): AbcSupplyConfig | null {
  const clientId = env.ABC_SUPPLY_SANDBOX_CLIENT_ID?.trim();
  const clientSecret = env.ABC_SUPPLY_SANDBOX_CLIENT_SECRET?.trim();
  const refreshToken = env.ABC_SUPPLY_SANDBOX_REFRESH_TOKEN?.trim();
  const branchNumber = env.ABC_SUPPLY_BRANCH_NUMBER?.trim();
  const shipToNumber = env.ABC_SUPPLY_SHIP_TO_NUMBER?.trim();
  if (!clientId || !clientSecret || !refreshToken || !branchNumber || !shipToNumber) return null;
  return { clientId, clientSecret, refreshToken, branchNumber, shipToNumber };
}

const tokenResponseSchema = z
  .object({
    access_token: z.string().min(1),
    expires_in: z.number().int().positive(),
    refresh_token: z.string().min(1).optional(),
  })
  .passthrough();

export interface AbcSupplyAuthHooks {
  /** Called when the token endpoint rotates the refresh token. May persist durably before auth proceeds. */
  onRefreshTokenRotated?: (refreshToken: string) => void | Promise<void>;
}

/** Mints and caches ABC Supply user access tokens via the refresh_token grant. */
export class AbcSupplyAuth {
  private cached: { accessToken: string; expiresAtMs: number } | null = null;
  private refreshToken: string;

  constructor(
    private readonly config: AbcSupplyConfig,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
    private readonly hooks: AbcSupplyAuthHooks = {},
  ) {
    this.refreshToken = config.refreshToken;
  }

  async getPricingToken(signal?: AbortSignal): Promise<string> {
    const nowMs = this.now();
    if (this.cached && this.cached.expiresAtMs - TOKEN_EXPIRY_MARGIN_MS > nowMs) {
      return this.cached.accessToken;
    }
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.refreshToken,
      scope: "pricing.read",
    });
    const response = await this.fetchFn(SANDBOX_TOKEN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${Buffer.from(
          `${this.config.clientId}:${this.config.clientSecret}`,
          "utf8",
        ).toString("base64")}`,
      },
      body,
      signal,
    });
    if (!response.ok) {
      throw new Error(`ABC Supply token refresh failed: HTTP ${response.status}`);
    }
    const parsed = tokenResponseSchema.parse(await response.json());
    if (parsed.refresh_token && parsed.refresh_token !== this.refreshToken) {
      await this.hooks.onRefreshTokenRotated?.(parsed.refresh_token);
      this.refreshToken = parsed.refresh_token;
    }
    this.cached = { accessToken: parsed.access_token, expiresAtMs: nowMs + parsed.expires_in * 1000 };
    return parsed.access_token;
  }
}

export interface AbcPriceRequestLine {
  id: string;
  itemNumber: string;
  quantity: number;
}

export interface AbcPricedLine extends AbcPriceRequestLine {
  unitPrice: number;
  uom: string | null;
  currencyCode: string;
  statusCode: string;
  statusMessage: string;
}

const priceLineSchema = z
  .object({
    id: z.string(),
    itemNumber: z.string(),
    unitPrice: z.number(),
    uom: z.string().trim().min(1).max(16).optional(),
    currency: z.object({ code: z.string(), symbol: z.string() }).passthrough().optional(),
    status: z.object({ code: z.string(), message: z.string() }).passthrough(),
  })
  .passthrough();

const priceResponseSchema = z
  .object({
    requestId: z.string().optional(),
    lines: z.array(priceLineSchema),
  })
  .passthrough();

/** Thin client over the ABC Supply sandbox Pricing API (Price Items). */
export class AbcSupplyPricingClient {
  constructor(
    private readonly auth: AbcSupplyAuth,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async priceItems(
    lines: AbcPriceRequestLine[],
    opts: { branchNumber: string; shipToNumber: string; requestId?: string },
    signal?: AbortSignal,
  ): Promise<AbcPricedLine[]> {
    const priced: AbcPricedLine[] = [];
    for (let i = 0; i < lines.length; i += MAX_LINES_PER_REQUEST) {
      const batch = lines.slice(i, i + MAX_LINES_PER_REQUEST);
      priced.push(...(await this.priceBatch(batch, opts, signal)));
    }
    return priced;
  }

  private async priceBatch(
    lines: AbcPriceRequestLine[],
    opts: { branchNumber: string; shipToNumber: string; requestId?: string },
    signal?: AbortSignal,
  ): Promise<AbcPricedLine[]> {
    const token = await this.auth.getPricingToken(signal);
    const requestId = opts.requestId ?? `tradeos-${randomUUID()}`;
    const response = await this.fetchFn(`${SANDBOX_API_BASE}${PRICING_PATH}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        requestId,
        shipToNumber: opts.shipToNumber,
        branchNumber: opts.branchNumber,
        purpose: "estimating",
        lines: lines.map((l) => ({ id: l.id, itemNumber: l.itemNumber, quantity: l.quantity })),
      }),
      signal,
    });
    if (!response.ok) {
      throw new Error(`ABC Supply Price Items request failed: HTTP ${response.status}`);
    }
    const parsed = priceResponseSchema.parse(await response.json());
    if (parsed.requestId && parsed.requestId !== requestId) {
      throw new Error("ABC Supply Price Items response requestId mismatch");
    }
    const requestedById = new Map(lines.map((l) => [l.id, l]));
    return parsed.lines.flatMap((l) => {
      const requested = requestedById.get(l.id);
      // Never trust a provider response row that cannot be attributed to an
      // exact outbound line. Otherwise an unknown id plus a matching SKU can
      // incorrectly quote another tenant Material in the review queue.
      if (!requested || l.itemNumber !== requested.itemNumber) return [];
      return [{
        id: l.id,
        itemNumber: requested.itemNumber,
        quantity: requested.quantity,
        unitPrice: l.unitPrice,
        uom: l.uom ?? null,
        currencyCode: l.currency?.code ?? "",
        statusCode: l.status.code,
        statusMessage: l.status.message,
      }];
    });
  }
}

export interface AbcSupplyMaterial {
  id: string;
  sku: string;
  unitOfMeasure: string;
}

export interface AbcSupplyFeedDeps {
  config?: AbcSupplyConfig | null;
  loadMaterials?: (supplierId: string, orgId: string) => Promise<AbcSupplyMaterial[]>;
  auth?: AbcSupplyAuth;
  pricing?: AbcSupplyPricingClient;
  /** Abort signal bounding the whole fetch (token + pricing); the caller owns the deadline. */
  signal?: AbortSignal;
}

async function defaultLoadMaterials(supplierId: string, orgId: string): Promise<AbcSupplyMaterial[]> {
  const rows = await prisma.material.findMany({
    where: { supplierId, orgId, isActive: true, sku: { not: null } },
    select: { id: true, sku: true, unitOfMeasure: true },
  });
  return rows.flatMap((r) => (r.sku?.trim() && r.unitOfMeasure?.trim()
    ? [{ id: r.id, sku: r.sku.trim(), unitOfMeasure: r.unitOfMeasure.trim() }]
    : []));
}

/**
 * Builds a SupplierFeedFetcher that prices the supplier's active, SKU-bearing
 * materials against the ABC Supply sandbox. Materials without an ABC item
 * number in `sku`, and lines ABC cannot price (non-OK status or $0.00), are
 * skipped rather than proposed.
 */
export function createAbcSupplyFeedFetcher(deps: AbcSupplyFeedDeps = {}): SupplierFeedFetcher {
  const config = deps.config === undefined ? loadAbcSupplyConfig() : deps.config;
  return async (supplierId, orgId) => {
    if (!config) return [];
    const loadMaterials = deps.loadMaterials ?? defaultLoadMaterials;
    const auth = deps.auth ?? new AbcSupplyAuth(config);
    const pricing = deps.pricing ?? new AbcSupplyPricingClient(auth);

    const materials = await loadMaterials(supplierId, orgId);
    if (materials.length === 0) return [];

    const lines: AbcPriceRequestLine[] = materials.map((m, i) => ({
      id: `line-${i}`,
      itemNumber: m.sku,
      quantity: 1,
    }));
    const priced = await pricing.priceItems(
      lines,
      {
        branchNumber: config.branchNumber,
        shipToNumber: config.shipToNumber,
      },
      deps.signal,
    );
    // Map ABC item numbers back to materials. When two materials share one
    // SKU the price cannot be attributed safely, so those SKUs are skipped
    // rather than silently pricing the wrong material.
    const materialBySku = new Map<string, AbcSupplyMaterial>();
    const ambiguousSkus = new Set<string>();
    for (const m of materials) {
      if (ambiguousSkus.has(m.sku)) continue;
      if (materialBySku.has(m.sku)) {
        ambiguousSkus.add(m.sku);
        materialBySku.delete(m.sku);
      } else {
        materialBySku.set(m.sku, m);
      }
    }
    const quotes: { materialId: string; proposedUnitCost: number }[] = [];
    for (const line of priced) {
      if (ambiguousSkus.has(line.itemNumber)) continue;
      const material = materialBySku.get(line.itemNumber);
      if (!material) continue;
      if (line.statusCode !== "OK" || line.currencyCode !== "USD") continue;
      // ABC quotes its stocking UOM, which must match the Material unit.
      // Never reinterpret a per-roll quote as a per-square Material cost.
      if (!line.uom || line.uom.toUpperCase() !== material.unitOfMeasure.trim().toUpperCase()) continue;
      // Material.unitCost is a 12,4 USD decimal; reject unsupported amounts
      // rather than silently rounding or overflowing a reviewed proposal.
      if (!Number.isFinite(line.unitPrice) || line.unitPrice <= 0 || line.unitPrice > 99_999_999.9999) continue;
      if (Math.abs(line.unitPrice * 10_000 - Math.round(line.unitPrice * 10_000)) > 1e-6) continue;
      quotes.push({ materialId: material.id, proposedUnitCost: line.unitPrice });
    }
    return quotes;
  };
}

/** Default fetcher wired to env config and Prisma. No-op ([]) when unconfigured. */
export const fetchAbcSupplyFeed: SupplierFeedFetcher = createAbcSupplyFeedFetcher();
