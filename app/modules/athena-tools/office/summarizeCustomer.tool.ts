import { z } from "zod";
import type { CrmService } from "../../crm/service";
import { defineTool } from "../../athena-tool-sdk/defineTool";
import { successResult } from "../../athena-tool-sdk/results";
import type { AthenaToolDefinition } from "../../athena-tool-sdk/types";

// A12 Office Manager tool (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 4 "Office
// Manager"). Wraps CrmService.getCustomer() + listNotes("customer", ...) -
// both read-only, so this tool is risk "low" / compensationPolicy "none" /
// confirmationPolicy "never", matching search-customers. Composes a
// customer profile + recent-notes summary strictly from fields those two
// methods already return (see modules/crm/service.ts) - no invented field.

export const customerSummarizeInputSchema = z.object({
  customerId: z.string().uuid(),
});
export type CustomerSummarizeInput = z.infer<typeof customerSummarizeInputSchema>;

export interface CustomerSummarizeNote {
  id: string;
  body: string;
  authorUserId: string | null;
  createdAt: string;
}

export interface CustomerSummarizeData {
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    billingAddress: string | null;
    projectCount: number;
    serviceAddressCount: number;
    equipmentCount: number;
  };
  recentNotes: CustomerSummarizeNote[];
}

export interface CustomerSummarizeToolDeps {
  crm: Pick<CrmService, "getCustomer" | "listNotes">;
}

export function createCustomerSummarizeTool(deps: CustomerSummarizeToolDeps): AthenaToolDefinition<CustomerSummarizeInput, CustomerSummarizeData> {
  return defineTool({
    id: "tradeos.athena.tools.office.summarize-customer",
    version: "1.0.0",
    owner: "athena-tools-office",
    description: "Summarizes a customer's profile and recent notes/timeline.",
    permissions: ["crm.read"],
    risk: "low",
    confirmationPolicy: "never",
    timeoutMs: 5_000,
    idempotency: "not_supported",
    compensationPolicy: "none",
    resourceScope: {
      entityType: "customer",
      getEntityId(input) {
        return input.customerId;
      },
    },
    inputSchema: customerSummarizeInputSchema,
    async execute(input, _aiContext, execution) {
      const telemetry = { traceId: execution.traceId, executionId: execution.executionId };

      // Any thrown ApiError (customer not found) propagates as-is - no
      // specific expected domain case is translated, following
      // recallPreferenceTool.ts's posture.
      // Note: CrmService.getCustomer()'s own return value shadows the
      // Customer row's plain-text `notes` field with the Comment[] result
      // of its internal notes query (see modules/crm/service.ts's
      // `return { ...row, notes };`) - `customer.notes` is therefore never
      // usable as free text here, which is why this tool calls
      // deps.crm.listNotes() itself (as the spec requires) rather than
      // relying on that already-shadowed field.
      const customer = await deps.crm.getCustomer(execution.orgId, input.customerId);
      const notes = await deps.crm.listNotes(execution.orgId, "customer", input.customerId);
      const recentNotes = notes.slice(0, 10).map((note) => ({
        id: note.id,
        body: note.body,
        authorUserId: note.authorUserId,
        createdAt: note.createdAt.toISOString(),
      }));

      return successResult<CustomerSummarizeData>({
        summary: `${customer.name} has ${customer.projects.length} project(s) and ${notes.length} note(s); showing the ${recentNotes.length} most recent.`,
        data: {
          customer: {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            address: customer.address,
            billingAddress: customer.billingAddress,
            projectCount: customer.projects.length,
            serviceAddressCount: customer.serviceAddresses.length,
            equipmentCount: customer.equipmentAssets.length,
          },
          recentNotes,
        },
        telemetry,
      });
    },
  });
}
