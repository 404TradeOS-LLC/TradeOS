import { z } from "zod";
import { createEchoFixtureTool } from "../modules/athena-tool-registry/fixtures/echoFixtureTool";
import { defineTool, describeAthenaToolContract, successResult } from "../modules/athena-tool-sdk";
import { assertToolDefinitionShape, assertToolRegistersAndResolves } from "../modules/athena-tool-sdk/contractTestKit";
import { createMalformedFixtureTool } from "../modules/athena-tool-sdk/fixtures/malformedFixtureTool";
import { createRecallPreferenceTool } from "../modules/athena-tool-sdk/fixtures/recallPreferenceTool";
import type { RecallPreferenceToolDeps } from "../modules/athena-tool-sdk/fixtures/recallPreferenceTool";
import type { AthenaMemoryRecord } from "../modules/athena-memory/types";

// A9's `athena:contracts`-gated suite (docs/athena/roadmap/
// A9-tool-sdk-implementation-plan.md "Test plan" / "Exit criteria"). Proves:
// (1) this milestone's own reference tool passes the reusable contract kit,
// (2) a pre-existing direct A2 fixture (never touched by A9) also passes it
// unchanged, (3) a deliberately malformed definition fails it, and (4) the
// kit's medium/high-risk path genuinely runs through A4 permission
// evaluation and A6 approval-gated execution, not a shortcut.

function createFakeMemoryService(knownKey: string, record: Partial<AthenaMemoryRecord> = {}): RecallPreferenceToolDeps["memoryService"] {
  return {
    async recall(input) {
      if (input.kind !== `preference.${knownKey}`) return null;
      const now = new Date().toISOString();
      return {
        id: "mem_1",
        version: "1.0.0",
        orgId: input.orgId,
        scope: input.scope,
        subjectId: input.subjectId,
        kind: input.kind,
        value: "dark_mode",
        source: { kind: "user_message", trusted: true },
        confidence: 0.9,
        retention: { tier: "standard" },
        status: "active",
        visibility: "actor",
        createdByActor: { type: "user", id: input.subjectId },
        updatedByActor: { type: "user", id: input.subjectId },
        createdAt: now,
        updatedAt: now,
        metadata: {},
        ...record,
      };
    },
  };
}

describe("athena-tool-sdk reference fixture: recallPreference", () => {
  describeAthenaToolContract(createRecallPreferenceTool({ memoryService: createFakeMemoryService("theme") }), {
    validInput: { key: "theme" },
    invalidInputs: [{ key: "" }, {}, { key: 123 }],
  });

  it("returns a warning and a follow-up (no error) when no preference is recorded, rather than failing", async () => {
    const tool = createRecallPreferenceTool({ memoryService: createFakeMemoryService("theme") });
    const result = await tool.execute(
      { key: "unset_preference" },
      // AthenaAIContext is unused by this tool's execute(); a minimal stub is
      // sufficient here since only execution-context fields are read.
      {} as never,
      { executionId: "exec-1", requestId: "req-1", traceId: "trace-1", orgId: "org-1", actor: { type: "user", id: "user-1" }, role: "owner", deadline: new Date(Date.now() + 1000), cancellationSignal: new AbortController().signal, featureFlags: [] }
    );
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
    expect(result.warnings).toEqual([{ code: "athena_preference_not_found", message: 'No preference named "unset_preference" is recorded for this user.' }]);
    expect(result.followUps).toHaveLength(1);
    expect(result.events).toEqual([]);
  });
});

describe("athena-tool-sdk contract kit: direct A2 fixture compatibility", () => {
  // A pre-existing A2 fixture, never touched by A9, still passes the same
  // reusable contract kit unmodified - proving the kit works for any
  // AthenaToolDefinition, not only SDK-authored ones.
  describeAthenaToolContract(createEchoFixtureTool(), {
    validInput: { message: "hello" },
    invalidInputs: [{ message: "" }, {}],
  });
});

describe("athena-tool-sdk contract kit: malformed fixture", () => {
  it("fails assertToolDefinitionShape on an invalid risk value", () => {
    expect(() => assertToolDefinitionShape(createMalformedFixtureTool())).toThrow(/risk/);
  });

  it("fails assertToolRegistersAndResolves because the registry itself refuses to register it", () => {
    expect(() => assertToolRegistersAndResolves(createMalformedFixtureTool())).toThrow(/risk/);
  });
});

describe("athena-tool-sdk contract kit: medium-risk tool requires a verified approval", () => {
  const mediumRiskTool = defineTool({
    id: "tradeos.athena.fixture.sdk-medium-risk",
    version: "1.0.0",
    owner: "athena-tool-sdk-tests",
    description: "Medium-risk SDK test tool that requires approval before executing.",
    // Non-empty on purpose (unlike this file's other test tools): exercises
    // describeAthenaToolContract's assertToolDeniedWithoutRequiredPermissions/
    // assertToolDeniedWithoutRequiredFeatureFlags coverage, which is a no-op
    // for a tool that declares neither. "team.manage" is granted only to
    // owner/admin (app/domain/contracts.ts's rolePermissions), so the kit's
    // permission-denial proof runs against "dispatcher".
    permissions: ["team.manage"],
    risk: "medium",
    confirmationPolicy: "contextual",
    timeoutMs: 1_000,
    idempotency: "optional",
    compensationPolicy: "compensating_action",
    requiredFeatureFlags: ["athena_medium_risk_test_enabled"],
    inputSchema: z.object({ amount: z.number().positive() }),
    async execute(input, _aiContext, execution) {
      return successResult({ summary: `Processed ${input.amount}.`, data: { amount: input.amount }, telemetry: { traceId: execution.traceId, executionId: execution.executionId } });
    },
  });

  describeAthenaToolContract(mediumRiskTool, {
    validInput: { amount: 5 },
    invalidInputs: [{ amount: -5 }, {}],
    // Exercises the full A4 evaluateAthenaPermission() -> A6
    // executeAthenaAction() approval-gated path - see
    // contractTestKit.ts's assertToolExecutesValidInput. Without this, the
    // suite would still prove risk enforcement (assertToolRiskIsEnforced)
    // but not full authorized execution.
    approval: {},
  });
});
