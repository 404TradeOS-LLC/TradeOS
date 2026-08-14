import { EstimateEngineService } from "../../estimate-engine/service";
import type { AthenaContextProviderDefinition, AthenaContextProviderFetchResult } from "../types";

export interface AthenaEstimateContextRecord {
  estimateId: string;
  projectId: string;
  version: number;
  status: string;
  subtotalCost: number;
  totalPrice: number;
  lineItemCount?: number;
}

export interface AthenaEstimateContextData {
  estimates: AthenaEstimateContextRecord[];
  total: number;
}

const ESTIMATE_PAGE_SIZE = 10;

export function createEstimateProvider(
  overrides: Partial<AthenaContextProviderDefinition<AthenaEstimateContextData>> = {},
  estimateService: Pick<EstimateEngineService, "getById" | "listByProject"> = new EstimateEngineService()
): AthenaContextProviderDefinition<AthenaEstimateContextData> {
  return {
    id: "tradeos.athena.context.estimates",
    version: "1.0.0",
    owner: "athena-context-engine",
    name: "Estimate Context",
    priority: 72,
    section: "estimates",
    description: "Estimate summary and pricing state from the Estimate Engine service boundary.",
    permissions: ["estimates.read"],
    activation: "lazy_intent",
    allowedIntents: ["estimate_review", "estimate_update", "costbook_lookup"],
    freshnessTtlMs: 0,
    timeoutMs: 3_000,
    maxItems: ESTIMATE_PAGE_SIZE,
    maxBytes: 65_536,
    sensitivity: "internal",
    cacheKeyPolicy: "none",
    criticality: "optional",
    failureBehavior: "degrade",
    async provide(input): Promise<AthenaContextProviderFetchResult<AthenaEstimateContextData>> {
      if (input.selectedScope.estimateId) {
        const estimate = await estimateService.getById(input.selectedScope.estimateId, input.orgId);
        return {
          data: {
            estimates: [
              {
                estimateId: estimate.id,
                projectId: estimate.projectId,
                version: estimate.version,
                status: estimate.status,
                subtotalCost: estimate.subtotalCost,
                totalPrice: estimate.totalPrice,
                lineItemCount: estimate.lineItems.length,
              },
            ],
            total: 1,
          },
          itemCount: 1,
          omittedFields: ["lineItems.description"],
        };
      }

      if (input.selectedScope.projectId) {
        const estimates = await estimateService.listByProject(input.selectedScope.projectId, input.orgId);
        const limitedEstimates = estimates.slice(0, ESTIMATE_PAGE_SIZE);
        return {
          data: {
            estimates: limitedEstimates.map((estimate) => ({
              estimateId: estimate.id,
              projectId: estimate.projectId,
              version: estimate.version,
              status: estimate.status,
              subtotalCost: estimate.subtotalCost,
              totalPrice: estimate.totalPrice,
            })),
            total: limitedEstimates.length,
          },
          itemCount: limitedEstimates.length,
          omittedFields: ["lineItems"],
        };
      }

      return {
        data: {
          estimates: [],
          total: 0,
        },
        itemCount: 0,
        omittedFields: ["lineItems"],
      };
    },
    ...overrides,
  };
}
