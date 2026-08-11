import type { AuthContext } from "../../backend/auth/context";
import { ApiError } from "../../backend/middleware/errorHandler";
import { CostbookRepository } from "./repository";
import { getCostbookPermissionSummary } from "./permissions";
import type {
  CostbookLaborRateDTO,
  CostbookLaborRateInput,
  CostbookLaborRateRecord,
  CostbookLaborRateUpdateInput,
  CostbookMaterialDTO,
  CostbookMaterialInput,
  CostbookMaterialRecord,
  CostbookMaterialUpdateInput,
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
    description: "Existing tenant-scoped assembly inventory.",
    status: "existing_catalog",
  },
  {
    id: "pricing-rules",
    label: "Pricing Rules",
    description: "Reserved for future Costbook pricing governance.",
    status: "future",
  },
  {
    id: "price-history",
    label: "Price History",
    description: "Reserved for future Costbook price-history workflows.",
    status: "future",
  },
];

export class CostbookService {
  constructor(private readonly repository = new CostbookRepository()) {}

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

  async listLaborRates(auth: AuthContext): Promise<CostbookLaborRateDTO[]> {
    const rows = await this.repository.listLaborRates(auth.orgId);
    return rows.map(toLaborRateDTO);
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
