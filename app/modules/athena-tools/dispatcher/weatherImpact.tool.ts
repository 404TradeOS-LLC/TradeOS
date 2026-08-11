import { z } from "zod";
import { defineTool, successResult, warning } from "../../athena-tool-sdk";
import type { AthenaToolDefinition } from "../../athena-tool-sdk";

// A12 Business Tool Rollout, Dispatcher domain (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 4 "Dispatcher").
// This tool needs no application service - it only reads A3's `weather`
// provider section off the AthenaAIContext already passed into every tool's
// execute(). A1/A2 never populate this field yet (see athena-kernel/types.ts's
// AthenaAIContext module comment: "A1 never populates provider sections...
// those are A3+ work"), so an unset/omitted section is treated as an
// expected, non-error state - not a failure - per this rollout's explicit
// "do not invent external integrations" rule. No external weather API is
// ever called here.

export const weatherImpactInputSchema = z.object({
  jobId: z.string().uuid().optional(),
});
export type WeatherImpactInput = z.infer<typeof weatherImpactInputSchema>;

export type WeatherImpactData = unknown;

export function createWeatherImpactTool(): AthenaToolDefinition<WeatherImpactInput, WeatherImpactData> {
  return defineTool({
    id: "tradeos.athena.tools.dispatcher.weather-impact",
    version: "1.0.0",
    owner: "athena-tools-dispatcher",
    description: "Surfaces whatever weather context Athena's context engine currently has available for dispatch planning, if any.",
    permissions: ["dispatch.manage"],
    risk: "low",
    confirmationPolicy: "never",
    timeoutMs: 5_000,
    idempotency: "not_supported",
    compensationPolicy: "none",
    inputSchema: weatherImpactInputSchema,
    async execute(_input, aiContext, execution) {
      const telemetry = { traceId: execution.traceId, executionId: execution.executionId };
      const weather = aiContext.weather;

      if (!weather || weather.status === "omitted" || weather.status === "unavailable" || weather.data === undefined || weather.data === null) {
        return successResult<WeatherImpactData>({
          summary: "No weather context is currently available - Athena does not yet have a live weather provider connected.",
          data: null,
          telemetry,
          warnings: [
            warning({
              code: "athena_weather_context_unavailable",
              message: "No weather context is currently available for dispatch planning.",
            }),
          ],
        });
      }

      return successResult<WeatherImpactData>({
        summary: `Weather context is ${weather.status} (source: ${weather.source.providerId}).`,
        data: weather.data,
        telemetry,
      });
    },
  });
}
