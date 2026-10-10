import { prisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { validateAbcMaterialCandidate } from "./abcMaterialActivation";
import { priceOneAbcSandboxSku } from "./feed";

/**
 * Probe one observed, unambiguous ABC SKU before a Material exists.
 * Does not create a Material, observation, SupplierPriceUpdate, or approval.
 * Provider stocking UOM is not returned by the current parsed ABC contract.
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
  providerStockingUnitVerified: false;
  materialCreated: false;
  priceApplied: false;
}> {
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
  const { sku, unit } = validateAbcMaterialCandidate({
    name: product.name,
    sku: product.sku,
    purchaseUnit: product.purchaseUnit,
    canonicalMaterialKey: product.canonicalMaterialKey,
    isActive: product.isActive,
    materialId: product.materialId,
    matchingSupplierProductCount,
    matchingMaterialCount,
    observationCount,
  }, { apply: false, confirmedSku: null, confirmedUnit: null });

  const lines = await priceOneAbcSandboxSku(orgId, supplierId, sku);
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
    providerStockingUnitVerified: false,
    materialCreated: false,
    priceApplied: false,
  };
}
