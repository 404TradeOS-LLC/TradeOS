import { z } from "zod";
import type { EstimateEngineService } from "../../estimate-engine/service";
import type { InvoicesService } from "../../invoices/service";
import { defineTool } from "../../athena-tool-sdk/defineTool";
import { successResult } from "../../athena-tool-sdk/results";
import type { AthenaToolDefinition } from "../../athena-tool-sdk/types";
import { warning } from "../../athena-tool-sdk/warnings";

// A12 Office Manager tool (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 4 "Office
// Manager", section 3 point 3). Composes a *preview-only* draft invoice from
// EstimateEngineService.getById() + InvoicesService.listByProject() - both
// reads. This tool performs zero database writes and never calls any
// invoice-creating/writing method (InvoicesService.create/send/markPaid/
// void), by construction: `deps.invoices` is narrowed to
// Pick<InvoicesService, "listByProject"> only, so a write method is not
// even reachable through `deps` here. confirmationPolicy is "always" -
// unlike every other Office Manager tool - because its output is explicitly
// a draft a human must act on through the existing invoicing UI, never
// auto-sent, per the plan's section 5 "Athena requires approval for:
// ...sending invoices...financial actions" boundary. Still risk "low" per
// that same section: no production approval-verifier submission surface
// exists yet (section 3 point 3), and this tool never crosses into that
// approval-requiring category itself since it writes nothing.

export const invoicePrepareInputSchema = z.object({
  estimateId: z.string().uuid(),
});
export type InvoicePrepareInput = z.infer<typeof invoicePrepareInputSchema>;

export interface InvoicePrepareLineItem {
  description: string;
  quantity: number;
  unitOfMeasure: string;
  unitCost: number;
  lineCost: number;
}

export interface InvoicePrepareData {
  preview: true;
  estimateId: string;
  projectId: string;
  lineItems: InvoicePrepareLineItem[];
  subtotal: number;
  suggestedAmount: number;
  existingInvoiceCount: number;
}

export interface InvoicePrepareToolDeps {
  estimateEngine: Pick<EstimateEngineService, "getById">;
  invoices: Pick<InvoicesService, "listByProject">;
}

export function createInvoicePrepareTool(deps: InvoicePrepareToolDeps): AthenaToolDefinition<InvoicePrepareInput, InvoicePrepareData> {
  return defineTool({
    id: "tradeos.athena.tools.office.prepare-invoice",
    version: "1.0.0",
    owner: "athena-tools-office",
    description: "Composes a preview-only draft invoice from a finalized estimate; never creates or sends an invoice.",
    permissions: ["billing.write"],
    risk: "low",
    confirmationPolicy: "always",
    timeoutMs: 5_000,
    idempotency: "not_supported",
    compensationPolicy: "none",
    inputSchema: invoicePrepareInputSchema,
    async execute(input, _aiContext, execution) {
      const telemetry = { traceId: execution.traceId, executionId: execution.executionId };

      // Any thrown ApiError (estimate not found) propagates as-is - no
      // specific expected domain case is translated, following
      // recallPreferenceTool.ts's posture.
      const estimate = await deps.estimateEngine.getById(input.estimateId, execution.orgId);
      const existingInvoices = await deps.invoices.listByProject(estimate.projectId, execution.orgId);

      const lineItems: InvoicePrepareLineItem[] = estimate.lineItems.map((lineItem) => ({
        description: lineItem.description,
        quantity: lineItem.quantity,
        unitOfMeasure: lineItem.unitOfMeasure,
        unitCost: lineItem.unitCost,
        lineCost: lineItem.lineCost,
      }));

      const warnings = [
        warning({
          code: "athena_invoice_preview_only",
          message: "This is a preview only. No invoice has been created or sent - a human must create and send it through the existing invoicing UI.",
        }),
      ];
      if (existingInvoices.length > 0) {
        warnings.push(
          warning({
            code: "athena_invoice_already_exists",
            message: `Project ${estimate.projectId} already has ${existingInvoices.length} invoice(s). Review them before creating a new one to avoid duplication.`,
          })
        );
      }

      return successResult<InvoicePrepareData>({
        summary: `Prepared a preview draft invoice for estimate v${estimate.version} (project ${estimate.projectId}): ${lineItems.length} line item(s) totaling ${estimate.totalPrice}.`,
        data: {
          preview: true,
          estimateId: estimate.id,
          projectId: estimate.projectId,
          lineItems,
          subtotal: estimate.subtotalCost,
          suggestedAmount: estimate.totalPrice,
          existingInvoiceCount: existingInvoices.length,
        },
        telemetry,
        warnings,
        // Read-only preview - no invoice was created, so there is no event
        // to reference.
        events: [],
      });
    },
  });
}
