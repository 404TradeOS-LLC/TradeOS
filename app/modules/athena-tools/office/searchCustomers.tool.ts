import { z } from "zod";
import type { CrmService } from "../../crm/service";
import { defineTool } from "../../athena-tool-sdk/defineTool";
import { successResult } from "../../athena-tool-sdk/results";
import type { AthenaToolDefinition } from "../../athena-tool-sdk/types";

// A12 Office Manager tool (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 4 "Office
// Manager"). Wraps CrmService.listCustomers()/getCustomer() - both
// read-only, so this tool is risk "low" / compensationPolicy "none" /
// confirmationPolicy "never" per the plan's section 5 rationale ("Athena
// may automatically: search, summarize..."). CrmService.listCustomers()
// takes only `orgId` (see modules/crm/service.ts) - it has no server-side
// search parameter, so a free-text `query` is matched client-side against
// name/email/phone here rather than assumed to exist on the service.

export const customerSearchInputSchema = z
  .object({
    query: z.string().min(1).max(200).optional(),
    customerId: z.string().uuid().optional(),
  })
  .refine((input) => Boolean(input.query || input.customerId), {
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

      // customerId is the more specific request - if both are supplied,
      // resolving the exact record takes priority over a free-text filter.
      // Any thrown ApiError (customer not found) propagates as-is - no
      // specific expected domain case is translated, following
      // recallPreferenceTool.ts's posture.
      if (input.customerId) {
        const customer = await deps.crm.getCustomer(execution.orgId, input.customerId);
        return successResult<CustomerSearchData>({
          summary: `Found customer "${customer.name}".`,
          data: { customers: [toSummary(customer)] },
          telemetry,
        });
      }

      const allCustomers = await deps.crm.listCustomers(execution.orgId);
      const query = input.query?.trim().toLowerCase();
      const matches = query
        ? allCustomers.filter((customer) => {
            const haystacks = [customer.name, customer.email, customer.phone];
            return haystacks.some((value) => value?.toLowerCase().includes(query));
          })
        : allCustomers;

      return successResult<CustomerSearchData>({
        summary: query ? `Found ${matches.length} customer(s) matching "${input.query}".` : `Found ${matches.length} customer(s).`,
        data: { customers: matches.map(toSummary) },
        telemetry,
      });
    },
  });
}
