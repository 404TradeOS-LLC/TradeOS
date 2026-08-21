import type { AuthContext } from "../../backend/auth/context";
import { ApiError } from "../../backend/middleware/errorHandler";
import { CostbookEquipmentRepository } from "./equipmentRepository";
import { CostbookRepository } from "./repository";
import { getCostbookPermissionSummary } from "./permissions";
import type { CatalogPage, CatalogQuery } from "../shared/catalog-query";
import type {
  CostbookCategoryDTO,
  CostbookCategoryInput,
  CostbookCategoryRecord,
  CostbookCategoryUpdateInput,
  CostbookDivisionDTO,
  CostbookDivisionInput,
  CostbookDivisionRecord,
  CostbookDivisionUpdateInput,
  CostbookEquipmentDTO,
  CostbookEquipmentInput,
  CostbookEquipmentRecord,
  CostbookEquipmentUpdateInput,
  CostbookLaborRateDTO,
  CostbookLaborRateInput,
  CostbookLaborRateRecord,
  CostbookLaborRateUpdateInput,
  CostbookMaterialDTO,
  CostbookMaterialInput,
  CostbookMaterialRecord,
  CostbookMaterialUpdateInput,
  CostbookSubcategoryDTO,
  CostbookSubcategoryInput,
  CostbookSubcategoryRecord,
  CostbookSubcategoryUpdateInput,
  CostbookWorkspaceArea,
  CostbookWorkspaceDTO,
} from "./types";

const workspaceAreas: CostbookWorkspaceArea[] = [
  {
    id: "materials",
    label: "Materials",
    description: "Existing tenant-scoped material catalog inventory.",
    status: "existing_catalog",
  },
  {
    id: "labor",
    label: "Labor",
    description: "Existing tenant-scoped labor-rate inventory.",
    status: "existing_catalog",
  },
  {
    id: "equipment",
    label: "Equipment",
    description: "Existing tenant-scoped equipment-rate inventory.",
    status: "existing_catalog",
  },
  {
    id: "assemblies",
    label: "Assemblies",
    description: "Existing tenant-scoped assembly inventory with first-class Costbook management.",
    status: "existing_catalog",
  },
  {
    id: "pricing-rules",
    label: "Pricing",
    description: "Calculation-only pricing preview using shared Estimate formulas; saved organization-wide pricing rules are not implemented.",
    status: "foundation_only",
  },
  {
    id: "price-history",
    label: "Price History",
    description: "Read model for audited material price changes and immutable Estimate pricing snapshots.",
    status: "foundation_only",
  },
];

export class CostbookService {
  constructor(
    private readonly repository = new CostbookRepository(),
    private readonly equipmentRepository = new CostbookEquipmentRepository()
  ) {}

  async getWorkspace(auth: AuthContext): Promise<CostbookWorkspaceDTO> {
    const [workspace, counts] = await Promise.all([
      this.repository.getWorkspace(auth.orgId),
      this.repository.getInventoryCounts(auth.orgId),
    ]);

    return {
      organizationId: auth.orgId,
      initialized: Boolean(workspace),
      status: workspace?.status ?? "foundation",
      permissions: getCostbookPermissionSummary(auth.role),
      counts,
      areas: workspaceAreas,
    };
  }

  async listMaterials(auth: AuthContext): Promise<CostbookMaterialDTO[]> {
    const rows = await this.repository.listMaterials(auth.orgId);
    return rows.map(toMaterialDTO);
  }

  async listMaterialsPage(auth: AuthContext, query: CatalogQuery): Promise<CatalogPage<CostbookMaterialDTO>> {
    const page = await this.repository.listMaterialsPage(auth.orgId, query);
    return { ...page, items: page.items.map(toMaterialDTO) };
  }

  async listEquipment(auth: AuthContext): Promise<CostbookEquipmentDTO[]> {
    const rows = await this.equipmentRepository.list(auth.orgId);
    return rows.map(toEquipmentDTO);
  }

  async listEquipmentPage(auth: AuthContext, query: CatalogQuery): Promise<CatalogPage<CostbookEquipmentDTO>> {
    const page = await this.equipmentRepository.listPage(auth.orgId, query);
    return { ...page, items: page.items.map(toEquipmentDTO) };
  }

  async getEquipment(auth: AuthContext, id: string): Promise<CostbookEquipmentDTO> {
    const row = await this.equipmentRepository.getById(auth.orgId, id);
    if (!row) throw new ApiError(404, `Equipment ${id} not found`);
    return toEquipmentDTO(row);
  }

  async createEquipment(auth: AuthContext, input: CostbookEquipmentInput): Promise<CostbookEquipmentDTO> {
    return toEquipmentDTO(await this.equipmentRepository.create(auth.orgId, input));
  }

