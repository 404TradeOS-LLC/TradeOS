import { prisma } from "../../db/client";
import { applyOverhead, marginFromMarkup, markupFromMargin, round2, sellPrice } from "../estimate-engine/formulas";
import { pageCatalogRows, type CatalogPage, type CatalogQuery } from "../shared/catalog-query";
import { resolvePrice, type PriceConfidence, type ResolvedPrice } from "./priceResolver";
import { COSTBOOK_PILOT_CANONICAL_ITEMS, normalizeCostbookUnit } from "./canonicalProductMatcher";
import {
  canonicalIdentityConflictsWithProductText,
  resolveTradeOsCanonicalMaterialKey,
  supplierCanonicalAliasesForTradeOsIdentity,
} from "./supplierCanonicalIdentity";

export interface CostbookPricingPreviewInput {
  jobCost: number;
  directOverhead?: number;
  overheadPct?: number;
  mode: "markup" | "targetMargin";
  markupPct?: number;
  targetMarginPct?: number;
}

export interface CostbookPricingPreview {
  jobCost: number;
  directOverhead: number;
  overheadPct: number;
  totalCost: number;
  sellPrice: number;
  grossProfit: number;
  markupPct: number;
  marginPct: number;
}

export interface CostbookPriceHistoryFilter {
  limit?: number;
  materialId?: string;
  estimateId?: string;
  sourceType?: "cost_item" | "assembly";
  from?: Date;
  to?: Date;
}

export interface CostbookPriceHistoryPageFilter extends CostbookPriceHistoryFilter {
  materialCursor?: string;
  estimateCursor?: string;
}

export interface CostbookPriceHistory {
  materialChanges: Array<{
    id: string;
    materialId: string;
    materialName: string;
    oldUnitCost: number;
    newUnitCost: number;
    source: string;
    actorUserId: string | null;
    actorRole: string | null;
    createdAt: string;
  }>;
  estimateSnapshots: Array<{
    id: string;
    estimateId: string;
    sourceType: "cost_item" | "assembly";
    sourceId: string;
    description: string;
    quantity: number;
    unitOfMeasure: string;
    unitCost: number;
    lineCost: number;
    createdAt: string;
  }>;
}

export interface ResolveCanonicalPriceInput {
  canonicalMaterialKey: string;
  postalCode?: string;
  unit?: string;
  now?: Date;
}

export interface CostbookPriceHistoryPage {
  materialChanges: CatalogPage<CostbookPriceHistory["materialChanges"][number]>;
  estimateSnapshots: CatalogPage<CostbookPriceHistory["estimateSnapshots"][number]>;
}

export class CostbookPricingService {
  preview(input: CostbookPricingPreviewInput): CostbookPricingPreview {
    const directOverhead = input.directOverhead ?? 0;
    const overheadPct = input.overheadPct ?? 0;
    const totalCost = applyOverhead(input.jobCost, directOverhead, overheadPct);
    const price = sellPrice({
      totalCost,
      mode: input.mode,
      markupPct: input.mode === "markup" ? input.markupPct : undefined,
      targetMarginPct: input.mode === "targetMargin" ? input.targetMarginPct : undefined,
    });
    const markupPct = input.mode === "markup" ? input.markupPct ?? 0 : markupFromMargin(input.targetMarginPct ?? 0);
    const marginPct = input.mode === "targetMargin" ? input.targetMarginPct ?? 0 : marginFromMarkup(input.markupPct ?? 0);

    return {
      jobCost: round2(input.jobCost),
      directOverhead: round2(directOverhead),
      overheadPct: round2(overheadPct),
      totalCost,
      sellPrice: price,
      grossProfit: round2(price - totalCost),
      markupPct,
      marginPct,
    };
  }

