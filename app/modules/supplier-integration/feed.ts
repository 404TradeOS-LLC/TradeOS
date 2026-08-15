import { z } from "zod";
import { prisma } from "../../db/client";
import type { SupplierFeedFetcher } from "./types";

const endpointMapSchema = z.record(z.string().uuid(), z.string().url());
const feedSchema = z.object({
  quotes: z.array(z.object({
    materialId: z.string().uuid(),
    proposedUnitCost: z.number().finite().nonnegative().max(99_999_999.9999),
  }).strict()).max(10_000),
}).strict();
const MAX_FEED_RESPONSE_BYTES = 2_000_000;

/**
 * Pulls supplier quotes only from operator-configured HTTPS endpoints. The URL
 * never comes from an HTTP request or the supplier website field, which keeps
 * the background worker from becoming an SSRF primitive. Missing global or
 * supplier-specific configuration is an intentional no-op so existing
 * installations preserve their current safe behavior.
 */
export const fetchConfiguredSupplierFeed: SupplierFeedFetcher = async (supplierId) => {
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
    where: { id: supplierId },
    select: { id: true, apiIntegrationKey: true },
  });
  if (!supplier) throw new Error(`Supplier ${supplierId} is not visible in the active organization session`);

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

    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_FEED_RESPONSE_BYTES) {
      throw new Error("Supplier feed response exceeds the configured size limit");
    }

    const body = await response.text();
    if (new TextEncoder().encode(body).byteLength > MAX_FEED_RESPONSE_BYTES) {
      throw new Error("Supplier feed response exceeds the configured size limit");
    }

    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new Error("Supplier feed returned invalid JSON");
    }
    const parsed = feedSchema.parse(json);
    return parsed.quotes;
  } finally {
    clearTimeout(timeout);
  }
};