  async updateEquipment(auth: AuthContext, id: string, input: CostbookEquipmentUpdateInput): Promise<CostbookEquipmentDTO> {
    const row = await this.equipmentRepository.update(auth.orgId, id, input);
    if (!row) throw new ApiError(404, `Equipment ${id} not found`);
    return toEquipmentDTO(row);
  }

  async removeEquipment(auth: AuthContext, id: string): Promise<void> {
    const removed = await this.equipmentRepository.remove(auth.orgId, id);
    if (!removed) throw new ApiError(404, `Equipment ${id} not found`);
  }

  async listLaborRates(auth: AuthContext): Promise<CostbookLaborRateDTO[]> {
    const rows = await this.repository.listLaborRates(auth.orgId);
    return rows.map(toLaborRateDTO);
  }

  async listLaborRatesPage(auth: AuthContext, query: CatalogQuery): Promise<CatalogPage<CostbookLaborRateDTO>> {
    const page = await this.repository.listLaborRatesPage(auth.orgId, query);
    return { ...page, items: page.items.map(toLaborRateDTO) };
  }

  async getLaborRate(auth: AuthContext, id: string): Promise<CostbookLaborRateDTO> {
    const row = await this.repository.getLaborRateById(auth.orgId, id);
    if (!row) throw new ApiError(404, `Labor rate ${id} not found`);
    return toLaborRateDTO(row);
  }

  async createLaborRate(auth: AuthContext, input: CostbookLaborRateInput): Promise<CostbookLaborRateDTO> {
    return toLaborRateDTO(await this.repository.createLaborRate(auth.orgId, input));
  }

  async updateLaborRate(auth: AuthContext, id: string, input: CostbookLaborRateUpdateInput): Promise<CostbookLaborRateDTO> {
    const row = await this.repository.updateLaborRate(auth.orgId, id, input);
    if (!row) throw new ApiError(404, `Labor rate ${id} not found`);
    return toLaborRateDTO(row);
  }

  async deactivateLaborRate(auth: AuthContext, id: string): Promise<void> {
    const deactivated = await this.repository.deactivateLaborRate(auth.orgId, id);
    if (!deactivated) throw new ApiError(404, `Labor rate ${id} not found`);
  }

  async getMaterial(auth: AuthContext, id: string): Promise<CostbookMaterialDTO> {
    const row = await this.repository.getMaterialById(auth.orgId, id);
    if (!row) throw new ApiError(404, `Material ${id} not found`);
    return toMaterialDTO(row);
  }

  async createMaterial(auth: AuthContext, input: CostbookMaterialInput): Promise<CostbookMaterialDTO> {
    return toMaterialDTO(await this.repository.createMaterial(auth.orgId, input));
  }

  async updateMaterial(auth: AuthContext, id: string, input: CostbookMaterialUpdateInput): Promise<CostbookMaterialDTO> {
    const row = await this.repository.updateMaterial(auth.orgId, id, input, {
      actorUserId: auth.userId,
      actorRole: auth.role,
      source: "costbook.materials",
    });

    if (!row) throw new ApiError(404, `Material ${id} not found`);
    return toMaterialDTO(row);
  }

  async listDivisions(auth: AuthContext): Promise<CostbookDivisionDTO[]> {
    const rows = await this.repository.listDivisions(auth.orgId);
    return rows.map(toDivisionDTO);
  }

  async listDivisionsPage(auth: AuthContext, query: CatalogQuery): Promise<CatalogPage<CostbookDivisionDTO>> {
    const page = await this.repository.listDivisionsPage(auth.orgId, query);
    return { ...page, items: page.items.map(toDivisionDTO) };
  }

  async getDivision(auth: AuthContext, id: string): Promise<CostbookDivisionDTO> {
    const row = await this.repository.getDivisionById(auth.orgId, id);
    if (!row) throw new ApiError(404, `Division ${id} not found`);
    return toDivisionDTO(row);
  }

  async createDivision(auth: AuthContext, input: CostbookDivisionInput): Promise<CostbookDivisionDTO> {
    return toDivisionDTO(await this.repository.createDivision(auth.orgId, input));
  }

  async updateDivision(auth: AuthContext, id: string, input: CostbookDivisionUpdateInput): Promise<CostbookDivisionDTO> {
    const row = await this.repository.updateDivision(auth.orgId, id, input);
    if (!row) throw new ApiError(404, `Division ${id} not found`);
    return toDivisionDTO(row);
  }

  async deactivateDivision(auth: AuthContext, id: string): Promise<void> {
    const deactivated = await this.repository.deactivateDivision(auth.orgId, id);
    if (!deactivated) throw new ApiError(404, `Division ${id} not found`);
  }

