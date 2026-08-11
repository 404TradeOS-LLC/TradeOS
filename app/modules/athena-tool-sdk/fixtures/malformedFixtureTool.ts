import { z } from "zod";
import type { AthenaToolDefinition } from "../types";

// Test-only, deliberately invalid AthenaToolDefinition, used only by
// app/tests/athena-tool-sdk.contracts.test.ts to prove
// describeAthenaToolContract's underlying assertions actually reject a
// broken definition (docs/athena/roadmap/A9-tool-sdk-implementation-plan.md
// "Contract-test kit"). The invalid `risk` value requires bypassing
// TypeScript with `as unknown as AthenaToolDefinition` - a well-typed
// defineTool() call cannot produce this shape at all, which is itself part
// of what the test proves (compile-time safety catches this class of
// mistake; the runtime contract kit catches it too, for a caller who
// bypasses the type system). Never registered outside test setup.
export function createMalformedFixtureTool(): AthenaToolDefinition<unknown, unknown> {
  return {
    id: "tradeos.athena.fixture.malformed",
    version: "1.0.0",
    owner: "athena-tool-sdk-fixtures",
    description: "Test-only fixture with an invalid risk value, used to prove the contract kit rejects it.",
    permissions: [],
    risk: "extreme",
    confirmationPolicy: "never",
    timeoutMs: 1_000,
    idempotency: "not_supported",
    compensationPolicy: "none",
    inputSchema: z.object({}),
    async execute() {
      return {
        success: true,
        summary: "Should never run.",
        data: null,
        events: [],
        warnings: [],
        followUps: [],
        telemetry: { traceId: "unused", executionId: "unused" },
      };
    },
  } as unknown as AthenaToolDefinition<unknown, unknown>;
}
