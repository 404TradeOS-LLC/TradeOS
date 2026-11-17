import { z } from "zod";
import { defineTool, successResult, warning } from "../../athena-tool-sdk";
import type { AthenaToolDefinition, AthenaWarning } from "../../athena-tool-sdk";
import { listCodeReferences } from "../../costbook/codes/registry";

export const costbookCodeReferencesInputSchema = z.object({
  state: z.string().regex(/^[A-Za-z]{2}$/).transform((state) => state.toUpperCase()),
  county: z.string().trim().min(1).max(80).optional(),
  topic: z.enum(["signage", "permits", "electrical", "structural", "right-of-way"]).optional(),
  q: z.string().trim().max(120).optional(),
}).strict();

export type CostbookCodeReferencesInput = z.infer<typeof costbookCodeReferencesInputSchema>;
export type CostbookCodeReferencesData = ReturnType<typeof listCodeReferences>;

/** Research only: official references, no legal/engineering certification or tenant data. */
export function createCostbookCodeReferencesTool(): AthenaToolDefinition<
  CostbookCodeReferencesInput,
  CostbookCodeReferencesData
> {
  return defineTool({
    id: "tradeos.athena.tools.costbook.code.references",
    version: "1.0.0",
    owner: "athena-tools-costbook",
    name: "Find codes and permits references",
    category: "costbook",
    description:
      "Searches a small cited official-source index for zoning, building, electrical, signage and highway permitting. All citations are unverified for the parcel and must be confirmed with the authority; never asserts compliance, permit approval, fees, wiring or footing specifications.",
    permissions: ["costbook.read"],
    risk: "low",
    confirmationPolicy: "never",
    timeoutMs: 5_000,
    idempotency: "not_supported",
    compensationPolicy: "none",
    inputSchema: costbookCodeReferencesInputSchema,
    async execute(input, _aiContext, execution) {
      const data = listCodeReferences(input);
      const warnings: AthenaWarning[] = [];
      if (!data.items.length) {
        warnings.push(warning({
          code: "athena_costbook_codes_no_sources",
          message: "No indexed code sources for this jurisdiction and search. Consult the authority directly.",
        }));
      }
      // County coverage is independent of topic/text-filtered results. A state-only
      // citation returned for electrical work does not imply Vigo zoning is absent.
      if (!input.county) {
        warnings.push(warning({
          code: "athena_costbook_codes_county_not_selected",
          message: "No county was selected, so local sources are excluded. Select a county and verify local requirements with the authority.",
        }));
      } else if (!listCodeReferences({ state: input.state, county: input.county })
        .items.some((item) => item.county !== null)) {
        warnings.push(warning({
          code: "athena_costbook_codes_local_unindexed",
          message: "Only statewide references are indexed for this county. Local ordinances and permits still require direct verification.",
        }));
      }
      return successResult<CostbookCodeReferencesData>({
        summary: `Found ${data.total} advisory code source(s). Verify every relevant requirement with the authority having jurisdiction; no permit or legal compliance has been certified.`,
        data,
        telemetry: { traceId: execution.traceId, executionId: execution.executionId },
        warnings,
      });
    },
  });
}
