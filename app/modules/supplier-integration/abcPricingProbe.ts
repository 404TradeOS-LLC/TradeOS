import { prisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { validateAbcMaterialCandidate } from "./abcMaterialActivation";
import { priceOneAbcSandboxSku } from "./feed";

/**
 * ABC's line-level status.message is untrusted provider text. Permit only a
 * short plain-language diagnostic, and fail closed for markup, URLs, account
 * identifiers, credentials or token-shaped content. Never return raw provider
 * response bodies or use these messages as pricing evidence.
 */
function safeAbcProviderMessage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const message = raw.trim();
  if (!message || message.length > 160 || !/^[a-z0-9][a-z0-9 ,.:;!?()'/-]*$/i.test(message)) return null;
  if (/\b(?:bearer|token|password|secret|credential|authorization|refresh|session|cookie|https?|www|client[ -]?id|client[ -]?secret|api[ -]?key|access[ -]?key|private[ -]?key)\b/i.test(message)) return null;
  // Bare domains, hyphenated ship-to numbers (e.g. 2010466-2), and
  // seven-digit account identifiers are sensitive even without URL schemes.
  if (/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/i.test(message)) return null;
  if (/\d{7,}|\d{6,}-\d+/.test(message)) return null;
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(message)) return null;
  if (/[a-z0-9_-]{32,}/i.test(message)) return null;
  return message;
}

/**
 * Probe one observed, unambiguous ABC SKU before a Material exists.
 * Does not create a Material, observation, SupplierPriceUpdate, or approval.
 * Stocking unit is extracted from the provider's response, not inferred from historical evidence.
 */
export async function probeAbcSandboxPricing(
  orgId: string,
  productKey: string,
): Promise<{
  supplierProductKey: string;
  sku: string;
  sourcePurchaseUnit: string;
  priced: boolean;
  price: number | null;
  currency: "USD" | null;
  providerStatus: string;
  providerMessage: string | null;
  providerStockingUnit: string | null;
  providerStockingUnitVerified: boolean;
  materialCreated: false;
  priceApplied: false;
}> {
  // Defense-in-depth: the pilot must not become an arbitrary catalog-pricing API.
  if (productKey !== "ABC-654210") throw new ApiError(400, "This pilot only tests ABC-654210");
  const supplierId = process.env.ABC_SUPPLY_SANDBOX_SUPPLIER_ID?.trim();
  if (!supplierId) throw new ApiError(503, "ABC supplier routing is not configured");

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, orgId, apiIntegrationKey: "ABC_SUPPLY" },
    select: { id: true },
  });
  if (!supplier) throw new ApiError(404, "Configured ABC supplier is not available to this workspace");

  const product = await prisma.supplierProduct.findFirst({
    where: { orgId, supplierId, supplierProductKey: productKey },
    select: {
      id: true, name: true, sku: true, purchaseUnit: true,
      canonicalMaterialKey: true, isActive: true, materialId: true,
    },
  });
  if (!product) throw new ApiError(404, "ABC supplier product not found");

  const [matchingSupplierProductCount, matchingMaterialCount, observationCount] = await Promise.all([
    prisma.supplierProduct.count({ where: { orgId, supplierId, sku: product.sku } }),
    prisma.material.count({ where: { orgId, supplierId, sku: product.sku } }),
    prisma.supplierPriceObservation.count({ where: { orgId, supplierProductId: product.id } }),
  ]);
  // Probing is also useful after a successful Material activation. Validate the
  // linked Material belongs to this tenant and supplier rather than hiding the test.
  if (product.materialId) {
    const linked = await prisma.material.findFirst({
      where: { id: product.materialId, orgId, supplierId, sku: product.sku },
      select: { id: true },
    });
    if (!linked || matchingMaterialCount !== 1) {
      throw new ApiError(409, "Linked ABC Material requires review before pricing");
    }
  } else if (matchingMaterialCount > 0) {
    throw new ApiError(409, "ABC SKU already exists on an unlinked Material");
  }
  const { sku, unit } = validateAbcMaterialCandidate({
    name: product.name,
    sku: product.sku,
    purchaseUnit: product.purchaseUnit,
    canonicalMaterialKey: product.canonicalMaterialKey,
    isActive: product.isActive,
    // The read-only pricing probe is not an activation. Link validation above
    // permits either the unlinked pilot or one exactly matching linked Material.
    materialId: null,
    matchingSupplierProductCount,
    matchingMaterialCount: 0,
    observationCount,
  }, { apply: false, confirmedSku: null, confirmedUnit: null });

  let lines: Awaited<ReturnType<typeof priceOneAbcSandboxSku>>;
  try {
    lines = await priceOneAbcSandboxSku(orgId, supplierId, sku);
  } catch (error) {
    // Actionable failure classes only. No token or raw provider error body
    // crosses into the browser.
    const message = error instanceof Error ? error.message : "";
    if (message === "ABC sandbox credentials are not configured") {
      throw new ApiError(503, "ABC sandbox credentials are not configured on the API");
    }
    if (message === "ABC sandbox refresh token is not configured") {
      throw new ApiError(503, "ABC pricing access is not connected. Reauthorize ABC pricing access.");
    }
    const oauth = /^ABC Supply token refresh failed: HTTP (\d{3})$/.exec(message);
    if (oauth) {
      throw new ApiError(502, `ABC sandbox OAuth rejected the refresh (HTTP ${oauth[1]}). Reauthorize ABC pricing access.`);
    }
    const priceHttp = /^ABC Supply Price Items request failed: HTTP (\d{3})$/.exec(message);
    if (priceHttp) {
      throw new ApiError(502, `ABC sandbox pricing returned HTTP ${priceHttp[1]}. Verify SKU and sandbox branch/ship-to access.`);
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(504, "ABC sandbox pricing timed out");
    }
    // Persisting a rotated OAuth token is mandatory. Never mark this as
    // provider success or retry with stale credentials.
    if (/refresh.token.*(persist|vault)|vault.*(persist|unavailable)/i.test(message)) {
      throw new ApiError(503, "ABC sandbox token storage failed; pricing was not accepted");
    }
    throw error;
  }
  const line = lines.find((entry) => entry.id === "review-0" && entry.itemNumber === sku);
  const validPrice = line?.statusCode === "OK" && line.currencyCode === "USD" &&
    Number.isFinite(line.unitPrice) && line.unitPrice > 0 &&
    line.unitPrice <= 99_999_999.9999 &&
    Math.abs(line.unitPrice * 10_000 - Math.round(line.unitPrice * 10_000)) <= 1e-6;

  return {
    supplierProductKey: productKey,
    sku,
    sourcePurchaseUnit: unit,
    priced: Boolean(validPrice),
    price: validPrice ? line!.unitPrice : null,
    currency: validPrice ? "USD" : null,
    providerStatus: line?.statusCode?.slice(0, 48) ?? "no_matching_line",
    providerMessage: !validPrice && line?.statusCode !== "OK"
      ? safeAbcProviderMessage(line?.statusMessage) : null,
    providerStockingUnit: validPrice ? (line?.uom ?? null) : null,
    providerStockingUnitVerified: Boolean(validPrice && line?.uom && line.uom.toUpperCase() === unit.toUpperCase()),
    materialCreated: false,
    priceApplied: false,
  };
}
