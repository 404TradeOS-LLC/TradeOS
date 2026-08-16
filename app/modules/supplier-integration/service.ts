import { prisma, basePrisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { AuthContext } from "../../backend/auth/context";
import { runInDatabaseTransaction } from "../../db/requestSession";
import { fetchConfiguredSupplierFeed } from "./feed";
import {
  EnqueuePriceUpdateInput,
  ListQueueFilters,
  SupplierFeedFetcher,
  SupplierPriceUpdateDTO,
  SyncFromFeedInput,
  SyncFromFeedResult,
} from "./types";

// Supplier Integrations module: supplier-fed prices are proposals, never direct
// autonomous writes. The default fetcher is operator-configured and remains a
// no-op when no endpoint mapping is configured. Approval is still required
// before a Material price changes.
export class SupplierIntegrationService {
  constructor(private readonly fetchFeed: SupplierFeedFetcher = fetchConfiguredSupplierFeed) {}

  async listQueue(orgId: string, filters: ListQueueFilters = {}): Promise<SupplierPriceUpdateDTO[]> {
    const rows = await prisma.supplierPriceUpdate.findMany({
      where: {
        orgId,
        status: filters.status,
        supplierId: filters.supplierId,
        materialId: filters.materialId,
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDTO);
  }

  async enqueue(input: EnqueuePriceUpdateInput): Promise<SupplierPriceUpdateDTO> {
    const material = await prisma.material.findFirst({ where: { id: input.materialId, orgId: input.orgId } });
    if (!material) throw new ApiError(404, `Material ${input.materialId} not found`);
    const supplier = await prisma.supplier.findFirst({ where: { id: input.supplierId, orgId: input.orgId } });
    if (!supplier) throw new ApiError(404, `Supplier ${input.supplierId} not found`);

    const row = await prisma.supplierPriceUpdate.create({
      data: {
        orgId: input.orgId,
        supplierId: input.supplierId,
        materialId: input.materialId,
        currentUnitCost: material.unitCost,
        proposedUnitCost: input.proposedUnitCost,
        source: input.source ?? "supplier-feed",
        requestedByJob: input.requestedByJob,
      },
    });
    return toDTO(row);
  }

  async approve(id: string, orgId: string, actor: AuthContext): Promise<SupplierPriceUpdateDTO> {
    return runInDatabaseTransaction(basePrisma, async (transaction) => {
      const queued = await transaction.supplierPriceUpdate.findFirst({ where: { id, orgId } });
      if (!queued) throw new ApiError(404, `Supplier price update ${id} not found`);
      if (queued.status !== "pending") throw new ApiError(409, `Supplier price update ${id} is already ${queued.status}`);

      const material = await transaction.material.findFirst({ where: { id: queued.materialId, orgId } });
      if (!material) throw new ApiError(404, `Material ${queued.materialId} not found`);

      await transaction.material.update({
        where: { id: material.id },
        data: { unitCost: queued.proposedUnitCost, lastPriceUpdate: new Date() },
      });
      await transaction.materialPriceAudit.create({
        data: {
          orgId,
          materialId: material.id,
          materialName: material.name,
          oldUnitCost: material.unitCost,
          newUnitCost: queued.proposedUnitCost,
          source: queued.source,
          actorUserId: actor.userId,
          actorRole: actor.role,
        },
      });
      const reviewed = await transaction.supplierPriceUpdate.update({
        where: { id },
        data: { status: "approved", reviewedByUserId: actor.userId, reviewedAt: new Date() },
      });
      return toDTO(reviewed);
    });
  }

  async reject(id: string, orgId: string, actor: AuthContext): Promise<SupplierPriceUpdateDTO> {
    return runInDatabaseTransaction(basePrisma, async (transaction) => {
      const queued = await transaction.supplierPriceUpdate.findFirst({ where: { id, orgId } });
      if (!queued) throw new ApiError(404, `Supplier price update ${id} not found`);
      if (queued.status !== "pending") throw new ApiError(409, `Supplier price update ${id} is already ${queued.status}`);

      const reviewed = await transaction.supplierPriceUpdate.update({
        where: { id },
        data: { status: "rejected", reviewedByUserId: actor.userId, reviewedAt: new Date() },
      });
      return toDTO(reviewed);
    });
  }

  async syncFromFeed(input: SyncFromFeedInput): Promise<SyncFromFeedResult> {
    const supplier = await prisma.supplier.findFirst({
      where: { id: input.supplierId, orgId: input.orgId },
      select: { id: true },
    });
    if (!supplier) throw new ApiError(404, `Supplier ${input.supplierId} not found`);

    const quotes = await this.fetchFeed(input.supplierId, input.orgId);
    if (quotes.length === 0) return { proposed: 0, skipped: 0 };

    return runInDatabaseTransaction(basePrisma, async (transaction) => {
      const uniqueQuotes = new Map<string, number>();
      let skipped = 0;
      for (const quote of quotes) {
        if (uniqueQuotes.has(quote.materialId)) {
          skipped += 1;
          continue;
        }
        uniqueQuotes.set(quote.materialId, quote.proposedUnitCost);
      }

      const materialIds = [...uniqueQuotes.keys()];
      const [materials, pending] = await Promise.all([
        transaction.material.findMany({
          where: { orgId: input.orgId, id: { in: materialIds } },
          select: { id: true, unitCost: true },
        }),
        transaction.supplierPriceUpdate.findMany({
          where: {
            orgId: input.orgId,
            supplierId: input.supplierId,
            status: "pending",
            materialId: { in: materialIds },
          },
          select: { materialId: true },
        }),
      ]);

      const materialsById = new Map(materials.map((material) => [material.id, material]));
      const pendingMaterialIds = new Set(pending.map((row) => row.materialId));
      const proposals = [];

      for (const [materialId, proposedUnitCost] of uniqueQuotes) {
        const material = materialsById.get(materialId);
        if (!material || Number(material.unitCost) === proposedUnitCost || pendingMaterialIds.has(materialId)) {
          skipped += 1;
          continue;
        }

        proposals.push({
          orgId: input.orgId,
          supplierId: input.supplierId,
          materialId,
          currentUnitCost: material.unitCost,
          proposedUnitCost,
          source: "supplier-feed",
          requestedByJob: input.requestedByJob,
        });
      }

      if (proposals.length > 0) {
        await transaction.supplierPriceUpdate.createMany({ data: proposals });
      }

      return { proposed: proposals.length, skipped };
    });
  }
}

function toDTO(row: {
  id: string;
  orgId: string;
  supplierId: string;
  materialId: string;
  currentUnitCost: unknown;
  proposedUnitCost: unknown;
  status: string;
  source: string;
  requestedByJob: string | null;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}): SupplierPriceUpdateDTO {
  return {
    id: row.id,
    orgId: row.orgId,
    supplierId: row.supplierId,
    materialId: row.materialId,
    currentUnitCost: Number(row.currentUnitCost),
    proposedUnitCost: Number(row.proposedUnitCost),
    status: row.status as SupplierPriceUpdateDTO["status"],
    source: row.source,
    requestedByJob: row.requestedByJob,
    reviewedByUserId: row.reviewedByUserId,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
  };
}
