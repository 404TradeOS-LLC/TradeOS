import { CrmService } from "../../crm/service";
import type { AthenaContextProviderDefinition, AthenaContextProviderFetchResult } from "../types";

export interface AthenaCustomerContextRecord {
  customerId: string;
  name: string;
  email: string | null;
  phone: string | null;
  projectCount?: number;
  serviceAddressCount?: number;
  equipmentCount?: number;
}

export interface AthenaCustomerContextData {
  customers: AthenaCustomerContextRecord[];
  total: number;
}

const CUSTOMER_PAGE_SIZE = 10;

export function createCustomerProvider(
  overrides: Partial<AthenaContextProviderDefinition<AthenaCustomerContextData>> = {},
  crmService: Pick<CrmService, "getCustomer" | "listCustomers"> = new CrmService()
): AthenaContextProviderDefinition<AthenaCustomerContextData> {
  return {
    id: "tradeos.athena.context.customers",
    version: "1.0.0",
    owner: "athena-context-engine",
    name: "Customer Context",
    priority: 75,
    section: "customers",
    description: "Actor-scoped customer summary drawn from the CRM service boundary.",
    permissions: ["crm.read"],
    activation: "lazy_intent",
    allowedIntents: ["customer_lookup", "customer_summary", "dispatch_overview", "estimate_review"],
    freshnessTtlMs: 0,
    timeoutMs: 3_000,
    maxItems: CUSTOMER_PAGE_SIZE,
    maxBytes: 65_536,
    sensitivity: "confidential",
    cacheKeyPolicy: "none",
    criticality: "optional",
    failureBehavior: "degrade",
    async provide(input): Promise<AthenaContextProviderFetchResult<AthenaCustomerContextData>> {
      if (input.selectedScope.customerId) {
        const customer = await crmService.getCustomer(input.orgId, input.selectedScope.customerId);
        return {
          data: {
            customers: [
              {
                customerId: customer.id,
                name: customer.name,
                email: customer.email ?? null,
                phone: customer.phone ?? null,
                projectCount: customer.projects.length,
                serviceAddressCount: customer.serviceAddresses.length,
                equipmentCount: customer.equipmentAssets.length,
              },
            ],
            total: 1,
          },
          itemCount: 1,
          omittedFields: ["notes.body", "billingAddress"],
        };
      }

      const customers = await crmService.listCustomers(input.orgId, { limit: CUSTOMER_PAGE_SIZE });
      return {
        data: {
          customers: customers.map((customer) => ({
            customerId: customer.id,
            name: customer.name,
            email: customer.email ?? null,
            phone: customer.phone ?? null,
          })),
          total: customers.length,
        },
        itemCount: customers.length,
        omittedFields: ["notes", "billingAddress", "serviceAddresses", "equipmentAssets"],
      };
    },
    ...overrides,
  };
}
