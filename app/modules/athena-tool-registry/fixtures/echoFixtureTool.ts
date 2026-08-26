import { z } from "zod";
import type { AthenaToolDefinition, AthenaToolRisk } from "../types";

// No-op fixture tool used only to exercise the A2 registry/dispatcher and
// contract tests (docs/athena/roadmap/A2-tool-registry-implementation-plan.md
// A2 Non-Goals: "no application service is called by any A2 tool"). Never
// registered outside test setup.
export const echoFixtureInputSchema = z.object({ message: z.string().min(1).max(200) });
export type EchoFixtureInput = z.infer<typeof echoFixtureInputSchema>;

export interface EchoFixtureData {
  echoed: string;
}

export interface EchoFixtureOverrides {
  id?: string;
  version?: string;
  timeoutMs?: number;
  permissions?: string[];
  risk?: AthenaToolRisk;
  requiredFeatureFlags?: string[];
  onExecuted?: () => void;
}

export function createEchoFixtureTool(overrides: EchoFixtureOverrides = {}): AthenaToolDefinition<EchoFixtureInput, EchoFixtureData> {
  return {
    id: overrides.id ?? "tradeos.athena.fixture.echo",
    version: overrides.version ?? "1.0.0",
    owner: "athena-tool-registry-fixtures",
    name: "Echo Fixture",
    category: "fixture",
    description: "Test-only fixture tool that echoes its input. Calls no application service.",
    permissions: overrides.permissions ?? [],
    risk: overrides.risk ?? "low",
    confirmationPolicy: "never",
    timeoutMs: overrides.timeoutMs ?? 1_000,
    idempotency: "not_supported",
    compensationPolicy: "draft_only",
    inputSchema: echoFixtureInputSchema,
    outputSchema: "AthenaToolResult",
    requiredFeatureFlags: overrides.requiredFeatureFlags,
    async execute(input, _aiContext, execution) {
      overrides.onExecuted?.();
      if (execution.cancellationSignal.aborted) {
        return {
          success: false,
          summary: "Cancelled before the echo could run.",
          data: null,
          events: [],
          warnings: [],
          followUps: [],
          telemetry: { traceId: execution.traceId, executionId: execution.executionId },
          error: {
            code: "athena_tool_cancelled",
            category: "timeout",
            retryable: false,
            safeSummary: "This tool call was cancelled.",
            correlationId: execution.traceId,
          },
        };
      }
      return {
        success: true,
        summary: "Echoed the provided message.",
        data: { echoed: input.message },
        events: [],
        warnings: [],
        followUps: [],
        telemetry: { traceId: execution.traceId, executionId: execution.executionId },
      };
    },
  };
}
