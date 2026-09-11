import { z } from "zod";
import { createAthenaToolRegistry } from "../modules/athena-tool-registry/registry";
import type { AthenaToolDefinition } from "../modules/athena-tool-registry/types";
import { computeCanonicalInputHash } from "../modules/athena-action-engine/inputHash";
import { evaluateAthenaChannelToolPolicy, isAthenaVoiceEnabled } from "../modules/athena-mobile/policy";
import { createChannelAwareAthenaToolRegistry } from "../modules/athena-mobile/toolRegistry";

function tool(overrides: Partial<AthenaToolDefinition> = {}): AthenaToolDefinition {
  return {
    id: "tradeos.athena.fixture.mobile-read",
    version: "1.0.0",
    owner: "test",
    description: "Read the selected field job.",
    permissions: [],
    risk: "low",
    confirmationPolicy: "never",
    timeoutMs: 1000,
    idempotency: "not_supported",
    compensationPolicy: "none",
    inputSchema: z.object({ jobId: z.string() }),
    async execute(_input, _context, execution) {
      return { success: true, summary: "ok", data: null, events: [], warnings: [], followUps: [], telemetry: { traceId: execution.traceId, executionId: execution.executionId } };
    },
    ...overrides,
  };
}

describe("A14 voice/mobile channel policy", () => {
  test("voice can be disabled independently", () => {
    expect(isAthenaVoiceEnabled({ ATHENA_VOICE_ENABLED: "false" })).toBe(false);
    expect(isAthenaVoiceEnabled({ ATHENA_VOICE_ENABLED: "true" })).toBe(true);
  });

  test("text and mobile do not inherit the voice kill switch", () => {
    const definition = tool();
    expect(evaluateAthenaChannelToolPolicy({ interaction: { channel: "text" }, tool: definition, validatedInput: {}, env: {} }).decision).toBe("allow");
    expect(evaluateAthenaChannelToolPolicy({ interaction: { channel: "mobile" }, tool: definition, validatedInput: {}, env: {} }).decision).toBe("allow");
  });

  test("voice refuses medium/high-risk tools even when voice is enabled", () => {
    for (const risk of ["medium", "high"] as const) {
      expect(evaluateAthenaChannelToolPolicy({ interaction: { channel: "voice" }, tool: tool({ risk }), validatedInput: {}, env: { ATHENA_VOICE_ENABLED: "true" } })).toEqual({
        decision: "deny",
        reasonCode: "athena_voice_risk_requires_visual_review",
      });
    }
  });

  test("low-risk read flow needs no confirmation", () => {
    expect(evaluateAthenaChannelToolPolicy({ interaction: { channel: "voice" }, tool: tool(), validatedInput: { jobId: "job-1" }, env: { ATHENA_VOICE_ENABLED: "true" } }).decision).toBe("allow");
  });

  test("low-risk contextual flow requires exact tool/version/input confirmation", () => {
    const definition = tool({ id: "tradeos.athena.fixture.mobile-status", confirmationPolicy: "contextual" });
    const input = { jobId: "job-1", status: "traveling" };
    const initial = evaluateAthenaChannelToolPolicy({ interaction: { channel: "voice" }, tool: definition, validatedInput: input, env: { ATHENA_VOICE_ENABLED: "true" } });
    expect(initial.decision).toBe("confirm");
    const hash = computeCanonicalInputHash(input);
    expect(evaluateAthenaChannelToolPolicy({
      interaction: { channel: "voice", voiceConfirmation: { toolId: definition.id, toolVersion: definition.version, inputHash: hash, confirmed: true } },
      tool: definition,
      validatedInput: input,
      env: { ATHENA_VOICE_ENABLED: "true" },
    }).decision).toBe("allow");
    expect(evaluateAthenaChannelToolPolicy({
      interaction: { channel: "voice", voiceConfirmation: { toolId: definition.id, toolVersion: definition.version, inputHash: hash, confirmed: true } },
      tool: definition,
      validatedInput: { ...input, status: "completed" },
      env: { ATHENA_VOICE_ENABLED: "true" },
    }).decision).toBe("confirm");
  });

  test("voice registry never discovers medium/high risk tools", () => {
    const registry = createAthenaToolRegistry();
    registry.register(tool());
    registry.register(tool({ id: "tradeos.athena.fixture.danger", risk: "high", confirmationPolicy: "always" }));
    const voice = createChannelAwareAthenaToolRegistry(registry, { channel: "voice" }, { ATHENA_VOICE_ENABLED: "true" });
    const discovered = voice.discover({ role: "owner", permissions: [], featureFlags: [] });
    expect(discovered.map((item) => item.id)).toEqual(["tradeos.athena.fixture.mobile-read"]);
    expect(voice.resolve("tradeos.athena.fixture.danger", "1.0.0").outcome).toBe("tool_not_found");
  });
});
