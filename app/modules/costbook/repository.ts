import { basePrisma, prisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { runInDatabaseTransaction } from "../../db/requestSession";
import type {
  CostbookInventoryCounts,
  CostbookLaborRateInput,
  CostbookLaborRateRecord,
  CostbookLaborRateUpdateInput,
  CostbookMaterialInput,
  CostbookMaterialRecord,
  CostbookMaterialUpdateInput,
  CostbookWorkspaceRecord,
} from "./types";

export class CostbookRepository {
  async getWorkspace(organizationId: string): Promise<CostbookWorkspaceRecord | null> {
    const row = await prisma.costbookWorkspace.findUnique({
      where: { organizationId },
    });

    return row
      ? {
          id: row.id,
          organizationId: row.organizationId,
          status: row.status as CostbookWorkspaceRecord["status"],
          setupState: toRecord(row.setupState),
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }
      : null;
  }

  async getInventoryCounts(organizationId: string): Promise<CostbookInventoryCounts> {
    const [categories, costItems, laborRates, materials, equipment, assemblies] = await Promise.all([
      prisma.category.count({ where: { division: { orgId: organizationId } } }),
      prisma.costItem.count({ where: { orgId: organizationId, isActive: true } }),
      prisma.laborRate.count({ where: { orgId: organizationId, active: true } }),
      prisma.material.count({ where: { orgId: organizationId } }),
      prisma.equipment.count({ where: { orgId: organizationId } }),
      prisma.assembly.count({ where: { orgId: organizationId, isActive: true } }),
    ]);

    return { categories, costItems, laborRates, materials, equipment, assemblies };
  }

  async listLaborRates(organizationId: string): Promise<CostbookLaborRateRecord[]> {
    const rows = await prisma.laborRate.findMany({
      where: { orgId: organizationId },
      orderBy: [{ active: "desc" }, { role: "asc" }, { createdAt: "asc" }],
    });

    return rows.map(toLaborRateRecord);
  }

  async getLaborRateById(organizationId: string, id: string): Promise<CostbookLaborRateRecord | null> {
    const row = await prisma.laborRate.findFirst({
      where: { id, orgId: organizationId },
    });

    return row ? toLaborRateRecord(row) : null;
  }

  async createLaborRate(organizationId: string, input: CostbookLaborRateInput): Promise<CostbookLaborRateRecord> {
    const row = await prisma.laborRate.create({
      data: {
        orgId: organizationId,
        role: input.role,
        description: normalizeOptionalString(input.description),
        hourlyCost: input.hourlyCost,
        billRate: input.billRate,
        active: input.active ?? true,
        trade: input.role,
        baseHourlyRate: input.hourlyCost,
        burdenPct: 0,
      },
    });

    return toLaborRateRecord(row);
  }

  async updateLaborRate(
    organizationId: string,
    id: string,
    input: CostbookLaborRateUpdateInput
  ): Promise<CostbookLaborRateRecord | null> {
    const existing = await prisma.laborRate.findFirst({ where: { id, orgId: organizationId } });
    if (!existing) return null;

    const nextRole = input.role ?? existing.role;
    const nextHourlyCost = input.hourlyCost ?? Number(existing.hourlyCost);

    const row = await prisma.laborRate.update({
      where: { id },
      data: {
        role: input.role,
        description: input.description === undefined ? undefined : normalizeOptionalString(input.description),
        hourlyCost: input.hourlyCost,
        billRate: input.billRate,
        active: input.active,
        trade: nextRole,
        baseHourlyRate: nextHourlyCost,
      },
    });

    return toLaborRateRecord(row);
  }

  async deactivateLaborRate(organizationId: string, id: string): Promise<boolean> {
    const existing = await prisma.laborRate.findFirst({ where: { id, orgId: organizationId } });
    if (!existing) return false;

    await prisma.laborRate.update({
      where: { id },
      data: { active: false },
    });

    return true;
  }

  async listMaterials(organizationId: string): Promise<CostbookMaterialRecord[]> {
    const rows = await prisma.material.findMany({
      where: { orgId: organizationId },
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: [{ name: "asc" }, { sku: "asc" }],
    });

    return rows.map(toMaterialRecord);
  }

  async getMaterialById(organizationId: string, id: string): Promise<CostbookMaterialRecord | null> {
    const row = await prisma.material.findFirst({
      where: { id, orgId: organizationId },
      include: { supplier: { select: { id: true, name: true } } },
    });

    return row ? toMaterialRecord(row) : null;
  }

  async createMaterial(organizationId: string, input: CostbookMaterialInput): Promise<CostbookMaterialRecord> {
    await this.assertSupplierBelongsToOrganization(organizationId, input.supplierId);

    const row = await prisma.material.create({
      data: {
        orgId: organizationId,
        sku: normalizeOptionalString(input.sku),
        name: input.name,
        unitOfMeasure: input.unitOfMeasure,
        unitCost: input.unitCost,
        wasteFactorPct: input.wasteFactorPct ?? 0,
        supplierId: normalizeOptionalString(input.supplierId),
        lastPriceUpdate: new Date(),
      },
      include: { supplier: { select: { id: true, name: true } } },
    });

    return toMaterialRecord(row);
  }

  async updateMaterial(
    organizationId: string,
    id: string,
    input: CostbookMaterialUpdateInput,
    audit: { actorUserId: string; actorRole: string; source: string }
  ): Promise<CostbookMaterialRecord | null> {
    await this.assertSupplierBelongsToOrganization(organizationId, input.supplierId);

    return runInDatabaseTransaction(basePrisma, async (transaction) => {
      const existing = await transaction.material.findFirst({ where: { id, orgId: organizationId } });
      if (!existing) return null;

      const priceChanged = input.unitCost !== undefined && Number(existing.unitCost) !== input.unitCost;
      const row = await transaction.material.update({
        where: { id },
        data: {
          sku: input.sku === undefined ? undefined : normalizeOptionalString(input.sku),
          name: input.name,
          unitOfMeasure: input.unitOfMeasure,
          unitCost: input.unitCost,
          wasteFactorPct: input.wasteFactorPct,
          supplierId: input.supplierId === undefined ? undefined : normalizeOptionalString(input.supplierId),
          ...(priceChanged ? { lastPriceUpdate: new Date() } : {}),
        },
        include: { supplier: { select: { id: true, name: true } } },
      });

      if (priceChanged && existing.orgId) {
        await transaction.materialPriceAudit.create({
          data: {
            orgId: existing.orgId,
            materialId: existing.id,
            materialName: row.name,
            oldUnitCost: existing.unitCost,
            newUnitCost: row.unitCost,
            source: audit.source,
            actorUserId: audit.actorUserId,
            actorRole: audit.actorRole,
          },
        });
      }

      return toMaterialRecord(row);
    });
  }

  private async assertSupplierBelongsToOrganization(organizationId: string, supplierId?: string | null): Promise<void> {
    const normalizedSupplierId = normalizeOptionalString(supplierId);
    if (!normalizedSupplierId) return;

    const supplier = await prisma.supplier.findFirst({
      where: { id: normalizedSupplierId, orgId: organizationId },
      select: { id: true },
    });

    if (!supplier) {
      throw new ApiError(400, "Supplier must belong to the authenticated organization");
    }
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeOptionalString(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toMaterialRecord(row: {
  id: string;
  orgId: string | null;
  sku: string | null;
  name: string;
  unitOfMeasure: string;
  unitCost: unknown;
  wasteFactorPct: unknown;
  supplierId: string | null;
  supplier?: { id: string; name: string } | null;
  lastPriceUpdate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): CostbookMaterialRecord {
  if (!row.orgId) {
    throw new ApiError(500, "Costbook material is missing organization scope");
  }

  return {
    id: row.id,
    organizationId: row.orgId,
    sku: row.sku,
    name: row.name,
    unitOfMeasure: row.unitOfMeasure,
    unitCost: Number(row.unitCost),
    wasteFactorPct: Number(row.wasteFactorPct),
    supplierId: row.supplierId,
    supplierName: row.supplier?.name ?? null,
    lastPriceUpdate: row.lastPriceUpdate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toLaborRateRecord(row: {
  id: string;
  orgId: string;
  role: string;
  description: string | null;
  hourlyCost: unknown;
  billRate: unknown;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): CostbookLaborRateRecord {
  return {
    id: row.id,
    organizationId: row.orgId,
    role: row.role,
    description: row.description,
    hourlyCost: Number(row.hourlyCost),
    billRate: Number(row.billRate),
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
