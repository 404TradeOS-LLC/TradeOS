import { prisma } from "../../db/client";
import { applyOverhead, marginFromMarkup, markupFromMargin, round2, sellPrice } from "../estimate-engine/formulas";

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
