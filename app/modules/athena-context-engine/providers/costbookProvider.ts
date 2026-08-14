import type { AuthContext } from "../../../backend/auth/context";
import { getRolePermissions } from "../../../domain";
import { CostbookService } from "../../costbook/service";
import type { AthenaContextProviderDefinition, AthenaContextProviderFetchResult } from "../types";

export interface AthenaCostbookContextData {
  workspace: {
    organizationId: string;
    initialized: boolean;
    status: string;
    counts: {
      categories: number;
      costItems: number;
      laborRates: number;
      materials: number;
      equipment: number;
      assemblies: number;
    };
    canRead: boolean;
    canWrite: boolean;
    canManage: boolean;
  };
  materials: Array<{
    materialId: string;
    name: string;
    unitOfMeasure: string;
    unitCost: number;
  }>;
}

const COSTBOOK_ITEM_LIMIT = 5;

export function createCostbookProvider(
  overrides: Partial<AthenaContextProviderDefinition<AthenaCostbookContextData>> = {},
  costbookService: Pick<CostbookService, "getWorkspace" | "listMaterials"> = new CostbookService()
): AthenaContextProviderDefinition<AthenaCostbookContextData> {
  return {
    id: "tradeos.athena.context.costbook",
    version: "1.0.0",
    owner: "athena-context-engine",
    name: "Costbook Context",
    priority: 68,
    section: "costbook",
    description: "Costbook workspace and sample material records from the Costbook service boundary.",
    permissions: ["costbook.read"],
    activation: "lazy_intent",
    allowedIntents: ["costbook_lookup", "estimate_review", "estimate_update"],
    freshnessTtlMs: 0,
    timeoutMs: 3_000,
    maxItems: COSTBOOK_ITEM_LIMIT + 1,
    maxBytes: 65_536,
    sensitivity: "internal",
    cacheKeyPolicy: "none",
    criticality: "optional",
    failureBehavior: "degrade",
    async provide(input): Promise<AthenaContextProviderFetchResult<AthenaCostbookContextData>> {
      const auth: AuthContext = {
        userId: input.actor.userId,
        orgId: input.orgId,
        role: input.actor.role,
        canonicalRole: input.actor.role,
        permissions: getRolePermissions(input.actor.role),
      };
      const [workspace, materials] = await Promise.all([costbookService.getWorkspace(auth), costbookService.listMaterials(auth)]);
      return {
        data: {
          workspace: {
            organizationId: workspace.organizationId,
            initialized: workspace.initialized,
            status: workspace.status,
            counts: workspace.counts,
            canRead: workspace.permissions.canRead,
            canWrite: workspace.permissions.canWrite,
            canManage: workspace.permissions.canManage,
          },
          materials: materials.slice(0, COSTBOOK_ITEM_LIMIT).map((material) => ({
            materialId: material.id,
            name: material.name,
            unitOfMeasure: material.unitOfMeasure,
            unitCost: material.unitCost,
          })),
        },
        itemCount: Math.min(materials.length, COSTBOOK_ITEM_LIMIT) + 1,
        omittedFields: ["materials.supplierName", "workspace.areas"],
      };
    },
    ...overrides,
  };
}