  /**
   * Resolve current supplier observation evidence for one canonical material.
   * Existing regional supplier evidence is conservatively treated as retail
   * validation rather than being upgraded to account/negotiated pricing.
   */
  async resolveCanonicalPrice(orgId: string, input: ResolveCanonicalPriceInput): Promise<ResolvedPrice | null> {
    const identity = resolveCanonicalPriceIdentity(input.canonicalMaterialKey);
    if (!identity) return null;

    const { canonicalMaterialKey, lookupKeys, allowCrossSupplier } = identity;

    const now = input.now ?? new Date();
    const freshnessFloor = new Date(now.getTime() - 90 * 86_400_000);
    const unitValues = input.unit ? costbookUnitDatabaseValues(input.unit) : [];

    const rows = await prisma.supplierPriceObservation.findMany({
      where: {
        orgId,
        priceStatus: "priced",
        observedAt: { gte: freshnessFloor, lte: now },
        supplierProduct: { canonicalMaterialKey: { in: lookupKeys } },
        ...(unitValues.length > 0
          ? {
              OR: [
                { normalizedUnitPrice: { not: null }, normalizedUnit: { in: unitValues } },
                { normalizedUnitPrice: null, purchaseUnit: { in: unitValues } },
                {
                  normalizedUnitPrice: null,
                  purchaseUnit: null,
                  supplierProduct: { purchaseUnit: { in: unitValues } },
                },
              ],
            }
          : {}),
      },
      include: {
        supplierProduct: {
          include: { supplier: { select: { id: true, name: true } } },
        },
      },
      orderBy: [{ observedAt: "desc" }, { id: "desc" }],
    });

    if (!allowCrossSupplier) {
      const supplierIds = new Set(rows.map((row) => row.supplierProduct.supplier.id));
      if (supplierIds.size > 1) return null;
    } else if (!input.unit) {
      const comparisonUnits = new Set(rows.flatMap((row) => {
        const normalizedPairAvailable =
          row.normalizedUnitPrice !== null && Boolean(row.normalizedUnit?.trim());
        const price = normalizedPairAvailable
          ? row.normalizedUnitPrice
          : row.effectivePrice ?? row.salePrice ?? row.regularPrice;
        if (price === null) return [];

        return [normalizeCostbookUnit(
          normalizedPairAvailable
            ? row.normalizedUnit
            : row.purchaseUnit ?? row.supplierProduct.purchaseUnit
        )];
      }));
      if (comparisonUnits.size > 1) return null;
    }

    return resolvePrice({
      tenantId: orgId,
      canonicalMaterialKey,
      unit: input.unit,
      postalCode: input.postalCode,
      now,
      candidates: rows.flatMap((row) => {
        const supplierProductText = [
          row.supplierProduct.name,
          row.supplierProduct.description ?? "",
          row.supplierProduct.packageDescription ?? "",
        ].join(" ");
        if (
          allowCrossSupplier &&
          canonicalIdentityConflictsWithProductText(canonicalMaterialKey, supplierProductText)
        ) {
          return [];
        }

        const normalizedPairAvailable = row.normalizedUnitPrice !== null && Boolean(row.normalizedUnit?.trim());
        const price = normalizedPairAvailable
          ? row.normalizedUnitPrice
          : row.effectivePrice ?? row.salePrice ?? row.regularPrice;
        if (price === null) return [];
        const unit = normalizeCostbookUnit(
          normalizedPairAvailable
            ? row.normalizedUnit
            : row.purchaseUnit ?? row.supplierProduct.purchaseUnit
        );
        return [{
          id: row.id,
          canonicalMaterialKey,
          price: Number(price),
          currency: row.currency,
          unit,
          evidenceTier: "RECENT_RETAIL_VALIDATION" as const,
          confidence: observationConfidence(row.sourceConfidence),
          observedAt: row.observedAt,
          tenantId: orgId,
          supplierId: row.supplierProduct.supplier.id,
          supplierName: row.supplierProduct.supplier.name,
          storeName: row.storeName,
          postalCode: row.postalCode,
          source: "regional_supplier_evidence",
          sourceUrl: row.sourceUrl,
          verifiedVsInferred: "observed" as const,
        }];
      }),
    });
  }
  async listHistoryPage(orgId: string, filter: CostbookPriceHistoryPageFilter = {}): Promise<CostbookPriceHistoryPage> {
    const createdAt = filter.from || filter.to
      ? { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) }
      : undefined;
    const materialQuery: CatalogQuery = {
      limit: Math.min(Math.max(filter.limit ?? 50, 1), 100),
      cursor: filter.materialCursor,
      sort: "createdAt",
      order: "desc",
      filters: { materialId: filter.materialId, from: filter.from?.toISOString(), to: filter.to?.toISOString() },
      scope: orgId,
    };
    const estimateQuery: CatalogQuery = {
      limit: Math.min(Math.max(filter.limit ?? 50, 1), 100),
      cursor: filter.estimateCursor,
      sort: "createdAt",
      order: "desc",
      filters: { estimateId: filter.estimateId, sourceType: filter.sourceType, from: filter.from?.toISOString(), to: filter.to?.toISOString() },
      scope: orgId,
    };
    const snapshotSourceFilter = filter.sourceType === "cost_item"
      ? [{ costItemId: { not: null } }]
      : filter.sourceType === "assembly"
        ? [{ assemblyId: { not: null } }]
        : [{ costItemId: { not: null } }, { assemblyId: { not: null } }];

