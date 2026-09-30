import { getRolePermissions } from "../../../domain";
import type { AuthContext } from "../../../backend/auth/context";
import { JobsService } from "../../jobs/service";
import type { AthenaContextProviderDefinition, AthenaContextProviderFetchResult } from "../types";

export interface AthenaMobileFieldContextData {
  surface: "mobile";
  selectedPage: string | null;
  job: null | {
    jobId: string;
    jobNumber: string;
    title: string;
    status: string;
    priority: string;
    serviceArea: { city: string; state: string };
    schedule: { scheduledStart: string | null; scheduledEnd: string | null; arrivalWindowStart: string | null; arrivalWindowEnd: string | null };
  };
}

export function createMobileFieldProvider(
  overrides: Partial<AthenaContextProviderDefinition<AthenaMobileFieldContextData>> = {},
  jobsService: Pick<JobsService, "getById"> = new JobsService(),
): AthenaContextProviderDefinition<AthenaMobileFieldContextData> {
  return {
    id: "tradeos.athena.context.mobile-field",
    version: "1.0.0",
    owner: "athena-context-engine",
    name: "Mobile Field Context",
    priority: 95,
    section: "mobile",
    description: "Minimized actor-scoped field context for mobile and voice Athena requests.",
    permissions: [],
    activation: "explicit_only",
    allowedIntents: [],
    freshnessTtlMs: 0,
    timeoutMs: 1_500,
    maxItems: 1,
    maxBytes: 8_192,
    sensitivity: "internal",
    cacheKeyPolicy: "none",
    criticality: "optional",
    failureBehavior: "degrade",
    async provide(input): Promise<AthenaContextProviderFetchResult<AthenaMobileFieldContextData>> {
      if (!input.selectedScope.jobId) {
        return {
          data: { surface: "mobile", selectedPage: input.selectedScope.page ?? null, job: null },
          itemCount: 0,
          omittedFields: ["customer.email", "customer.phone", "serviceAddress.addressLine1", "serviceAddress.addressLine2", "assignedTechnicians"],
        };
      }
      const auth: AuthContext = {
        userId: input.actor.userId,
        orgId: input.orgId,
        role: input.actor.role,
        canonicalRole: input.actor.role,
        permissions: getRolePermissions(input.actor.role),
      };
      const job = await jobsService.getById(input.orgId, input.selectedScope.jobId, auth);
      return {
        data: {
          surface: "mobile",
          selectedPage: input.selectedScope.page ?? null,
          job: {
            jobId: job.id,
            jobNumber: job.jobNumber,
            title: job.title,
            status: job.status,
            priority: job.priority,
            serviceArea: { city: job.serviceAddress.city, state: job.serviceAddress.state },
            schedule: { scheduledStart: job.scheduledStart, scheduledEnd: job.scheduledEnd, arrivalWindowStart: job.arrivalWindowStart, arrivalWindowEnd: job.arrivalWindowEnd },
          },
        },
        itemCount: 1,
        omittedFields: ["customer.email", "customer.phone", "serviceAddress.addressLine1", "serviceAddress.addressLine2", "assignedTechnicians"],
      };
    },
    ...overrides,
  };
}
