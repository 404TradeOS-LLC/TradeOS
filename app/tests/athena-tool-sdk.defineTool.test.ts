import { randomUUID } from "node:crypto";
import { z } from "zod";
import { buildMinimalAthenaContext } from "../modules/athena-kernel/context";
import { defineTool } from "../modules/athena-tool-sdk/defineTool";
import { successResult } from "../modules/athena-tool-sdk/results";
import { createEchoFixtureTool } from "../modules/athena-tool-registry/fixtures/echoFixtureTool";
import { dispatchAthenaTool } from "../modules/athena-tool-registry/dispatcher";
import type { AthenaToolDispatchRequest } from "../modules/athena-tool-registry/dispatcher";
import { createAthenaToolRegistry } from "../modules/athena-tool-registry/registry";
import { assertValidAthenaToolResult } from "../modules/athena-tool-registry/resultEnvelope";
import type { AthenaToolDefinition } from "../modules/athena-tool-registry/types";

// Proves defineTool() is a pure authoring convenience that produces an
// ordinary A2 AthenaToolDefinition - registry/dispatcher compatibility, not
// SDK-internal object-shape assertions alone (docs/athena/roadmap/
// A9-tool-sdk-implementation-plan.md "Test plan").

const greetInputSchema = z.object({ name: z.string().min(1).max(50) });

function buildGreetTool(overrides: { requiredFeatureFlags?: string[] } = {}) {
  return defineTool({
    id: "tradeos.athena.fixture.sdk-greet",
    version: "1.0.0",
    owner: "athena-tool-sdk-tests",
    name: "SDK Greet",
    category: "fixture",
    description: "SDK-defined test tool that greets by name.",
    permissions: [],
    risk: "low",
    confirmationPolicy: "never",
    timeoutMs: 1_000,
    idempotency: "not_supported",
    compensationPolicy: "none",
    inputSchema: greetInputSchema,
    outputSchema: "AthenaToolResult",
    requiredFeatureFlags: overrides.requiredFeatureFlags,
    async execute(input, _aiContext, execution) {
      return successResult({
        summary: `Greeted ${input.name}.`,
        data: { greeting: `Hello, ${input.name}!` },
        telemetry: { traceId: execution.traceId, executionId: execution.executionId },
      });
    },
  });
}

function buildRequest(overrides: Partial<AthenaToolDispatchRequest> = {}): AthenaToolDispatchRequest {
  const executionId = randomUUID();
  const traceId = randomUUID();
  const requestId = randomUUID();
  const aiContext = buildMinimalAthenaContext({
    requestId,
    traceId,
    executionId,
    actor: { userId: "user-1", orgId: "org-1", role: "owner", permissions: [] },
    request: { message: "dispatch an SDK tool", requestSource: "test" },
  });
  return {
    toolId: "tradeos.athena.fixture.sdk-greet",
    version: "1.0.0",
    input: { name: "Ada" },
    aiContext,
    actor: { type: "user", id: "user-1" },
    role: "owner",
    orgId: "org-1",
    requestId,
    traceId,
    executionId,
    featureFlags: [],
    ...overrides,
  };
}