    const [materialChanges, estimateSnapshots] = await Promise.all([
      pageCatalogRows<any>({
        query: materialQuery,
        where: { orgId, ...(filter.materialId ? { materialId: filter.materialId } : {}), ...(createdAt ? { createdAt } : {}) },
        cursorField: "createdAt",
        cursorValueType: "date",
        findMany: (args) => prisma.materialPriceAudit.findMany(args as any) as any,
        count: (args) => prisma.materialPriceAudit.count(args as any),
        getCursorValue: (row) => row.createdAt,
        getId: (row) => row.id,
        map: (row) => ({
          id: row.id,
          materialId: row.materialId,
          materialName: row.materialName,
          oldUnitCost: Number(row.oldUnitCost),
          newUnitCost: Number(row.newUnitCost),
          source: row.source,
          actorUserId: row.actorUserId,
          actorRole: row.actorRole,
          createdAt: row.createdAt.toISOString(),
        }),
      }),
      pageCatalogRows<any>({
        query: estimateQuery,
        where: {
          estimate: { orgId },
          ...(filter.estimateId ? { estimateId: filter.estimateId } : {}),
          ...(createdAt ? { createdAt } : {}),
          OR: snapshotSourceFilter,
        },
        cursorField: "createdAt",
        cursorValueType: "date",
        findMany: (args) => prisma.estimateLineItem.findMany(args as any) as any,
        count: (args) => prisma.estimateLineItem.count(args as any),
        getCursorValue: (row) => row.createdAt,
        getId: (row) => row.id,
        map: (row) => {
          const sourceId = row.costItemId ?? row.assemblyId;
          if (!sourceId) throw new Error("Estimate snapshot is missing a Costbook source");
          return {
            id: row.id,
            estimateId: row.estimateId,
            sourceType: row.costItemId ? "cost_item" as const : "assembly" as const,
            sourceId,
            description: row.description,
            quantity: Number(row.quantity),
            unitOfMeasure: row.unitOfMeasure,
            unitCost: Number(row.unitCost),
            lineCost: Number(row.lineCost),
            createdAt: row.createdAt.toISOString(),
          };
        },
      }),
    ]);

    return { materialChanges, estimateSnapshots };
  }

  async listHistory(orgId: string, filter: CostbookPriceHistoryFilter = {}): Promise<CostbookPriceHistory> {
    const take = Math.min(Math.max(filter.limit ?? 50, 1), 100);
    const createdAt = filter.from || filter.to
      ? { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) }
      : undefined;
    const snapshotSourceFilter = filter.sourceType === "cost_item"
      ? [{ costItemId: { not: null } }]
      : filter.sourceType === "assembly"
        ? [{ assemblyId: { not: null } }]
        : [{ costItemId: { not: null } }, { assemblyId: { not: null } }];

    const [materialChanges, snapshots] = await Promise.all([
      prisma.materialPriceAudit.findMany({
        where: {
          orgId,
          ...(filter.materialId ? { materialId: filter.materialId } : {}),
          ...(createdAt ? { createdAt } : {}),
        },
        orderBy: { createdAt: "desc" },
        take,
      }),
      prisma.estimateLineItem.findMany({
        where: {
          estimate: { orgId },
          ...(filter.estimateId ? { estimateId: filter.estimateId } : {}),
          ...(createdAt ? { createdAt } : {}),
          OR: snapshotSourceFilter,
        },
        orderBy: { createdAt: "desc" },
        take,
      }),
    ]);

    return {
      materialChanges: materialChanges.map((row) => ({
        id: row.id,
        materialId: row.materialId,
        materialName: row.materialName,
        oldUnitCost: Number(row.oldUnitCost),
        newUnitCost: Number(row.newUnitCost),
        source: row.source,
        actorUserId: row.actorUserId,
        actorRole: row.actorRole,
        createdAt: row.createdAt.toISOString(),
      })),
      estimateSnapshots: snapshots.flatMap((row) => {
        const sourceId = row.costItemId ?? row.assemblyId;
        if (!sourceId) return [];
        return [{
          id: row.id,
          estimateId: row.estimateId,
          sourceType: row.costItemId ? "cost_item" as const : "assembly" as const,
          sourceId,
          description: row.description,
          quantity: Number(row.quantity),
          unitOfMeasure: row.unitOfMeasure,
          unitCost: Number(row.unitCost),
          lineCost: Number(row.lineCost),
          createdAt: row.createdAt.toISOString(),
        }];
      }),
    };
  }
}

