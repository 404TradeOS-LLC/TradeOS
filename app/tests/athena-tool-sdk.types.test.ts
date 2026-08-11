import { z } from "zod";
import { defineTool, eventRef, successResult } from "../modules/athena-tool-sdk";

// Compile-time-only assertions (docs/athena/roadmap/
// A9-tool-sdk-implementation-plan.md "Test plan"). ts-jest type-checks this
// entire file against the real TypeScript program before running it, so a
// `// @ts-expect-error` line that does *not* actually produce a compiler
// error fails the test file to compile at all - there is no separate
// type-testing framework in this repository, and none is introduced here
// (the task brief's "smallest appropriate compile-time verification"). Every
// case below is wrapped in a real `it()` so it also runs at runtime (a
// `defineTool()`/`successResult()`/`eventRef()` call has no side effect), which
// avoids `noUnusedLocals`/`noUnusedParameters` (tsconfig.json) flagging
// unreachable "never called" helper functions as dead code.

describe("athena-tool-sdk compile-time type tests", () => {
  it("infers execute()'s input type from the Zod inputSchema", () => {
    defineTool({
      id: "tradeos.athena.fixture.types-input",
      version: "1.0.0",
      owner: "athena-tool-sdk-tests",
      description: "type test",
      permissions: [],
      risk: "low",
      confirmationPolicy: "never",
      timeoutMs: 1_000,
      idempotency: "not_supported",
      compensationPolicy: "none",
      inputSchema: z.object({ jobId: z.string() }),
      async execute(input, _aiContext, execution) {
        // Only compiles if `input.jobId` is inferred as `string` - no
        // hand-written `Input` type was declared anywhere in this call.
        const upper: string = input.jobId.toUpperCase();
        return successResult({ summary: upper, data: null, telemetry: { traceId: execution.traceId, executionId: execution.executionId } });
      },
    });
  });

  it("preserves the result data type parameter - a mismatched data shape is rejected", () => {
    interface WidgetData {
      widgetId: string;
    }
    successResult<WidgetData>({ summary: "ok", data: { widgetId: "w1" }, telemetry: { traceId: "t", executionId: "e" } });
    // @ts-expect-error - `data` must satisfy WidgetData, not an unrelated shape.
    successResult<WidgetData>({ summary: "ok", data: { wrongField: 1 }, telemetry: { traceId: "t", executionId: "e" } });
  });

  it("rejects an invalid risk value at compile time", () => {
    defineTool({
      id: "tradeos.athena.fixture.types-risk",
      version: "1.0.0",
      owner: "athena-tool-sdk-tests",
      description: "type test",
      permissions: [],
      // @ts-expect-error - "extreme" is not a valid AthenaToolRisk.
      risk: "extreme",
      confirmationPolicy: "never",
      timeoutMs: 1_000,
      idempotency: "not_supported",
      compensationPolicy: "none",
      inputSchema: z.object({}),
      async execute(_input, _aiContext, execution) {
        return successResult({ summary: "ok", data: null, telemetry: { traceId: execution.traceId, executionId: execution.executionId } });
      },
    });
  });

  it("rejects an invalid confirmationPolicy value at compile time", () => {
    defineTool({
      id: "tradeos.athena.fixture.types-confirmation",
      version: "1.0.0",
      owner: "athena-tool-sdk-tests",
      description: "type test",
      permissions: [],
      risk: "low",
      // @ts-expect-error - "sometimes" is not a valid AthenaToolConfirmationPolicy.
      confirmationPolicy: "sometimes",
      timeoutMs: 1_000,
      idempotency: "not_supported",
      compensationPolicy: "none",
      inputSchema: z.object({}),
      async execute(_input, _aiContext, execution) {
        return successResult({ summary: "ok", data: null, telemetry: { traceId: execution.traceId, executionId: execution.executionId } });
      },
    });
  });

  it("rejects an invalid idempotency value at compile time", () => {
    defineTool({
      id: "tradeos.athena.fixture.types-idempotency",
      version: "1.0.0",
      owner: "athena-tool-sdk-tests",
      description: "type test",
      permissions: [],
      risk: "low",
      confirmationPolicy: "never",
      timeoutMs: 1_000,
      // @ts-expect-error - "sometimes" is not a valid AthenaToolIdempotency.
      idempotency: "sometimes",
      compensationPolicy: "none",
      inputSchema: z.object({}),
      async execute(_input, _aiContext, execution) {
        return successResult({ summary: "ok", data: null, telemetry: { traceId: execution.traceId, executionId: execution.executionId } });
      },
    });
  });

  it("rejects an invalid compensationPolicy value at compile time", () => {
    defineTool({
      id: "tradeos.athena.fixture.types-compensation",
      version: "1.0.0",
      owner: "athena-tool-sdk-tests",
      description: "type test",
      permissions: [],
      risk: "low",
      confirmationPolicy: "never",
      timeoutMs: 1_000,
      idempotency: "not_supported",
      // @ts-expect-error - "undo" is not a valid AthenaToolCompensationPolicy.
      compensationPolicy: "undo",
      inputSchema: z.object({}),
      async execute(_input, _aiContext, execution) {
        return successResult({ summary: "ok", data: null, telemetry: { traceId: execution.traceId, executionId: execution.executionId } });
      },
    });
  });

  it("types eventRef() as a fixed (type, id) constructor", () => {
    eventRef("JobScheduled", "evt_1");
    // @ts-expect-error - eventRef requires two string arguments.
    eventRef();
    // @ts-expect-error - the second argument must be a string, not a number.
    eventRef("JobScheduled", 123);
  });
});
