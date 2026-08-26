import { z } from "zod";
import type { AthenaToolDefinition } from "../types";

// Deliberately non-cooperative fixture tool: it never resolves or rejects on
// its own. Used to prove the dispatcher's own deadline still forces a
// timeout result even when a tool ignores cancellation entirely, and (via
// onCancellationSignal) that the dispatcher-owned AbortSignal it received
// genuinely fires on that same deadline (docs/athena/roadmap/
// A2-tool-registry-implementation-plan.md "Timeout, Idempotency, And
// Cancellation Behavior"). Calls no application service.
export const hangingFixtureInputSchema = z.object({});
export type HangingFixtureInput = z.infer<typeof hangingFixtureInputSchema>;

export interface HangingFixtureOverrides {
  timeoutMs?: number;
  onCancellationSignal?: () => void;
}

export function createHangingFixtureTool(overrides: HangingFixtureOverrides = {}): AthenaToolDefinition<HangingFixtureInput, never> {
  return {
    id: "tradeos.athena.fixture.hanging",
    version: "1.0.0",
    owner: "athena-tool-registry-fixtures",
    name: "Hanging Fixture",
    category: "fixture",
    description: "Test-only fixture tool that never resolves. Calls no application service.",
    permissions: [],
    risk: "low",
    confirmationPolicy: "never",
    timeoutMs: overrides.timeoutMs ?? 1_000,
    idempotency: "not_supported",
    compensationPolicy: "draft_only",
    inputSchema: hangingFixtureInputSchema,
    outputSchema: "AthenaToolResult",
    execute(_input, _aiContext, execution) {
      if (overrides.onCancellationSignal) {
        execution.cancellationSignal.addEventListener("abort", () => overrides.onCancellationSignal?.(), { once: true });
      }
      return new Promise(() => {
        // Deliberately never resolves or rejects.
      });
    },
  };
}
