import { z } from "zod";
import { prisma } from "../../db/client";
import type { SupplierFeedFetcher } from "./types";
import { AbcSupplyAuth, createAbcSupplyFeedFetcher, loadAbcSupplyConfig } from "./abcSupply";

const endpointMapSchema = z.record(z.string().uuid(), z.string().url());
const feedSchema = z.object({
  quotes: z.array(z.object({
    materialId: z.string().uuid(),
    proposedUnitCost: z.number().finite().nonnegative().max(99_999_999.9999),
  }).strict()).max(10_000),
}).strict();
const MAX_FEED_RESPONSE_BYTES = 2_000_000;

async function readBodyWithinLimit(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_FEED_RESPONSE_BYTES) {
    throw new Error("Supplier feed response exceeds the configured size limit");
  }

  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let body = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_FEED_RESPONSE_BYTES) {
        await reader.cancel("Supplier feed response exceeds the configured size limit");
        throw new Error("Supplier feed response exceeds the configured size limit");
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return body;
  } finally {
    reader.releaseLock();
  }
}

/**
 * Default feed fetcher for SupplierIntegrationService, the scheduler, and
 * the worker: routes the operator-designated ABC Supply sandbox supplier to
 * the ABC fetcher and everything else to the operator-configured HTTPS
 * endpoint fetcher.
 *
 * Set ABC_SUPPLY_SANDBOX_SUPPLIER_ID to the UUID of the Supplier row that
 * represents ABC Supply. Create that row with
 * `npm run db:import-suppliers` (app/scripts/import-suppliers-from-dataset.ts),
 * which derives Supplier rows from the static costbook dataset and prints the
 * supplierCode -> UUID table — do not hand-make the row. When it matches the
 * sync target, the ABC sandbox pricing feed runs (a no-op [] when the
 * ABC_SUPPLY_SANDBOX_* credentials are absent). All other supplier IDs fall
 * through to fetchConfiguredSupplierFeed, preserving existing behavior exactly.
 */
export interface DefaultSupplierFeedDeps {
  /** Override for tests; defaults to the live ABC fetcher. */
  abcFetcher?: SupplierFeedFetcher;
}

/** Deadline applied to the ABC Supply sandbox route, matching the generic endpoint fetcher. */
const ABC_FEED_TIMEOUT_MS = 15_000;

/**
 * Refresh token most recently issued by ABC's rotation, retained in memory for
 * the life of this process. Written only by the rotation hook in
 * buildAbcFetcher; never logged.
 */
let retainedAbcRefreshToken: string | null = null;

function buildAbcFetcher(): SupplierFeedFetcher {
  const config = loadAbcSupplyConfig();
  if (!config) return async () => [];
  // A rotated refresh token is retained in memory for the life of this process
  // so subsequent syncs keep authenticating instead of resubmitting the
  // invalidated secret. Durability across restarts still requires the operator
  // to update the ABC_SUPPLY_SANDBOX_REFRESH_TOKEN secret (rotation is logged
  // as an error); the token value itself is never logged.
  const refreshToken = retainedAbcRefreshToken ?? config.refreshToken;
  const authConfig = { ...config, refreshToken };
  const auth = new AbcSupplyAuth(authConfig, fetch, Date.now, {
    onRefreshTokenRotated: (next) => {
      retainedAbcRefreshToken = next;
      // eslint-disable-next-line no-console
      console.error(
        "[supplier-integration] ABC Supply refresh token rotated — in-memory token updated for this process; update the ABC_SUPPLY_SANDBOX_REFRESH_TOKEN secret or the feed will stop authenticating after a restart",
      );
    },
  });
  return async (supplierId, orgId) => {
    // Same 15-second deadline as the generic endpoint fetcher: a stalled ABC
    // token or pricing request must not hold the scheduler/worker indefinitely.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ABC_FEED_TIMEOUT_MS);
    try {
      return await createAbcSupplyFeedFetcher({ config: authConfig, auth, signal: controller.signal })(
        supplierId,
        orgId,
      );
    } finally {
      clearTimeout(timeout);
    }
  };
}

export function createDefaultSupplierFeedFetcher(
  deps: DefaultSupplierFeedDeps = {},
): SupplierFeedFetcher {
  return async (supplierId, orgId) => {
    const abcSupplierId = process.env.ABC_SUPPLY_SANDBOX_SUPPLIER_ID?.trim();
    if (abcSupplierId && abcSupplierId === supplierId) {
      return (deps.abcFetcher ?? buildAbcFetcher())(supplierId, orgId);
    }
    return fetchConfiguredSupplierFeed(supplierId, orgId);
  };
}

/** Default fetcher wired into SupplierIntegrationService. */
export const fetchDefaultSupplierFeed: SupplierFeedFetcher = createDefaultSupplierFeedFetcher();

/**
 * Pulls supplier quotes only from operator-configured HTTPS endpoints. The URL
 * never comes from an HTTP request or the supplier website field, which keeps
 * the background worker from becoming an SSRF primitive. Missing global or
 * supplier-specific configuration is an intentional no-op so existing
 * installations preserve their current safe behavior.
 */
export const fetchConfiguredSupplierFeed: SupplierFeedFetcher = async (supplierId, orgId) => {
  const raw = process.env.SUPPLIER_PRICE_FEED_ENDPOINTS;
  if (!raw?.trim()) return [];

  let endpoints: Record<string, string>;
  try {
    endpoints = endpointMapSchema.parse(JSON.parse(raw));
  } catch {
    throw new Error("SUPPLIER_PRICE_FEED_ENDPOINTS must be a JSON object mapping supplier UUIDs to HTTPS URLs");
  }

  const endpoint = endpoints[supplierId];
  if (!endpoint) return [];
  const url = new URL(endpoint);
  if (url.protocol !== "https:") {
    throw new Error(`Supplier feed endpoint for ${supplierId} must use HTTPS`);
  }

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, orgId },
    select: { id: true, apiIntegrationKey: true },
  });
  if (!supplier) throw new Error(`Supplier ${supplierId} is not visible in organization ${orgId}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        ...(supplier.apiIntegrationKey ? { authorization: `Bearer ${supplier.apiIntegrationKey}` } : {}),
      },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Supplier feed returned HTTP ${response.status}`);

    const body = await readBodyWithinLimit(response);
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new Error("Supplier feed returned invalid JSON");
    }
    return feedSchema.parse(json).quotes;
  } finally {
    clearTimeout(timeout);
  }
};
