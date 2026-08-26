import { describeAthenaToolContract } from "../modules/athena-tool-sdk";
import { createWeatherImpactTool } from "../modules/athena-tools/dispatcher/weatherImpact.tool";
import type { AthenaProviderSection } from "../modules/athena-kernel/types";

// A12 Business Tool Rollout, Dispatcher domain contract test. This tool has
// no service dependency (createWeatherImpactTool() takes no deps) - it only
// reads aiContext.weather, A3's not-yet-populated provider section (see
// athena-kernel/types.ts's AthenaAIContext module comment). The contract
// kit's own buildMinimalAthenaContext() leaves `weather` undefined, so the
// suite's own "executes valid input" assertion already exercises the
// no-context path; the two extra tests below make both the empty and
// populated cases explicit.

const baseExecution = {
  executionId: "exec-1",
  requestId: "req-1",
  traceId: "trace-1",
  orgId: "org-1",
  actor: { type: "user" as const, id: "user-1" },
  role: "owner" as const,
  deadline: new Date(Date.now() + 1000),
  cancellationSignal: new AbortController().signal,
  featureFlags: [],
};

describe("athena-tools dispatcher: weather-impact", () => {
  describeAthenaToolContract(createWeatherImpactTool(), {
    validInput: {},
    invalidInputs: [{ jobId: "not-a-uuid" }, { jobId: 123 }],
  });

  it("returns a successful result with null data and a warning when no weather context is available", async () => {
    const tool = createWeatherImpactTool();
    const result = await tool.execute({}, {} as never, baseExecution);
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
    expect(result.warnings).toEqual([
      { code: "athena_weather_context_unavailable", message: "No weather context is currently available for dispatch planning." },
    ]);
  });

  it("surfaces the provider section's data as-is when weather context is populated", async () => {
    const tool = createWeatherImpactTool();
    const weather: AthenaProviderSection<{ conditions: string }> = {
      status: "available",
      freshness: { status: "fresh", fetchedAt: new Date().toISOString(), cacheHit: false },
      sensitivity: "public",
      source: { providerId: "test-weather-provider", providerVersion: "1.0.0" },
      data: { conditions: "thunderstorms expected" },
      omittedFields: [],
      maxItems: 1,
      maxBytes: 1024,
    };
    const result = await tool.execute({}, { weather } as never, baseExecution);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ conditions: "thunderstorms expected" });
    expect(result.warnings).toEqual([]);
  });
});
