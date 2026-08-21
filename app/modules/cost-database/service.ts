import { prisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { pageCatalogRows, type CatalogPage, type CatalogQuery } from "../shared/catalog-query";
import { laborCost, adjustedMaterialCost, equipmentCost, round2 } from "../estimate-engine/formulas";
import {
  BulkImportCostItemRow,
  BulkImportResult,
  CostItemDTO,
  CreateCategoryInput,
  CreateCostItemInput,
  CreateDivisionInput,
  CreateSubcategoryInput,
  UnitCostBreakdown,
  UpdateCostItemInput,
} from "./types";

// Cost Database module: the Division -> Category -> Subcategory -> Cost Item
// hierarchy (Deliverable 2) plus the cost_items registry itself (Deliverable 4).
// Computes a cost item's unit cost on demand by composing whichever of
// labor/material/equipment it references, applying regional multipliers.
export class CostDatabaseService {
  // ---- Hierarchy browsing ----

  async listDivisions(orgId?: string) {
    return prisma.division.findMany({
      where: orgId ? { orgId } : undefined,
      orderBy: { sortOrder: "asc" },
      include: { categories: { orderBy: { sortOrder: "asc" } } },
    });
  }

  async createDivision(input: CreateDivisionInput) {
    return prisma.division.create({
      data: { orgId: input.orgId, code: input.code, name: input.name, sortOrder: input.sortOrder ?? 0 },
    });
  }

  async createCategory(input: CreateCategoryInput) {
    return prisma.category.create({
      data: { divisionId: input.divisionId, code: input.code, name: input.name, sortOrder: input.sortOrder ?? 0 },
    });
  }

  async createSubcategory(input: CreateSubcategoryInput) {
    return prisma.subcategory.create({
      data: { categoryId: input.categoryId, code: input.code, name: input.name, sortOrder: input.sortOrder ?? 0 },
    });
  }

  async listSubcategoryCostItems(subcategoryId: string, orgId: string): Promise<CostItemDTO[]> {
    await this.assertSubcategoryBelongsToOrganization(orgId, subcategoryId);
    const rows = await prisma.costItem.findMany({ where: { subcategoryId, orgId }, orderBy: { code: "asc" } });
    return rows.map(toDTO);
  }

  // ---- Cost item CRUD ----

  async getById(id: string, orgId?: string): Promise<CostItemDTO> {
    const row = await prisma.costItem.findFirst({ where: { id, orgId } });
    if (!row) throw new ApiError(404, `CostItem ${id} not found`);
    return toDTO(row);
  }

  async search(query: string, orgId?: string): Promise<CostItemDTO[]> {
    const rows = await prisma.costItem.findMany({
      where: {
        orgId,
        isActive: true,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { code: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: { name: "asc" },
      take: 50,
    });
    return rows.map(toDTO);
  }

  async listPage(query: CatalogQuery, orgId: string): Promise<CatalogPage<CostItemDTO>> {
    query = { ...query, scope: orgId };
    const componentType = query.filters.componentType;
    const componentFilter = componentType === "labor" ? { laborRateId: { not: null } }
      : componentType === "material" ? { materialId: { not: null } }
        : componentType === "equipment" ? { equipmentId: { not: null } }
          : componentType === "subcontractor" ? { subcontractorId: { not: null } }
            : componentType === "none" ? { laborRateId: null, materialId: null, equipmentId: null, subcontractorId: null }
              : {};
    const where = {
      orgId,
      ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { code: { contains: query.q, mode: "insensitive" } }, { notes: { contains: query.q, mode: "insensitive" } }] } : {}),
      ...(query.filters.active !== undefined ? { isActive: query.filters.active } : {}),
      ...(query.filters.subcategoryId ? { subcategoryId: query.filters.subcategoryId } : {}),
      ...componentFilter,
    };
    const field = catalogField(query.sort, { code: "code", name: "name", createdAt: "createdAt", updatedAt: "updatedAt" });
    return pageCatalogRows<any>({
      query,
      where,
      cursorField: field,
      cursorValueType: field === "createdAt" || field === "updatedAt" ? "date" : "string",
      findMany: (args) => prisma.costItem.findMany(args as any) as any,
      count: (args) => prisma.costItem.count(args as any),
      getCursorValue: (row) => row[field],
      getId: (row) => row.id,
      map: (row) => toDTO(row),
    }) as Promise<CatalogPage<CostItemDTO>>;
  }

  async create(input: CreateCostItemInput): Promise<CostItemDTO> {
    await this.assertCostItemReferencesBelongToOrganization(input.orgId, input);

    const row = await prisma.costItem.create({
      data: {
        orgId: input.orgId,
        subcategoryId: input.subcategoryId,
        code: input.code,
        name: input.name,
        unitOfMeasure: input.unitOfMeasure,
        productionRate: input.productionRate,
        laborRateId: input.laborRateId,
        materialId: input.materialId,
        equipmentId: input.equipmentId,
        subcontractorId: input.subcontractorId,
        notes: input.notes,
      },
    });
    return toDTO(row);
  }

  async update(id: string, input: UpdateCostItemInput, orgId: string): Promise<CostItemDTO> {
    await this.assertExists(id, orgId);
    await this.assertCostItemReferencesBelongToOrganization(orgId, input);

    const row = await prisma.costItem.update({
      where: { id },
      data: {
        code: input.code,
        name: input.name,
        unitOfMeasure: input.unitOfMeasure,
        productionRate: input.productionRate,
        laborRateId: input.laborRateId,
        materialId: input.materialId,
        equipmentId: input.equipmentId,
        subcontractorId: input.subcontractorId,
        notes: input.notes,
        isActive: input.isActive,
      },
    });
    return toDTO(row);
  }

  async delete(id: string, orgId?: string): Promise<void> {
    await this.assertExists(id, orgId);
    // Soft-delete by deactivating rather than hard-deleting, since historical
    // estimate_line_items may still reference this cost item.
    await prisma.costItem.update({ where: { id }, data: { isActive: false } });
  }

  /**
   * Computes the per-unit cost of a cost item for a given quantity, by summing
   * whichever of labor/material/equipment it references. Mirrors the "Full
   * Roll-Up" formula in Deliverable 3, scoped to a single cost item.
   */
  async getUnitCost(costItemId: string, quantity = 1, regionId?: string, orgId?: string): Promise<UnitCostBreakdown> {
    const item = await prisma.costItem.findFirst({
      where: { id: costItemId, orgId },
      include: { laborRate: { include: { region: true } }, material: true, equipment: true },
    });
    if (!item) throw new ApiError(404, `CostItem ${costItemId} not found`);

    const region = regionId ? await prisma.region.findFirst({ where: { id: regionId, orgId } }) : null;
    if (regionId && !region) throw new ApiError(404, `Region ${regionId} not found`);
    const regionLaborIndex = region ? Number(region.laborIndex) : item.laborRate?.region ? Number(item.laborRate.region.laborIndex) : 1;
    const regionMaterialIndex = region ? Number(region.materialIndex) : 1;

    let laborCostPerUnit = 0;
    if (item.laborRate && item.laborRate.active !== false && item.productionRate) {
      const total = laborCost({
        quantity,
        productionRate: Number(item.productionRate),
        baseHourlyRate: Number(item.laborRate.baseHourlyRate),
        burdenPct: Number(item.laborRate.burdenPct),
        regionLaborIndex,
      });
      laborCostPerUnit = total / quantity;
    }

    let materialCostPerUnit = 0;
    if (item.material) {
      const total = adjustedMaterialCost({
        quantity,
        unitCost: Number(item.material.unitCost),
        wasteFactorPct: Number(item.material.wasteFactorPct),
        regionMaterialIndex,
      });
      materialCostPerUnit = total / quantity;
    }

    let equipmentCostPerUnit = 0;
    if (item.equipment && item.productionRate) {
      const hours = quantity / Number(item.productionRate);
      const total = equipmentCost({
        hours,
        ownershipCostPerHour: Number(item.equipment.ownershipCostPerHour),
        operatingCostPerHour: Number(item.equipment.operatingCostPerHour),
        dailyRate: item.equipment.dailyRate != null ? Number(item.equipment.dailyRate) : undefined,
      });
      equipmentCostPerUnit = total / quantity;
    }

    return {
      laborCostPerUnit: round2(laborCostPerUnit),
      materialCostPerUnit: round2(materialCostPerUnit),
      equipmentCostPerUnit: round2(equipmentCostPerUnit),
      totalUnitCost: round2(laborCostPerUnit + materialCostPerUnit + equipmentCostPerUnit),
    };
  }

  /** Bulk import/update cost items from a parsed CSV/Excel row set. */
  async bulkImport(orgId: string, rows: BulkImportCostItemRow[]): Promise<BulkImportResult> {
    const result: BulkImportResult = { created: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.subcategoryId || !row.code || !row.name || !row.unitOfMeasure) {
          throw new Error("subcategoryId, code, name, and unitOfMeasure are required");
        }
        await this.create({ ...row, orgId });
        result.created += 1;
      } catch (err) {
        result.errors.push({ row: i, message: err instanceof Error ? err.message : "Unknown error" });
      }
    }
    return result;
  }

  private async assertExists(id: string, orgId?: string): Promise<void> {
    const exists = await prisma.costItem.findFirst({ where: { id, orgId } });
    if (!exists) throw new ApiError(404, `CostItem ${id} not found`);
  }

  private async assertCostItemReferencesBelongToOrganization(
    orgId: string,
    input: Pick<CreateCostItemInput, "subcategoryId" | "laborRateId" | "materialId" | "equipmentId" | "subcontractorId"> | UpdateCostItemInput
  ): Promise<void> {
    if ("subcategoryId" in input && input.subcategoryId) {
      await this.assertSubcategoryBelongsToOrganization(orgId, input.subcategoryId);
    }

    const checks: Array<Promise<unknown>> = [];
    if (input.laborRateId) checks.push(prisma.laborRate.findFirst({ where: { id: input.laborRateId, orgId }, select: { id: true } }));
    if (input.materialId) checks.push(prisma.material.findFirst({ where: { id: input.materialId, orgId }, select: { id: true } }));
    if (input.equipmentId) checks.push(prisma.equipment.findFirst({ where: { id: input.equipmentId, orgId }, select: { id: true } }));
    if (input.subcontractorId) checks.push(prisma.subcontractor.findFirst({ where: { id: input.subcontractorId, orgId }, select: { id: true } }));

    const results = await Promise.all(checks);
    if (results.some((result) => !result)) {
      throw new ApiError(400, "Cost item references must belong to the authenticated organization");
    }
  }

  private async assertSubcategoryBelongsToOrganization(orgId: string, subcategoryId: string): Promise<void> {
    const subcategory = await prisma.subcategory.findFirst({
      where: { id: subcategoryId, category: { division: { orgId } } },
      select: { id: true },
    });
    if (!subcategory) throw new ApiError(400, "Subcategory must belong to the authenticated organization");
  }
}

function toDTO(row: {
  id: string;
  orgId: string | null;
  subcategoryId: string;
  code: string;
  name: string;
  unitOfMeasure: string;
  productionRate: unknown;
  laborRateId: string | null;
  materialId: string | null;
  equipmentId: string | null;
  subcontractorId: string | null;
  isActive: boolean;
}): CostItemDTO {
  return {
    id: row.id,
    orgId: row.orgId,
    subcategoryId: row.subcategoryId,
    code: row.code,
    name: row.name,
    unitOfMeasure: row.unitOfMeasure,
    productionRate: row.productionRate != null ? Number(row.productionRate) : null,
    laborRateId: row.laborRateId,
    materialId: row.materialId,
    equipmentId: row.equipmentId,
    subcontractorId: row.subcontractorId,
    isActive: row.isActive,
  };
}

function catalogField(sort: string, allowed: Record<string, string>): string {
  const field = allowed[sort];
  if (!field) throw new ApiError(400, `Unsupported catalog sort field: ${sort}`);
  return field;
}
