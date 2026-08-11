import { z } from "zod";
import type { AssembliesDatabaseService } from "../../assemblies-database/service";
import type { AssemblyDTO } from "../../assemblies-database/types";
import type { CostDatabaseService } from "../../cost-database/service";
import type { CostItemDTO } from "../../cost-database/types";
import { defineTool, successResult, warning } from "../../athena-tool-sdk";
import type { AthenaToolDefinition, AthenaWarning } from "../../athena-tool-sdk";

// A12 Costbook Intelligence tool (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 4 "Costbook
// Intelligence"). A pure catalog search: wraps CostDatabaseService.search()
// (materials/labor/equipment reach the catalog only through composed cost
// items - there is no separate material/labor/equipment search surface) and
// AssembliesDatabaseService.search() (the composed, sellable-unit view over
// those same cost items). Both are read-only, so this tool is risk "low" /
// compensationPolicy "none" / confirmationPolicy "never" per the plan's
// section 5 rationale ("Athena may automatically: search, summarize...").

export const costbookLookupInputSchema = z.object({
  query: z.string().min(1),
});
export type CostbookLookupInput = z.infer<typeof costbookLookupInputSchema>;

export interface CostbookLookupData {
  costItems: CostItemDTO[];
  assemblies: AssemblyDTO[];
}

export interface CostbookLookupToolDeps {
  costDatabase: Pick<CostDatabaseService, "search">;
  assembliesDatabase: Pick<AssembliesDatabaseService, "search">;
}

export function createCostbookLookupTool(deps: CostbookLookupToolDeps): AthenaToolDefinition<CostbookLookupInput, CostbookLookupData> {
  return defineTool({
    id: "tradeos.athena.tools.costbook.lookup",
    version: "1.0.0",
    owner: "athena-tools-costbook",
    description: "Searches the cost database and assemblies database for cost items and composed assemblies matching a free-text query.",
    permissions: ["billing.read"],
    risk: "low",
    confirmationPolicy: "never",
    timeoutMs: 5_000,
    idempotency: "not_supported",
    compensationPolicy: "none",
    inputSchema: costbookLookupInputSchema,
    async execute(input, _aiContext, execution) {
      const telemetry = { traceId: execution.traceId, executionId: execution.executionId };

      const [costItems, assemblies] = await Promise.all([
        deps.costDatabase.search(input.query, execution.orgId),
        deps.assembliesDatabase.search(input.query, execution.orgId),
      ]);

      const warnings: AthenaWarning[] = [];
      if (costItems.length === 0 && assemblies.length === 0) {
        warnings.push(warning({ code: "athena_costbook_lookup_no_matches", message: `No cost items or assemblies matched "${input.query}".` }));
      }

      return successResult<CostbookLookupData>({
        summary:
          costItems.length === 0 && assemblies.length === 0
            ? `No cost items or assemblies matched "${input.query}".`
            : `Found ${costItems.length} cost item(s) and ${assemblies.length} assembly(ies) matching "${input.query}".`,
        data: { costItems, assemblies },
        telemetry,
        warnings,
      });
    },
  });
}
