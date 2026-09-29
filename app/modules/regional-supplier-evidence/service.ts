import { basePrisma, prisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { runInDatabaseTransaction } from "../../db/requestSession";
import type {
  IngestRegionalSupplierEvidenceInput,
  IngestRegionalSupplierEvidenceResult,
  RegionalSupplierPriceObservationInput,
  RegionalSupplierProductInput,
  RegionalSupplierEvidenceListFilters,
  RegionalSupplierEvidenceListItem,
  RegionalSupplierEvidenceSummary,
} from "./types";

/**
 * Persists supplier catalog evidence without changing Material.unitCost.
 *
 * The caller must already be inside an authenticated request or background
 * database session. RLS is the second tenant boundary; orgId is still passed
 * explicitly so the service cannot accidentally widen a query.
 */
export class RegionalSupplierEvidenceService {
  async list(
    orgId: string,
    filters: RegionalSupplierEvidenceListFilters = {}
  ): Promise<RegionalSupplierEvidenceListItem[]> {
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 200);
    const where = {
      orgId,
      priceStatus: filters.priceStatus,
      supplierProduct: filters.supplierId ? { supplierId: filters.supplierId } : undefined,
      ...(filters.q
        ? {
            OR: [
              { observationKey: { contains: filters.q, mode: "insensitive" as const } },
              { supplierProduct: { name: { contains: filters.q, mode: "insensitive" as const } } },
              { supplierProduct: { canonicalMaterialKey: { contains: filters.q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };
    const rows = await prisma.supplierPriceObservation.findMany({
      where,
      include: {
        supplierProduct: {
          select: {
            supplierProductKey: true,
            name: true,
            canonicalMaterialKey: true,
            supplierId: true,
            supplier: { select: { name: true } },
          },
        },
      },
      orderBy: [{ observedAt: "desc" }, { id: "desc" }],
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      observationKey: row.observationKey,
      supplierProductKey: row.supplierProduct.supplierProductKey,
      supplierProductName: row.supplierProduct.name,
      canonicalMaterialKey: row.supplierProduct.canonicalMaterialKey,
      supplierId: row.supplierProduct.supplierId,
      supplierName: row.supplierProduct.supplier.name,
      marketCode: row.marketCode,
      storeName: row.storeName,
      observedAt: row.observedAt,
      priceStatus: row.priceStatus,
      regularPrice: row.regularPrice === null ? null : Number(row.regularPrice),
      effectivePrice: row.effectivePrice === null ? null : Number(row.effectivePrice),
      normalizedUnitPrice: row.normalizedUnitPrice === null ? null : Number(row.normalizedUnitPrice),
      normalizedUnit: row.normalizedUnit,
      sourceFile: row.sourceFile,
      sourceRow: row.sourceRow,
    }));
  }

  async summary(orgId: string): Promise<RegionalSupplierEvidenceSummary> {
    const [groups, suppliers] = await Promise.all([
      prisma.supplierPriceObservation.groupBy({
        by: ["priceStatus"],
        where: { orgId },
        _count: { _all: true },
      }),
      prisma.supplierProduct.findMany({
        where: { orgId },
        select: { supplierId: true },
        distinct: ["supplierId"],
      }),
    ]);
    const counts = new Map(groups.map((group) => [group.priceStatus, group._count._all]));
    return {
      totalObservations: groups.reduce((total, group) => total + group._count._all, 0),
      priced: counts.get("priced") ?? 0,
      unavailable: counts.get("unavailable") ?? 0,
      notListed: counts.get("not-listed") ?? 0,
      needsReview: counts.get("needs-review") ?? 0,
      suppliers: suppliers.length,
    };
  }

  async ingest(input: IngestRegionalSupplierEvidenceInput): Promise<IngestRegionalSupplierEvidenceResult> {
    const { products, observations } = prepareRegionalSupplierEvidence(input);

    return runInDatabaseTransaction(basePrisma, async (transaction) => {
      const supplier = await transaction.supplier.findFirst({
        where: { id: input.supplierId, orgId: input.orgId },
        select: { id: true },
      });
      if (!supplier) throw new ApiError(404, `Supplier ${input.supplierId} not found`);

      const materialIds = [...new Set(products.flatMap((product) => product.materialId ? [product.materialId] : []))];
      if (materialIds.length > 0) {
        const materials = await transaction.material.findMany({
          where: { orgId: input.orgId, id: { in: materialIds } },
          select: { id: true },
        });
        const knownMaterialIds = new Set(materials.map((material) => material.id));
        const invalidMaterialId = materialIds.find((materialId) => !knownMaterialIds.has(materialId));
        if (invalidMaterialId) {
          throw new ApiError(400, `Material ${invalidMaterialId} is not available in this organization`);
        }
      }

      const productIds = new Map<string, string>();
      for (const product of products) {
        const row = await transaction.supplierProduct.upsert({
          where: {
            orgId_supplierId_supplierProductKey: {
              orgId: input.orgId,
              supplierId: input.supplierId,
              supplierProductKey: product.supplierProductKey,
            },
          },
          create: toProductCreate(input, product),
          update: toProductUpdate(input, product),
        });
        productIds.set(product.supplierProductKey, row.id);
      }

      let unavailableObservations = 0;
      for (const observation of observations) {
        const supplierProductId = productIds.get(observation.supplierProductKey);
        if (!supplierProductId) {
          throw new ApiError(400, `Observation ${observation.observationKey} references an unknown supplier product`);
        }

        if (observation.priceStatus === "unavailable") unavailableObservations += 1;
        await transaction.supplierPriceObservation.upsert({
          where: {
            orgId_supplierProductId_observationKey: {
              orgId: input.orgId,
              supplierProductId,
              observationKey: observation.observationKey,
            },
          },
          create: toObservationCreate(input, supplierProductId, observation),
          update: toObservationUpdate(input, supplierProductId, observation),
        });
      }

      return {
        productsUpserted: products.length,
        observationsUpserted: observations.length,
        unavailableObservations,
      };
    });
  }
}

export function prepareRegionalSupplierEvidence(input: IngestRegionalSupplierEvidenceInput): {
  products: RegionalSupplierProductInput[];
  observations: RegionalSupplierPriceObservationInput[];
} {
  return {
    products: dedupeProducts(input.products),
    observations: dedupeObservations(input.observations),
  };
}

function dedupeProducts(rows: RegionalSupplierProductInput[]): RegionalSupplierProductInput[] {
  const byKey = new Map<string, RegionalSupplierProductInput>();
  for (const row of rows) {
    const key = required(row.supplierProductKey, "supplierProductKey");
    const name = required(row.name, "name");
    if (byKey.has(key)) throw new ApiError(400, `Duplicate supplier product key ${key}`);
    byKey.set(key, { ...row, supplierProductKey: key, name });
  }
  return [...byKey.values()];
}

function dedupeObservations(rows: RegionalSupplierPriceObservationInput[]): RegionalSupplierPriceObservationInput[] {
  const byKey = new Map<string, RegionalSupplierPriceObservationInput>();
  for (const row of rows) {
    const key = required(row.observationKey, "observationKey");
    const productKey = required(row.supplierProductKey, "supplierProductKey");
    if (byKey.has(key)) throw new ApiError(400, `Duplicate observation key ${key}`);
    byKey.set(key, { ...row, observationKey: key, supplierProductKey: productKey });
  }
  return [...byKey.values()];
}

function toProductCreate(input: IngestRegionalSupplierEvidenceInput, row: RegionalSupplierProductInput) {
  return {
    orgId: input.orgId,
    supplierId: input.supplierId,
    materialId: row.materialId ?? null,
    supplierProductKey: row.supplierProductKey,
    sku: row.sku ?? null,
    manufacturerPartNumber: row.manufacturerPartNumber ?? null,
    name: row.name,
    description: row.description ?? null,
    packageDescription: row.packageDescription ?? null,
    purchaseUnit: row.purchaseUnit ?? null,
    packageQuantity: row.packageQuantity ?? null,
    productUrl: row.productUrl ?? null,
    canonicalMaterialKey: row.canonicalMaterialKey ?? null,
    availabilityStatus: row.availabilityStatus ?? "unknown",
    isActive: row.isActive ?? true,
    sourceFile: row.sourceFile ?? input.sourceFile ?? null,
  };
}

function toProductUpdate(input: IngestRegionalSupplierEvidenceInput, row: RegionalSupplierProductInput) {
  const { orgId: _orgId, supplierId: _supplierId, ...data } = toProductCreate(input, row);
  return data;
}

function toObservationCreate(input: IngestRegionalSupplierEvidenceInput, supplierProductId: string, row: RegionalSupplierPriceObservationInput) {
  return {
    orgId: input.orgId,
    supplierProductId,
    observationKey: row.observationKey,
    marketCode: row.marketCode ?? null,
    storeName: row.storeName ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    postalCode: row.postalCode ?? null,
    observedAt: row.observedAt,
    sourceUrl: row.sourceUrl ?? null,
    sourceFile: row.sourceFile ?? input.sourceFile ?? null,
    sourceRow: row.sourceRow ?? null,
    currency: row.currency ?? "USD",
    priceStatus: row.priceStatus,
    regularPrice: row.regularPrice ?? null,
    salePrice: row.salePrice ?? null,
    rebatePrice: row.rebatePrice ?? null,
    effectivePrice: row.effectivePrice ?? null,
    purchaseUnit: row.purchaseUnit ?? null,
    packageQuantity: row.packageQuantity ?? null,
    normalizedUnitPrice: row.normalizedUnitPrice ?? null,
    normalizedUnit: row.normalizedUnit ?? null,
    eligibilityReason: row.eligibilityReason ?? null,
    sourceConfidence: row.sourceConfidence ?? null,
  };
}

function toObservationUpdate(input: IngestRegionalSupplierEvidenceInput, supplierProductId: string, row: RegionalSupplierPriceObservationInput) {
  const { orgId: _orgId, observationKey: _observationKey, ...data } = toObservationCreate(input, supplierProductId, row);
  return data;
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new ApiError(400, `${field} is required`);
  return normalized;
}

export const regionalSupplierEvidenceService = new RegionalSupplierEvidenceService();
