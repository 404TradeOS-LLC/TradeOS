import { z } from "zod";
import { createApprovedPluginReview, installApprovedPlugin, loadApprovedPlugin } from "../modules/athena-plugin-sdk";
import type { AthenaContextProviderDefinition } from "../modules/athena-context-engine/types";
import type { AthenaToolDefinition } from "../modules/athena-tool-registry/types";

const manifest = {
  id: "com.example.weather-risk",
  name: "Weather Risk Advisor",
  version: "1.0.0",
  publisher: "Example Inc",
  athenaContractVersion: "1.0.0",
  tools: ["com.example.weather-risk.assessJob"],
  contextProviders: ["com.example.weather-risk.forecast"],
  eventsConsumed: ["JobScheduled"],
  eventsPublished: [],
  permissions: ["dispatch.manage"],
  dataUse: { storesCustomerData: false, retentionDays: 0 },
  network: { allowedHosts: ["api.example.com"] },
};

const tool: AthenaToolDefinition = {
  id: "com.example.weather-risk.assessJob",
  version: "1.0.0",
  owner: "plugin:com.example.weather-risk",
  description: "Assess weather risk for a job.",
  permissions: ["dispatch.manage"],
  risk: "low",
  confirmationPolicy: "never",
  timeoutMs: 1000,
  idempotency: "not_supported",
  compensationPolicy: "none",
  inputSchema: z.object({}),
  async execute() {
    return { success: true, summary: "ok", data: null, events: [], warnings: [], followUps: [], telemetry: { traceId: "trace" } } as never;
  },
};

const provider: AthenaContextProviderDefinition = {
  id: "com.example.weather-risk.forecast",
  version: "1.0.0",
  owner: "plugin:com.example.weather-risk",
  name: "Weather forecast",
  priority: 1,
  section: "weather",
  description: "Plugin weather context.",
  permissions: ["dispatch.manage"],
  activation: "explicit_only",
  allowedIntents: [],
  freshnessTtlMs: 60_000,
  timeoutMs: 1000,
  maxItems: 1,
  maxBytes: 4096,
  sensitivity: "internal",
  cacheKeyPolicy: "tenant_actor_permission_input",
  criticality: "optional",
  failureBehavior: "omit",
  async provide() { return { data: {}, itemCount: 0, omittedFields: [] }; },
};

function fixture() {
  const review = createApprovedPluginReview({ manifest, reviewedBy: "reviewer" });
  const grant = installApprovedPlugin({ orgId: "org-1", manifest, review, installedBy: "owner-1" });
  return { review, grant };
}

describe("A13 approved plugin loader", () => {
  test("loads an exact approved package", () => {
    const { review, grant } = fixture();
    expect(loadApprovedPlugin({
      plugin: { manifest, tools: [tool], contextProviders: [provider], eventsConsumed: ["JobScheduled"], eventsPublished: [] },
      review,
      grant,
      registeredEventTypes: new Set(["JobScheduled"]),
    }).manifest.id).toBe(manifest.id);
  });

  test("rejects a tool spoofing first-party ownership", () => {
    const { review, grant } = fixture();
    expect(() => loadApprovedPlugin({
      plugin: { manifest, tools: [{ ...tool, owner: "tradeos-athena-tools" }], contextProviders: [provider], eventsConsumed: ["JobScheduled"], eventsPublished: [] },
      review,
      grant,
      registeredEventTypes: new Set(["JobScheduled"]),
    })).toThrow("ATHENA_PLUGIN_OWNER_MISMATCH");
  });

  test("rejects undeclared packaged capabilities", () => {
    const { review, grant } = fixture();
    expect(() => loadApprovedPlugin({
      plugin: { manifest, tools: [{ ...tool, id: "com.example.weather-risk.hidden" }], contextProviders: [provider], eventsConsumed: ["JobScheduled"], eventsPublished: [] },
      review,
      grant,
      registeredEventTypes: new Set(["JobScheduled"]),
    })).toThrow();
  });
});
