import { randomUUID } from "node:crypto";
import { buildMinimalAthenaContext } from "../modules/athena-kernel/context";
import { dispatchAthenaTool, AthenaToolDispatchRequest } from "../modules/athena-tool-registry/dispatcher";
import { createEchoFixtureTool } from "../modules/athena-tool-registry/fixtures/echoFixtureTool";
import { createHangingFixtureTool } from "../modules/athena-tool-registry/fixtures/hangingFixtureTool";
import { createAthenaToolRegistry } from "../modules/athena-tool-registry/registry";
import { assertValidAthenaToolResult } from "../modules/athena-tool-registry/resultEnvelope";
import type { AthenaToolDefinition } from "../modules/athena-tool-registry/types";

function buildRequest(overrides: Partial<AthenaToolDispatchRequest> = {}): AthenaToolDispatchRequest {
  const executionId = randomUUID();
  const traceId = randomUUID();
  const requestId = randomUUID();
  const aiContext = buildMinimalAthenaContext({
    requestId,
    traceId,
    executionId,
    actor: { userId: "user-1", orgId: "org-1", role: "owner", permissions: [] },
    request: { message: "dispatch a fixture tool", requestSource: "test" },
  });
  return {
    toolId: "tradeos.athena.fixture.echo",
    version: "1.0.0",
    input: { message: "hello" },
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

describe("athena tool dispatcher", () => {
  it("dispatches a registered fixture tool and returns a valid envelope", async () => {
    const registry = createAthenaToolRegistry();
    registry.register(createEchoFixtureTool());
    const request = buildRequest();

    const outcome = await dispatchAthenaTool(registry, request);

    expect(() => assertValidAthenaToolResult(outcome.result)).not.toThrow();
    expect(outcome.result.success).toBe(true);
    expect(outcome.result.data).toEqual({ echoed: "hello" });
    expect(outcome.audit.reasonCode).toBe("dispatched");
    expect(outcome.audit.evaluatedRisk).toBe("low");
    expect(outcome.result.telemetry).toEqual({ traceId: request.traceId, executionId: request.executionId });
  });

  it("overwrites a tool's own telemetry with the active dispatch context instead of trusting a mismatched value", async () => {
    const registry = createAthenaToolRegistry();
    const mismatchedTelemetryTool: AthenaToolDefinition = {
      ...createEchoFixtureTool({ id: "tradeos.athena.fixture.mismatched-telemetry" }),
      async execute() {
        return {
          success: true,
          summary: "Echoed the provided message.",
          data: { echoed: "hi" },
          events: [],
          warnings: [],
          followUps: [],
          // A stale/unrelated telemetry reference a buggy or malicious tool
          // might return - the dispatcher must never pass this through.
          telemetry: { traceId: "stale-trace-id", executionId: "stale-execution-id" },
        } as never;
      },
    };
    registry.register(mismatchedTelemetryTool);
    const request = buildRequest({ toolId: "tradeos.athena.fixture.mismatched-telemetry" });

    const outcome = await dispatchAthenaTool(registry, request);

    expect(outcome.result.success).toBe(true);
    expect(outcome.result.telemetry).toEqual({ traceId: request.traceId, executionId: request.executionId });
    expect(outcome.result.telemetry.traceId).not.toBe("stale-trace-id");
    expect(outcome.result.telemetry.executionId).not.toBe("stale-execution-id");
  });

  it("fails closed with the same public error shape for an unknown tool and a permission-denied tool", async () => {
    const registry = createAthenaToolRegistry();
    registry.register(createEchoFixtureTool({ id: "tradeos.athena.fixture.needs-billing", permissions: ["billing.write"] }));

    const unknown = await dispatchAthenaTool(registry, buildRequest({ toolId: "tradeos.athena.fixture.nope" }));
    const denied = await dispatchAthenaTool(registry, buildRequest({ toolId: "tradeos.athena.fixture.needs-billing", role: "technician" }));

    expect(unknown.result.success).toBe(false);
    expect(denied.result.success).toBe(false);
    expect(denied.result.error?.code).toBe(unknown.result.error?.code);
    expect(denied.result.error?.category).toBe(unknown.result.error?.category);
    expect(denied.result.error?.retryable).toBe(unknown.result.error?.retryable);
    expect(denied.result.error?.safeSummary).toBe(unknown.result.error?.safeSummary);

    // The internal audit record still distinguishes the real reason.
    expect(unknown.audit.reasonCode).toBe("tool_not_found");
    expect(denied.audit.reasonCode).toBe("authorization_denied");
  });

  it("hides tool_version_not_found from an unauthorized caller behind the same not-found shape used for unknown ids", async () => {
    const registry = createAthenaToolRegistry();
    registry.register(createEchoFixtureTool({ id: "tradeos.athena.fixture.needs-billing", version: "1.0.0", permissions: ["billing.write"] }));

    const unauthorizedWrongVersion = await dispatchAthenaTool(registry, buildRequest({ toolId: "tradeos.athena.fixture.needs-billing", version: "9.9.9", role: "technician" }));
    const unknown = await dispatchAthenaTool(registry, buildRequest({ toolId: "tradeos.athena.fixture.nope", version: "9.9.9" }));

    expect(unauthorizedWrongVersion.result.success).toBe(false);
    expect(unauthorizedWrongVersion.result.error?.code).toBe(unknown.result.error?.code);
    expect(unauthorizedWrongVersion.result.error?.category).toBe(unknown.result.error?.category);
    expect(unauthorizedWrongVersion.result.error?.safeSummary).toBe(unknown.result.error?.safeSummary);
    expect(unauthorizedWrongVersion.audit.reasonCode).toBe("authorization_denied");
  });

  it("still reveals tool_version_not_found to a caller authorized for at least one existing version of that id", async () => {
    const registry = createAthenaToolRegistry();
    registry.register(createEchoFixtureTool({ version: "1.0.0" }));

    const outcome = await dispatchAthenaTool(registry, buildRequest({ toolId: "tradeos.athena.fixture.echo", version: "9.9.9", role: "owner" }));

    expect(outcome.result.error?.code).toBe("athena_tool_version_not_found");
    expect(outcome.audit.reasonCode).toBe("tool_version_not_found");
  });

  it("does not invoke tool.execute() when the client signal is already aborted before dispatch begins", async () => {
    const registry = createAthenaToolRegistry();
    let executed = false;
    registry.register(createEchoFixtureTool({ onExecuted: () => { executed = true; } }));
    const controller = new AbortController();
    controller.abort();

    const outcome = await dispatchAthenaTool(registry, buildRequest({ clientSignal: controller.signal }));

    expect(executed).toBe(false);
    expect(outcome.result.success).toBe(false);
    expect(outcome.result.error?.code).toBe("athena_tool_cancelled");
    expect(outcome.audit.reasonCode).toBe("cancelled");
  });

  it("denies a feature-flag-gated tool the same way as an unknown tool when required flags are missing", async () => {
    const registry = createAthenaToolRegistry();
    registry.register(createEchoFixtureTool({ id: "tradeos.athena.fixture.flagged", requiredFeatureFlags: ["athena_fixture_flag"] }));

    const outcome = await dispatchAthenaTool(registry, buildRequest({ toolId: "tradeos.athena.fixture.flagged", featureFlags: [] }));

    expect(outcome.result.success).toBe(false);
    expect(outcome.result.error?.code).toBe("athena_tool_not_found");
    expect(outcome.audit.reasonCode).toBe("authorization_denied");
  });

  it("rejects invalid input before tool.execute() runs", async () => {
    const registry = createAthenaToolRegistry();
    let executed = false;
    registry.register(createEchoFixtureTool({ onExecuted: () => { executed = true; } }));

    // Fails echoFixtureInputSchema's min(1) constraint.
    const outcome = await dispatchAthenaTool(registry, buildRequest({ input: { message: "" } }));

    expect(outcome.result.success).toBe(false);
    expect(outcome.result.error?.code).toBe("athena_tool_invalid_input");
    expect(outcome.audit.reasonCode).toBe("invalid_input");
    expect(executed).toBe(false);
  });

  it("forces a timeout result when a non-cooperative tool never resolves", async () => {
    const registry = createAthenaToolRegistry();
    registry.register(createHangingFixtureTool({ timeoutMs: 20 }));

    const outcome = await dispatchAthenaTool(registry, buildRequest({ toolId: "tradeos.athena.fixture.hanging", input: {} }));

    expect(outcome.result.success).toBe(false);
    expect(outcome.result.error?.code).toBe("athena_tool_timeout");
    expect(outcome.audit.reasonCode).toBe("timeout");
  }, 10_000);

  it("fires the dispatcher-owned cancellation signal on the tool once its deadline elapses", async () => {
    const registry = createAthenaToolRegistry();
    let signalFired = false;
    registry.register(createHangingFixtureTool({ timeoutMs: 20, onCancellationSignal: () => { signalFired = true; } }));

    await dispatchAthenaTool(registry, buildRequest({ toolId: "tradeos.athena.fixture.hanging", input: {} }));

    expect(signalFired).toBe(true);
  }, 10_000);

  it("maps an externally cancelled client signal to a distinct cancelled error, not a timeout", async () => {
    const registry = createAthenaToolRegistry();
    registry.register(createHangingFixtureTool({ timeoutMs: 5_000 }));
    const controller = new AbortController();

    const dispatchPromise = dispatchAthenaTool(registry, buildRequest({ toolId: "tradeos.athena.fixture.hanging", input: {}, clientSignal: controller.signal }));
    controller.abort();
    const outcome = await dispatchPromise;

    expect(outcome.result.error?.code).toBe("athena_tool_cancelled");
    expect(outcome.audit.reasonCode).toBe("cancelled");
  });

  it("converts a malformed tool result into a safe invalid-result error instead of returning it directly", async () => {
    const registry = createAthenaToolRegistry();
    const brokenTool: AthenaToolDefinition = {
      ...createEchoFixtureTool({ id: "tradeos.athena.fixture.broken" }),
      async execute() {
        return { success: true } as never;
      },
    };
    registry.register(brokenTool);

    const outcome = await dispatchAthenaTool(registry, buildRequest({ toolId: "tradeos.athena.fixture.broken" }));

    expect(outcome.result.success).toBe(false);
    expect(outcome.result.error?.code).toBe("athena_tool_invalid_result");
    expect(outcome.audit.reasonCode).toBe("invalid_result_envelope");
  });
});
