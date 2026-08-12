import { basePrisma, prisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { runInDatabaseTransaction } from "../../db/requestSession";
import type {
  CostbookCategoryInput,
  CostbookCategoryRecord,
  CostbookCategoryUpdateInput,
  CostbookDivisionInput,
  CostbookDivisionRecord,
  CostbookDivisionUpdateInput,
  CostbookInventoryCounts,
  CostbookLaborRateInput,
  CostbookLaborRateRecord,
  CostbookLaborRateUpdateInput,
  CostbookMaterialInput,
  CostbookMaterialRecord,
  CostbookMaterialUpdateInput,
  CostbookSubcategoryInput,
  CostbookSubcategoryRecord,
  CostbookSubcategoryUpdateInput,
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
      prisma.category.count({ where: { division: { orgId: organizationId }, isActive: true } }),
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

  // ---- Hierarchy: Division ----

  async listDivisions(organizationId: string): Promise<CostbookDivisionRecord[]> {
    const rows = await prisma.division.findMany({
      where: { orgId: organizationId },
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    });

    return rows.map(toDivisionRecord);
  }

  async getDivisionById(organizationId: string, id: string): Promise<CostbookDivisionRecord | null> {
    const row = await prisma.division.findFirst({ where: { id, orgId: organizationId } });
    return row ? toDivisionRecord(row) : null;
  }

  async createDivision(organizationId: string, input: CostbookDivisionInput): Promise<CostbookDivisionRecord> {
    const row = await prisma.division.create({
      data: { orgId: organizationId, code: input.code, name: input.name, sortOrder: input.sortOrder ?? 0 },
    });

    return toDivisionRecord(row);
  }

  async updateDivision(
    organizationId: string,
    id: string,
    input: CostbookDivisionUpdateInput
  ): Promise<CostbookDivisionRecord | null> {
    const existing = await prisma.division.findFirst({ where: { id, orgId: organizationId } });
    if (!existing) return null;

    const row = await prisma.division.update({
      where: { id },
      data: { code: input.code, name: input.name, sortOrder: input.sortOrder, isActive: input.isActive },
    });

    return toDivisionRecord(row);
  }

  async deactivateDivision(organizationId: string, id: string): Promise<boolean> {
    const existing = await prisma.division.findFirst({ where: { id, orgId: organizationId } });
    if (!existing) return false;

    await prisma.division.update({ where: { id }, data: { isActive: false } });
    return true;
  }

  // ---- Hierarchy: Category ----

  async listCategories(organizationId: string, divisionId?: string): Promise<CostbookCategoryRecord[]> {
    const rows = await prisma.category.findMany({
      where: { division: { orgId: organizationId }, ...(divisionId ? { divisionId } : {}) },
      include: { division: { select: { orgId: true } } },
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    });

    return rows.map(toCategoryRecord);
  }

  async getCategoryById(organizationId: string, id: string): Promise<CostbookCategoryRecord | null> {
    const row = await prisma.category.findFirst({
      where: { id, division: { orgId: organizationId } },
      include: { division: { select: { orgId: true } } },
    });

    return row ? toCategoryRecord(row) : null;
  }

  async createCategory(organizationId: string, input: CostbookCategoryInput): Promise<CostbookCategoryRecord> {
    await this.assertDivisionBelongsToOrganization(organizationId, input.divisionId);

    const row = await prisma.category.create({
      data: { divisionId: input.divisionId, code: input.code, name: input.name, sortOrder: input.sortOrder ?? 0 },
      include: { division: { select: { orgId: true } } },
    });

    return toCategoryRecord(row);
  }

  async updateCategory(
    organizationId: string,
    id: string,
    input: CostbookCategoryUpdateInput
  ): Promise<CostbookCategoryRecord | null> {
    const existing = await prisma.category.findFirst({ where: { id, division: { orgId: organizationId } } });
    if (!existing) return null;

    const row = await prisma.category.update({
      where: { id },
      data: { code: input.code, name: input.name, sortOrder: input.sortOrder, isActive: input.isActive },
      include: { division: { select: { orgId: true } } },
    });

    return toCategoryRecord(row);
  }

  async deactivateCategory(organizationId: string, id: string): Promise<boolean> {
    const existing = await prisma.category.findFirst({ where: { id, division: { orgId: organizationId } } });
    if (!existing) return false;

    await prisma.category.update({ where: { id }, data: { isActive: false } });
    return true;
  }

  private async assertDivisionBelongsToOrganization(organizationId: string, divisionId: string): Promise<void> {
    const division = await prisma.division.findFirst({ where: { id: divisionId, orgId: organizationId }, select: { id: true } });
    if (!division) {
      throw new ApiError(400, "Division must belong to the authenticated organization");
    }
  }

  // ---- Hierarchy: Subcategory ----

  async listSubcategories(organizationId: string, categoryId?: string): Promise<CostbookSubcategoryRecord[]> {
    const rows = await prisma.subcategory.findMany({
      where: { category: { division: { orgId: organizationId } }, ...(categoryId ? { categoryId } : {}) },
      include: { category: { include: { division: { select: { orgId: true } } } } },
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    });

    return rows.map(toSubcategoryRecord);
  }

  async getSubcategoryById(organizationId: string, id: string): Promise<CostbookSubcategoryRecord | null> {
    const row = await prisma.subcategory.findFirst({
      where: { id, category: { division: { orgId: organizationId } } },
      include: { category: { include: { division: { select: { orgId: true } } } } },
    });

    return row ? toSubcategoryRecord(row) : null;
  }

  async createSubcategory(organizationId: string, input: CostbookSubcategoryInput): Promise<CostbookSubcategoryRecord> {
    await this.assertCategoryBelongsToOrganization(organizationId, input.categoryId);

    const row = await prisma.subcategory.create({
      data: { categoryId: input.categoryId, code: input.code, name: input.name, sortOrder: input.sortOrder ?? 0 },
      include: { category: { include: { division: { select: { orgId: true } } } } },
    });

    return toSubcategoryRecord(row);
  }

  async updateSubcategory(
    organizationId: string,
    id: string,
    input: CostbookSubcategoryUpdateInput
  ): Promise<CostbookSubcategoryRecord | null> {
    const existing = await prisma.subcategory.findFirst({
      where: { id, category: { division: { orgId: organizationId } } },
    });
    if (!existing) return null;

    const row = await prisma.subcategory.update({
      where: { id },
      data: { code: input.code, name: input.name, sortOrder: input.sortOrder, isActive: input.isActive },
      include: { category: { include: { division: { select: { orgId: true } } } } },
    });

    return toSubcategoryRecord(row);
  }

  async deactivateSubcategory(organizationId: string, id: string): Promise<boolean> {
    const existing = await prisma.subcategory.findFirst({
      where: { id, category: { division: { orgId: organizationId } } },
    });
    if (!existing) return false;

    await prisma.subcategory.update({ where: { id }, data: { isActive: false } });
    return true;
  }

  private async assertCategoryBelongsToOrganization(organizationId: string, categoryId: string): Promise<void> {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, division: { orgId: organizationId } },
      select: { id: true },
    });
    if (!category) {
      throw new ApiError(400, "Category must belong to the authenticated organization");
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

function toDivisionRecord(row: {
  id: string;
  orgId: string | null;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
}): CostbookDivisionRecord {
  if (!row.orgId) {
    throw new ApiError(500, "Costbook division is missing organization scope");
  }

  return {
    id: row.id,
    organizationId: row.orgId,
    code: row.code,
    name: row.name,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

function toCategoryRecord(row: {
  id: string;
  divisionId: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  division?: { orgId: string | null };
}): CostbookCategoryRecord {
  if (!row.division?.orgId) {
    throw new ApiError(500, "Costbook category is missing organization scope");
  }

  return {
    id: row.id,
    divisionId: row.divisionId,
    organizationId: row.division.orgId,
    code: row.code,
    name: row.name,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

function toSubcategoryRecord(row: {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  category?: { division?: { orgId: string | null } };
}): CostbookSubcategoryRecord {
  const organizationId = row.category?.division?.orgId;
  if (!organizationId) {
    throw new ApiError(500, "Costbook subcategory is missing organization scope");
  }

  return {
    id: row.id,
    categoryId: row.categoryId,
    organizationId,
    code: row.code,
    name: row.name,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}
