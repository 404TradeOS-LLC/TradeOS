import { prisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { adjustedMaterialCost } from "../estimate-engine/formulas";
import { AuthContext } from "../../backend/auth/context";
import { basePrisma } from "../../db/client";
import { runInDatabaseTransaction } from "../../db/requestSession";
import {
  BulkImportMaterialRow,
  BulkImportResult,
  CalculateMaterialCostInput,
  CalculateMaterialCostOutput,
  CreateMaterialInput,
  MaterialDTO,
  UpdateMaterialInput,
} from "./types";

// Material Database module: materials inventory, units of measure, supplier
// relationships, current prices, waste factors, and update history
// (Deliverable 4 — materials and suppliers tables).
export class MaterialDatabaseService {
  async list(orgId?: string): Promise<MaterialDTO[]> {
    const rows = await prisma.material.findMany({
      where: orgId ? { orgId } : undefined,
      orderBy: { name: "asc" },
    });
    return rows.map(toDTO);
  }

  async getById(id: string, orgId?: string): Promise<MaterialDTO> {
    const row = await prisma.material.findFirst({ where: { id, orgId } });
    if (!row) throw new ApiError(404, `Material ${id} not found`);
    return toDTO(row);
  }

  async create(input: CreateMaterialInput): Promise<MaterialDTO> {
    const row = await prisma.material.create({
      data: {
        orgId: input.orgId,
        sku: input.sku,
        name: input.name,
        unitOfMeasure: input.unitOfMeasure,
        unitCost: input.unitCost,
        wasteFactorPct: input.wasteFactorPct ?? 0,
        supplierId: input.supplierId,
        lastPriceUpdate: new Date(),
      },
    });
    return toDTO(row);
  }

  async update(
    id: string,
    input: UpdateMaterialInput,
    orgId?: string,
    audit?: { actor: AuthContext; source?: string }
  ): Promise<MaterialDTO> {
    return runInDatabaseTransaction(basePrisma, async (transaction) => {
      const existing = await transaction.material.findFirst({ where: { id, orgId } });
      if (!existing) throw new ApiError(404, `Material ${id} not found`);

      const priceChanged = input.unitCost !== undefined && Number(existing.unitCost) !== input.unitCost;
      const row = await transaction.material.update({
        where: { id },
        data: {
          sku: input.sku,
          name: input.name,
          unitOfMeasure: input.unitOfMeasure,
          unitCost: input.unitCost,
          wasteFactorPct: input.wasteFactorPct,
          supplierId: input.supplierId,
          ...(priceChanged ? { lastPriceUpdate: new Date() } : {}),
        },
      });

      if (priceChanged && audit && existing.orgId) {
        await transaction.materialPriceAudit.create({
          data: {
            orgId: existing.orgId,
            materialId: existing.id,
            materialName: row.name,
            oldUnitCost: existing.unitCost,
            newUnitCost: row.unitCost,
            source: audit.source ?? "manual",
            actorUserId: audit.actor.userId,
            actorRole: audit.actor.role,
          },
        });
      }

      return toDTO(row);
    });
  }

  async delete(id: string, orgId?: string): Promise<void> {
    await this.assertExists(id, orgId);
    await prisma.material.delete({ where: { id } });
  }

  /** Calculates the adjusted material cost (quantity × unit cost × (1 + waste factor%)). */
  async calculateMaterialCost(input: CalculateMaterialCostInput, orgId?: string): Promise<CalculateMaterialCostOutput> {
    const material = await prisma.material.findFirst({ where: { id: input.materialId, orgId } });
    if (!material) throw new ApiError(404, `Material ${input.materialId} not found`);

    const baseCost = input.quantity * Number(material.unitCost);
    const adjustedCost = adjustedMaterialCost({
      quantity: input.quantity,
      unitCost: Number(material.unitCost),
      wasteFactorPct: Number(material.wasteFactorPct),
    });
    return { baseCost, adjustedCost };
  }

  /** Bulk import/update materials from a parsed CSV/Excel row set. Validates row-by-row; partial success is allowed. */
  async bulkImport(orgId: string, rows: BulkImportMaterialRow[]): Promise<BulkImportResult> {
    const result: BulkImportResult = { created: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.name || !row.unitOfMeasure || row.unitCost == null) {
          throw new Error("name, unitOfMeasure, and unitCost are required");
        }
        await this.create({ orgId, ...row });
        result.created += 1;
      } catch (err) {
        result.errors.push({ row: i, message: err instanceof Error ? err.message : "Unknown error" });
      }
    }
    return result;
  }

  /** Returns materials whose pricing hasn't been reviewed in `staleSinceDays`, to support the monthly/quarterly pricing review cadence. */
  async findStalePrices(staleSinceDays: number, orgId?: string): Promise<MaterialDTO[]> {
    const cutoff = new Date(Date.now() - staleSinceDays * 24 * 60 * 60 * 1000);
    const rows = await prisma.material.findMany({
      where: {
        orgId,
        OR: [{ lastPriceUpdate: null }, { lastPriceUpdate: { lt: cutoff } }],
      },
      orderBy: { lastPriceUpdate: "asc" },
    });
    return rows.map(toDTO);
  }

  private async assertExists(id: string, orgId?: string): Promise<void> {
    const exists = await prisma.material.findFirst({ where: { id, orgId } });
    if (!exists) throw new ApiError(404, `Material ${id} not found`);
  }
}

function toDTO(row: {
  id: string;
  orgId: string | null;
  sku: string | null;
  name: string;
  unitOfMeasure: string;
  unitCost: unknown;
  wasteFactorPct: unknown;
  supplierId: string | null;
  lastPriceUpdate: Date | null;
}): MaterialDTO {
  return {
    id: row.id,
    orgId: row.orgId,
    sku: row.sku,
    name: row.name,
    unitOfMeasure: row.unitOfMeasure,
    unitCost: Number(row.unitCost),
    wasteFactorPct: Number(row.wasteFactorPct),
    supplierId: row.supplierId,
    lastPriceUpdate: row.lastPriceUpdate,
  };
}