interface CanonicalPriceIdentity {
  canonicalMaterialKey: string;
  lookupKeys: string[];
  allowCrossSupplier: boolean;
}

/**
 * Resolves price lookup identity without breaking legacy single-supplier
 * callers. Cross-supplier comparison is allowed only for a governed TradeOS
 * identity. Unknown exact keys remain readable only when their evidence comes
 * from one supplier; SPF-stud-shaped keys outside the governed registry fail
 * closed rather than becoming accidental identities.
 */
function resolveCanonicalPriceIdentity(value: string): CanonicalPriceIdentity | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const supplierMapped = resolveTradeOsCanonicalMaterialKey(trimmed);
  if (supplierMapped) {
    const governed = COSTBOOK_PILOT_CANONICAL_ITEMS.some(
      (item) => item.canonicalMaterialKey === supplierMapped
    );
    if (!governed) return null;
    return {
      canonicalMaterialKey: supplierMapped,
      lookupKeys: [...new Set([
        supplierMapped,
        ...supplierCanonicalAliasesForTradeOsIdentity(supplierMapped),
      ])],
      allowCrossSupplier: true,
    };
  }

  const exactPilot = COSTBOOK_PILOT_CANONICAL_ITEMS.find(
    (item) => item.canonicalMaterialKey === trimmed
  );
  if (exactPilot) {
    return {
      canonicalMaterialKey: exactPilot.canonicalMaterialKey,
      lookupKeys: [...new Set([
        exactPilot.canonicalMaterialKey,
        ...supplierCanonicalAliasesForTradeOsIdentity(exactPilot.canonicalMaterialKey),
      ])],
      allowCrossSupplier: true,
    };
  }

  if (looksLikeSpfStudCanonicalVocabulary(trimmed)) return null;

  return {
    canonicalMaterialKey: trimmed,
    lookupKeys: [trimmed],
    allowCrossSupplier: false,
  };
}

function looksLikeSpfStudCanonicalVocabulary(value: string): boolean {
  const key = value.trim().toUpperCase().replace(/\s+/g, "");
  return (
    /^LUMBER\.SPF\.STUD\./.test(key) ||
    /^LUMBER-SPF-\d+X\d+-.+-STUD$/.test(key) ||
    /^LUMBER-SPF-STUD-\d+X\d+-.+$/.test(key) ||
    /^STUD-SPF-\d+X\d+-.+$/.test(key)
  );
}

function observationConfidence(value: string | null): PriceConfidence {
  if (value === "high") return "HIGH";
  if (value === "medium") return "MEDIUM";
  if (value === "low") return "LOW";
  return "LOW";
}


function costbookUnitDatabaseValues(value: string): string[] {
  const normalized = normalizeCostbookUnit(value);
  const aliases: Record<string, string[]> = {
    EACH: ["EACH", "EA"],
    GALLON: ["GALLON", "GAL"],
    LINEAR_FT: ["LINEAR_FT", "LF"],
    SQ_FT: ["SQ_FT", "SF"],
    BOARD_FT: ["BOARD_FT", "BF"],
  };
  return [...new Set([normalized, value.trim(), value.trim().toUpperCase(), ...(aliases[normalized] ?? [])])];
}