describe("athena-tool-sdk defineTool()", () => {
  it("produces a value with every AthenaToolDefinition field set from the given options", () => {
    const tool = buildGreetTool();
    expect(tool.id).toBe("tradeos.athena.fixture.sdk-greet");
    expect(tool.version).toBe("1.0.0");
    expect(tool.owner).toBe("athena-tool-sdk-tests");
    expect(tool.name).toBe("SDK Greet");
    expect(tool.category).toBe("fixture");
    expect(tool.risk).toBe("low");
    expect(tool.confirmationPolicy).toBe("never");
    expect(tool.timeoutMs).toBe(1_000);
    expect(tool.idempotency).toBe("not_supported");
    expect(tool.compensationPolicy).toBe("none");
    expect(tool.inputSchema).toBe(greetInputSchema);
    expect(tool.outputSchema).toBe("AthenaToolResult");
    expect(typeof tool.execute).toBe("function");
  });

  it("omits requiredFeatureFlags/deprecated entirely when not provided (no stray undefined fields)", () => {
    const tool = buildGreetTool();
    expect(Object.prototype.hasOwnProperty.call(tool, "requiredFeatureFlags")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(tool, "deprecated")).toBe(false);
  });

  it("preserves requiredFeatureFlags when provided", () => {
    const tool = buildGreetTool({ requiredFeatureFlags: ["athena_sdk_greet_enabled"] });
    expect(tool.requiredFeatureFlags).toEqual(["athena_sdk_greet_enabled"]);
  });

  it("preserves deprecation metadata when provided", () => {
    const tool = defineTool({
      id: "tradeos.athena.fixture.sdk-deprecated",
      version: "1.0.0",
      owner: "athena-tool-sdk-tests",
      name: "SDK Deprecated",
      category: "fixture",
      description: "Deprecated SDK-defined test tool.",
      permissions: [],
      risk: "low",
      confirmationPolicy: "never",
      timeoutMs: 1_000,
      idempotency: "not_supported",
      compensationPolicy: "none",
      inputSchema: z.object({}),
      outputSchema: "AthenaToolResult",
      deprecated: { replacementId: "tradeos.athena.fixture.sdk-greet", sunsetAt: "2027-01-01T00:00:00Z", note: "Use sdkGreet instead." },
      async execute(_input, _aiContext, execution) {
        return successResult({ summary: "n/a", data: null, telemetry: { traceId: execution.traceId, executionId: execution.executionId } });
      },
    });
    expect(tool.deprecated).toEqual({ replacementId: "tradeos.athena.fixture.sdk-greet", sunsetAt: "2027-01-01T00:00:00Z", note: "Use sdkGreet instead." });
  });

  it("registers in the ordinary A2 registry with no SDK-specific registration path", () => {
    const registry = createAthenaToolRegistry();
    expect(() => registry.register(buildGreetTool())).not.toThrow();
    const resolution = registry.resolve("tradeos.athena.fixture.sdk-greet", "1.0.0");
    expect(resolution.outcome).toBe("found");
  });

  it("dispatches through the ordinary A2 dispatcher and returns a valid, correctly-typed result", async () => {
    const registry = createAthenaToolRegistry();
    registry.register(buildGreetTool());
    const outcome = await dispatchAthenaTool(registry, buildRequest());

    expect(() => assertValidAthenaToolResult(outcome.result)).not.toThrow();
    expect(outcome.result.success).toBe(true);
    expect(outcome.result.data).toEqual({ greeting: "Hello, Ada!" });
    expect(outcome.audit.reasonCode).toBe("dispatched");
  });

  it("still validates input through the registered Zod schema - the SDK does not bypass registry input validation", async () => {
    const registry = createAthenaToolRegistry();
    registry.register(buildGreetTool());
    const outcome = await dispatchAthenaTool(registry, buildRequest({ input: { name: "" } }));

    expect(outcome.result.success).toBe(false);
    expect(outcome.result.error?.code).toBe("athena_tool_invalid_input");
  });

  it("behaves like any unknown A2 tool when the SDK-defined tool was never registered", async () => {
    const registry = createAthenaToolRegistry();
    const outcome = await dispatchAthenaTool(registry, buildRequest());

    expect(outcome.result.success).toBe(false);
    expect(outcome.result.error?.code).toBe("athena_tool_not_found");
  });

  it("regression: a hand-written direct A2 AthenaToolDefinition still registers, resolves, and dispatches unchanged alongside an SDK-defined tool", async () => {
    const directTool: AthenaToolDefinition = createEchoFixtureTool();
    const registry = createAthenaToolRegistry();
    registry.register(directTool);
    registry.register(buildGreetTool());

    const directResolution = registry.resolve(directTool.id, directTool.version);
    expect(directResolution.outcome).toBe("found");

    const directOutcome = await dispatchAthenaTool(registry, {
      toolId: directTool.id,
      version: directTool.version,
      input: { message: "still works" },
      aiContext: buildMinimalAthenaContext({
        requestId: randomUUID(),
        traceId: randomUUID(),
        executionId: randomUUID(),
        actor: { userId: "user-1", orgId: "org-1", role: "owner", permissions: [] },
        request: { message: "direct A2 definition regression", requestSource: "test" },
      }),
      actor: { type: "user", id: "user-1" },
      role: "owner",
      orgId: "org-1",
      requestId: randomUUID(),
      traceId: randomUUID(),
      executionId: randomUUID(),
      featureFlags: [],
    });
    expect(directOutcome.result.success).toBe(true);
    expect(directOutcome.result.data).toEqual({ echoed: "still works" });

    const sdkOutcome = await dispatchAthenaTool(registry, buildRequest());
    expect(sdkOutcome.result.success).toBe(true);
  });
});
