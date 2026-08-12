import { z } from "zod";
import type { CrmService } from "../../crm/service";
import { defineTool } from "../../athena-tool-sdk/defineTool";
import { successResult } from "../../athena-tool-sdk/results";
import type { AthenaToolDefinition } from "../../athena-tool-sdk/types";

// A12 Office Manager tool (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 4 "Office
// Manager"). Read-only: wraps CrmService's org-scoped get/list methods.
// Free-text filtering and the result bound are applied in CrmService's Prisma
// query so this tool never loads an unbounded tenant customer directory.

const CUSTOMER_SEARCH_LIMIT = 25;

export const customerSearchInputSchema = z
  .object({
    query: z.string().min(1).max(200).optional(),
    customerId: z.string().uuid().optional(),
  })
  .refine((input) => Boolean(input.query?.trim() || input.customerId), {
    message: "At least one of query or customerId is required.",
  });
export type CustomerSearchInput = z.infer<typeof customerSearchInputSchema>;

export interface CustomerSearchResultItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface CustomerSearchData {
  customers: CustomerSearchResultItem[];
}

export interface CustomerSearchToolDeps {
  crm: Pick<CrmService, "listCustomers" | "getCustomer">;
}

function toSummary(customer: { id: string; name: string; email: string | null; phone: string | null; address: string | null }): CustomerSearchResultItem {
  return { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, address: customer.address };
}

export function createCustomerSearchTool(deps: CustomerSearchToolDeps): AthenaToolDefinition<CustomerSearchInput, CustomerSearchData> {
  return defineTool({
    id: "tradeos.athena.tools.office.search-customers",
    version: "1.0.0",
    owner: "athena-tools-office",
    description: "Searches customers by name/email/phone, or looks up a single customer by id.",
    permissions: ["crm.read"],
    risk: "low",
    confirmationPolicy: "never",
    timeoutMs: 5_000,
    idempotency: "not_supported",
    compensationPolicy: "none",
    inputSchema: customerSearchInputSchema,
    async execute(input, _aiContext, execution) {
      const telemetry = { traceId: execution.traceId, executionId: execution.executionId };

      if (input.customerId) {
        const customer = await deps.crm.getCustomer(execution.orgId, input.customerId);
        return successResult<CustomerSearchData>({
          summary: `Found customer "${customer.name}".`,
          data: { customers: [toSummary(customer)] },
          telemetry,
        });
      }

      const query = input.query?.trim() ?? "";
      const matches = await deps.crm.listCustomers(execution.orgId, { query, limit: CUSTOMER_SEARCH_LIMIT });

      return successResult<CustomerSearchData>({
        summary: `Found ${matches.length} customer(s) matching "${input.query}".`,
        data: { customers: matches.map(toSummary) },
        telemetry,
      });
    },
  });
}
