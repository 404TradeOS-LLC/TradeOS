import { Prisma } from "@prisma/client";
import { basePrisma, prisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { runInDatabaseTransaction } from "../../db/requestSession";
import { COSTBOOK_PILOT_CANONICAL_ITEMS, matchPilotCanonicalProduct } from "../costbook/canonicalProductMatcher";
import { canonicalIdentityConflictsWithProductText, resolveTradeOsCanonicalMaterialKey } from "../costbook/supplierCanonicalIdentity";
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
    const where: Prisma.SupplierPriceObservationWhereInput = {
      orgId,
      priceStatus: filters.priceStatus,
      supplierProduct: filters.supplierId ? { supplierId: filters.supplierId } : undefined,
    };

    if (filters.q) {
      where.OR = [
        { observationKey: { contains: filters.q, mode: "insensitive" } },
        { supplierProduct: { name: { contains: filters.q, mode: "insensitive" } } },
        { supplierProduct: { canonicalMaterialKey: { contains: filters.q, mode: "insensitive" } } },
      ];
    }

    if (filters.cursor) {
      const cursor = await prisma.supplierPriceObservation.findFirst({
        where: { id: filters.cursor, orgId },
        select: { id: true, observedAt: true },
      });
      if (!cursor) throw new ApiError(400, "Invalid supplier evidence cursor");

      where.AND = [
        {
          OR: [
            { observedAt: { lt: cursor.observedAt } },
            { observedAt: cursor.observedAt, id: { lt: cursor.id } },
          ],
        },
      ];
    }

    const rows = await prisma.supplierPriceObservation.findMany({
      where,
      include: {
        supplierProduct: {
          select: {
            id: true,
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
      supplierProductId: row.supplierProduct.id,
      observationKey: row.observationKey,
      supplierProductKey: row.supplierProduct.supplierProductKey,
      supplierProductName: row.supplierProduct.name,
      canonicalMaterialKey: row.supplierProduct.canonicalMaterialKey,
      supplierId: row.supplierProduct.supplierId,
      supplierName: row.supplierProduct.supplier.name,
      marketCode: row.marketCode,
      storeName: row.storeName,
      observedAt: row.observedAt,
      currency: row.currency,
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

  async previewCanonicalMatch(orgId: string, productId: string) {
    const product = await prisma.supplierProduct.findFirst({
      where: { id: productId, orgId },
      select: {
        id: true,
        name: true,
        description: true,
        packageDescription: true,
        purchaseUnit: true,
        canonicalMaterialKey: true,
        sku: true,
        manufacturerPartNumber: true,
        omniclass23: true,
        unspsc: true,
      },
    });
    if (!product) throw new ApiError(404, `Supplier product ${productId} not found`);

    return {
      supplierProductId: product.id,
      currentCanonicalMaterialKey: product.canonicalMaterialKey,
      match: matchPilotCanonicalProduct({
        name: product.name,
        description: product.description,
        packageDescription: product.packageDescription,
        purchaseUnit: product.purchaseUnit,
        canonicalMaterialKey: product.canonicalMaterialKey,
        sku: product.sku,
        manufacturerPartNumber: product.manufacturerPartNumber,
        omniclass23: product.omniclass23,
        unspsc: product.unspsc,
      }),
    };
  }

  async reviewCanonicalMatch(
    orgId: string,
    actorUserId: string,
    productId: string,
    canonicalMaterialKey: string
  ) {
    const canonical = COSTBOOK_PILOT_CANONICAL_ITEMS.find(
      (item) => item.canonicalMaterialKey === canonicalMaterialKey
    );
    if (!canonical) {
      throw new ApiError(422, `Canonical material key ${canonicalMaterialKey} is not in the governed pilot registry`);
    }

    return runInDatabaseTransaction(basePrisma, async (transaction) => {
      const product = await transaction.supplierProduct.findFirst({
        where: { id: productId, orgId },
        select: {
          id: true,
          name: true,
          description: true,
          packageDescription: true,
          purchaseUnit: true,
          canonicalMaterialKey: true,
          sku: true,
          manufacturerPartNumber: true,
          omniclass23: true,
          unspsc: true,
        },
      });
      if (!product) throw new ApiError(404, `Supplier product ${productId} not found`);

      if (product.canonicalMaterialKey && product.canonicalMaterialKey !== canonicalMaterialKey) {
        throw new ApiError(409, `Supplier product ${productId} is already linked to a different canonical material`);
      }

      const match = matchPilotCanonicalProduct({
        name: product.name,
        description: product.description,
        packageDescription: product.packageDescription,
        purchaseUnit: product.purchaseUnit,
        canonicalMaterialKey: product.canonicalMaterialKey,
        sku: product.sku,
        manufacturerPartNumber: product.manufacturerPartNumber,
        omniclass23: product.omniclass23,
        unspsc: product.unspsc,
      });
      if (
        match.action === "CREATE_NEW_CANDIDATE" ||
        match.canonicalMaterialKey !== canonicalMaterialKey
      ) {
        throw new ApiError(422, `Canonical material key ${canonicalMaterialKey} is not the governed matcher suggestion for this supplier product`);
      }

      const updated = await transaction.supplierProduct.updateMany({
        where: {
          id: productId,
          orgId,
          name: product.name,
          description: product.description,
          packageDescription: product.packageDescription,
          purchaseUnit: product.purchaseUnit,
          canonicalMaterialKey: product.canonicalMaterialKey,
          sku: product.sku,
          manufacturerPartNumber: product.manufacturerPartNumber,
        },
        data: { canonicalMaterialKey },
      });
      if (updated.count !== 1) {
        throw new ApiError(409, `Supplier product ${productId} could not be linked because it changed during review`);
      }

      if (transaction.activityEvent && typeof transaction.activityEvent.create === "function") {
        await transaction.activityEvent.create({
          data: {
            orgId,
            entityType: "supplier_product",
            entityId: productId,
            eventType: "costbook.supplier_product.canonical_match_reviewed",
            title: `Canonical match reviewed: ${product.name}`,
            actorUserId,
            metadataJson: {
              previousCanonicalMaterialKey: product.canonicalMaterialKey,
              canonicalMaterialKey,
              canonicalDisplayName: canonical.displayName,
            },
            occurredAt: new Date(),
          },
        });
      }

      return {
        supplierProductId: productId,
        previousCanonicalMaterialKey: product.canonicalMaterialKey,
        canonicalMaterialKey,
        displayName: canonical.displayName,
        reviewedByUserId: actorUserId,
        reviewed: true as const,
      };
    });
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
        const automaticMatch = automaticPilotMatch(product);
        const productWhere = {
          orgId_supplierId_supplierProductKey: {
            orgId: input.orgId,
            supplierId: input.supplierId,
            supplierProductKey: product.supplierProductKey,
          },
        };

        if (automaticMatch && typeof transaction.$executeRaw === "function") {
          await transaction.$executeRaw(
            Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`costbook-supplier-product-auto-link:${input.orgId}:${input.supplierId}:${product.supplierProductKey}`}, 0))`
          );
        }

        const existingProduct =
          automaticMatch && typeof transaction.supplierProduct.findUnique === "function"
            ? await transaction.supplierProduct.findUnique({
                where: productWhere,
                select: { id: true, canonicalMaterialKey: true },
              })
            : null;

        const row = await transaction.supplierProduct.upsert({
          where: productWhere,
          create: toProductCreate(input, product),
          update: toProductUpdate(input, product),
        });
        productIds.set(product.supplierProductKey, row.id);

        if (
          automaticMatch &&
          !existingProduct &&
          transaction.activityEvent &&
          typeof transaction.activityEvent.create === "function"
        ) {
          await transaction.activityEvent.create({
            data: {
              orgId: input.orgId,
              entityType: "supplier_product",
              entityId: row.id,
              eventType: "costbook.supplier_product.canonical_match_auto_linked",
              title: `Canonical match auto-linked: ${product.name}`,
              actorUserId: null,
              metadataJson: {
                actorType: "system",
                canonicalMaterialKey: automaticMatch.canonicalMaterialKey,
                canonicalDisplayName: automaticMatch.displayName,
                matchScore: automaticMatch.score,
                matchRationale: automaticMatch.rationale,
                normalizedText: automaticMatch.normalizedText,
                sourceFile: product.sourceFile ?? input.sourceFile ?? null,
              },
              occurredAt: new Date(),
            },
          });
        }
      }

      let unavailableObservations = 0;
      for (const observation of observations) {
        const supplierProductId = productIds.get(observation.supplierProductKey);
        if (!supplierProductId) {
          throw new ApiError(400, `Observation ${observation.observationKey} references an unknown supplier product`);
        }

        if (observation.priceStatus === "unavailable") unavailableObservations += 1;
        const data = toObservationCreate(input, supplierProductId, observation);
        const uniqueWhere = {
          orgId_supplierProductId_observationKey: {
            orgId: input.orgId,
            supplierProductId,
            observationKey: observation.observationKey,
          },
        };
        let current = await transaction.supplierPriceObservation.findUnique({ where: uniqueWhere });
        if (!current) {
          const inserted = await transaction.supplierPriceObservation.createMany({
            data,
            skipDuplicates: true,
          });
          if (inserted.count === 0) {
            current = await transaction.supplierPriceObservation.findUnique({ where: uniqueWhere });
            if (!current) {
              throw new ApiError(
                409,
                `Supplier price observation ${observation.observationKey} could not be inserted because the unique key changed concurrently`
              );
            }
          }
        }
        if (current && !supplierPriceObservationReplayMatches(current, data)) {
          throw new ApiError(
            409,
            `Supplier price observation ${observation.observationKey} already exists with different evidence; use a new observation key so history remains immutable`
          );
        }
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
    if (row.unspsc != null && !/^\d{8}$/.test(row.unspsc)) {
      throw new ApiError(422, `Invalid UNSPSC for supplier product ${key}: expected an 8-digit commodity code`);
    }
    if (row.omniclass23 != null && (!row.omniclass23.trim() || row.omniclass23.length > 80)) {
      throw new ApiError(422, `Invalid OmniClass 23 classification for supplier product ${key}`);
    }
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

function automaticPilotMatch(row: RegionalSupplierProductInput) {
  if (row.canonicalMaterialKey) return null;
  const match = matchPilotCanonicalProduct({
    name: row.name,
    description: row.description,
    packageDescription: row.packageDescription,
    purchaseUnit: row.purchaseUnit,
    sku: row.sku,
    manufacturerPartNumber: row.manufacturerPartNumber,
    omniclass23: row.omniclass23,
    unspsc: row.unspsc,
  });
  return match.action === "AUTO_LINK" ? match : null;
}

function toProductCreate(input: IngestRegionalSupplierEvidenceInput, row: RegionalSupplierProductInput) {
  const match = automaticPilotMatch(row);

  return {
    orgId: input.orgId,
    supplierId: input.supplierId,
    materialId: row.materialId ?? null,
    supplierProductKey: row.supplierProductKey,
    sku: row.sku ?? null,
    manufacturerPartNumber: row.manufacturerPartNumber ?? null,
    omniclass23: row.omniclass23 ?? null,
    unspsc: row.unspsc ?? null,
    name: row.name,
    description: row.description ?? null,
    packageDescription: row.packageDescription ?? null,
    purchaseUnit: row.purchaseUnit ?? null,
    packageQuantity: row.packageQuantity ?? null,
    productUrl: row.productUrl ?? null,
    canonicalMaterialKey:
      normalizeIncomingCanonicalMaterialKey(row.canonicalMaterialKey, row) ??
      (match?.action === "AUTO_LINK" ? match.canonicalMaterialKey : null),
    availabilityStatus: row.availabilityStatus ?? "unknown",
    isActive: row.isActive ?? true,
    sourceFile: row.sourceFile ?? input.sourceFile ?? null,
  };
}

function toProductUpdate(input: IngestRegionalSupplierEvidenceInput, row: RegionalSupplierProductInput) {
  const {
    orgId: _orgId,
    supplierId: _supplierId,
    canonicalMaterialKey: _autoMatchedCanonicalKey,
    ...data
  } = toProductCreate(input, row);

  // Canonical identity is create-only during evidence import. Once a supplier
  // product exists, only the explicit manager review path may change its
  // canonical link. Re-imports therefore cannot erase or replace a reviewed
  // mapping, even when a workbook repeats a conflicting source key.
  return {
    ...data,
    // Missing classifications in a later feed must not erase earlier evidence.
    omniclass23: row.omniclass23 === undefined ? undefined : row.omniclass23,
    unspsc: row.unspsc === undefined ? undefined : row.unspsc,
  };
}

function normalizeIncomingCanonicalMaterialKey(
  value: string | null | undefined,
  row: RegionalSupplierProductInput
): string | null | undefined {
  if (value === undefined || value === null) return value;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const canonical = resolveTradeOsCanonicalMaterialKey(trimmed);
  if (!canonical) return trimmed;

  const evidenceText = [
    row.name,
    row.description ?? "",
    row.packageDescription ?? "",
  ].join(" ");

  return canonicalIdentityConflictsWithProductText(canonical, evidenceText)
    ? null
    : canonical;
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

export function supplierPriceObservationReplayMatches(existing: object, incoming: object): boolean {
  const left = existing as Record<string, unknown>;
  const right = incoming as Record<string, unknown>;
  const fields = [
    "orgId",
    "supplierProductId",
    "observationKey",
    "marketCode",
    "storeName",
    "city",
    "state",
    "postalCode",
    "observedAt",
    "sourceUrl",
    "sourceFile",
    "sourceRow",
    "currency",
    "priceStatus",
    "regularPrice",
    "salePrice",
    "rebatePrice",
    "effectivePrice",
    "purchaseUnit",
    "packageQuantity",
    "normalizedUnitPrice",
    "normalizedUnit",
    "eligibilityReason",
    "sourceConfidence",
  ] as const;

  return fields.every((field) => comparableObservationValue(left[field]) === comparableObservationValue(right[field]));
}

function comparableObservationValue(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return Number(value).toString();
  if (typeof value === "object" && "toNumber" in value && typeof (value as { toNumber?: unknown }).toNumber === "function") {
    return Number((value as { toNumber: () => number }).toNumber()).toString();
  }
  return String(value);
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new ApiError(400, `${field} is required`);
  return normalized;
}

export const regionalSupplierEvidenceService = new RegionalSupplierEvidenceService();