  async listCategories(auth: AuthContext, divisionId?: string): Promise<CostbookCategoryDTO[]> {
    const rows = await this.repository.listCategories(auth.orgId, divisionId);
    return rows.map(toCategoryDTO);
  }

  async listCategoriesPage(auth: AuthContext, query: CatalogQuery): Promise<CatalogPage<CostbookCategoryDTO>> {
    const page = await this.repository.listCategoriesPage(auth.orgId, query);
    return { ...page, items: page.items.map(toCategoryDTO) };
  }

  async getCategory(auth: AuthContext, id: string): Promise<CostbookCategoryDTO> {
    const row = await this.repository.getCategoryById(auth.orgId, id);
    if (!row) throw new ApiError(404, `Category ${id} not found`);
    return toCategoryDTO(row);
  }

  async createCategory(auth: AuthContext, input: CostbookCategoryInput): Promise<CostbookCategoryDTO> {
    return toCategoryDTO(await this.repository.createCategory(auth.orgId, input));
  }

  async updateCategory(auth: AuthContext, id: string, input: CostbookCategoryUpdateInput): Promise<CostbookCategoryDTO> {
    const row = await this.repository.updateCategory(auth.orgId, id, input);
    if (!row) throw new ApiError(404, `Category ${id} not found`);
    return toCategoryDTO(row);
  }

  async deactivateCategory(auth: AuthContext, id: string): Promise<void> {
    const deactivated = await this.repository.deactivateCategory(auth.orgId, id);
    if (!deactivated) throw new ApiError(404, `Category ${id} not found`);
  }

  async listSubcategories(auth: AuthContext, categoryId?: string): Promise<CostbookSubcategoryDTO[]> {
    const rows = await this.repository.listSubcategories(auth.orgId, categoryId);
    return rows.map(toSubcategoryDTO);
  }

  async listSubcategoriesPage(auth: AuthContext, query: CatalogQuery): Promise<CatalogPage<CostbookSubcategoryDTO>> {
    const page = await this.repository.listSubcategoriesPage(auth.orgId, query);
    return { ...page, items: page.items.map(toSubcategoryDTO) };
  }

  async getSubcategory(auth: AuthContext, id: string): Promise<CostbookSubcategoryDTO> {
    const row = await this.repository.getSubcategoryById(auth.orgId, id);
    if (!row) throw new ApiError(404, `Subcategory ${id} not found`);
    return toSubcategoryDTO(row);
  }

  async createSubcategory(auth: AuthContext, input: CostbookSubcategoryInput): Promise<CostbookSubcategoryDTO> {
    return toSubcategoryDTO(await this.repository.createSubcategory(auth.orgId, input));
  }

  async updateSubcategory(
    auth: AuthContext,
    id: string,
    input: CostbookSubcategoryUpdateInput
  ): Promise<CostbookSubcategoryDTO> {
    const row = await this.repository.updateSubcategory(auth.orgId, id, input);
    if (!row) throw new ApiError(404, `Subcategory ${id} not found`);
    return toSubcategoryDTO(row);
  }

  async deactivateSubcategory(auth: AuthContext, id: string): Promise<void> {
    const deactivated = await this.repository.deactivateSubcategory(auth.orgId, id);
    if (!deactivated) throw new ApiError(404, `Subcategory ${id} not found`);
  }
}

function toMaterialDTO(row: CostbookMaterialRecord): CostbookMaterialDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    sku: row.sku,
    name: row.name,
    unitOfMeasure: row.unitOfMeasure,
    unitCost: row.unitCost,
    wasteFactorPct: row.wasteFactorPct,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    lastPriceUpdate: row.lastPriceUpdate?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toEquipmentDTO(row: CostbookEquipmentRecord): CostbookEquipmentDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    ownershipCostPerHour: row.ownershipCostPerHour,
    operatingCostPerHour: row.operatingCostPerHour,
    dailyRate: row.dailyRate,
    hourlyCost: row.hourlyCost,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toLaborRateDTO(row: CostbookLaborRateRecord): CostbookLaborRateDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    role: row.role,
    description: row.description,
    hourlyCost: row.hourlyCost,
    billRate: row.billRate,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDivisionDTO(row: CostbookDivisionRecord): CostbookDivisionDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    code: row.code,
    name: row.name,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

function toCategoryDTO(row: CostbookCategoryRecord): CostbookCategoryDTO {
  return {
    id: row.id,
    divisionId: row.divisionId,
    organizationId: row.organizationId,
    code: row.code,
    name: row.name,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

function toSubcategoryDTO(row: CostbookSubcategoryRecord): CostbookSubcategoryDTO {
  return {
    id: row.id,
    categoryId: row.categoryId,
    organizationId: row.organizationId,
    code: row.code,
    name: row.name,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}
