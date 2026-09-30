import { z } from "zod";
import {
  createApprovedPluginReview,
  installApprovedPlugin,
  loadApprovedPlugin,
  transitionPluginGrant,
  type AthenaPluginGrant,
  type AthenaPluginIsolatedExecutor,
  type AthenaPluginRuntimeAuthorizer,
} from "../modules/athena-plugin-sdk";
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

const rawToolExecute = jest.fn(async () => ({ success: true }));
const rawProviderProvide = jest.fn(async () => ({ data: {}, itemCount: 0, omittedFields: [] }));

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
  execute: rawToolExecute as never,
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
  provide: rawProviderProvide,
};

function fixture() {
  const review = createApprovedPluginReview({ manifest, reviewedBy: "reviewer" });
  let grant: AthenaPluginGrant = installApprovedPlugin({ orgId: "org-1", manifest, review, installedBy: "owner-1" });
  const runtimeAuthorizer: AthenaPluginRuntimeAuthorizer = {
    async getCurrentAuthorization(input) {
      if (input.activeOrgId !== grant.orgId || input.pluginId !== grant.pluginId || input.pluginVersion !== grant.pluginVersion) return null;
      return { review, grant };
    },
  };
  const isolatedExecutor: AthenaPluginIsolatedExecutor = {
    executeTool: jest.fn(async () => ({ success: true, summary: "isolated", data: null, events: [], warnings: [], followUps: [], telemetry: { traceId: "trace" } } as never)),
    provideContext: jest.fn(async () => ({ data: {}, itemCount: 0, omittedFields: [] })),
  };
  return { review, get grant() { return grant; }, setGrant(next: AthenaPluginGrant) { grant = next; }, runtimeAuthorizer, isolatedExecutor };
}

function load(f: ReturnType<typeof fixture>) {
  return loadApprovedPlugin({
    activeOrgId: "org-1",
    plugin: { manifest, tools: [tool], contextProviders: [provider], eventsConsumed: ["JobScheduled"], eventsPublished: [] },
    review: f.review,
    grant: f.grant,
    registeredEventTypes: new Set(["JobScheduled"]),
    runtimeAuthorizer: f.runtimeAuthorizer,
    isolatedExecutor: f.isolatedExecutor,
  });
}

describe("A13 approved plugin loader", () => {
  beforeEach(() => {
    rawToolExecute.mockClear();
    rawProviderProvide.mockClear();
  });

  test("loads an exact approved package", () => {
    const f = fixture();
    expect(load(f).manifest.id).toBe(manifest.id);
  });

  test("rejects a tool spoofing first-party ownership", () => {
    const f = fixture();
    expect(() => loadApprovedPlugin({
      activeOrgId: "org-1",
      plugin: { manifest, tools: [{ ...tool, owner: "tradeos-athena-tools" }], contextProviders: [provider], eventsConsumed: ["JobScheduled"], eventsPublished: [] },
      review: f.review,
      grant: f.grant,
      registeredEventTypes: new Set(["JobScheduled"]),
      runtimeAuthorizer: f.runtimeAuthorizer,
      isolatedExecutor: f.isolatedExecutor,
    })).toThrow("ATHENA_PLUGIN_OWNER_MISMATCH");
  });

  test("rejects undeclared packaged capabilities at the intended branch", () => {
    const f = fixture();
    expect(() => loadApprovedPlugin({
      activeOrgId: "org-1",
      plugin: { manifest, tools: [tool, { ...tool, id: "com.example.weather-risk.hidden" }], contextProviders: [provider], eventsConsumed: ["JobScheduled"], eventsPublished: [] },
      review: f.review,
      grant: f.grant,
      registeredEventTypes: new Set(["JobScheduled"]),
      runtimeAuthorizer: f.runtimeAuthorizer,
      isolatedExecutor: f.isolatedExecutor,
    })).toThrow("ATHENA_PLUGIN_SANDBOX_DENIED:tool_not_declared");
  });

  test("never invokes raw third-party callbacks in the TradeOS process", async () => {
    const f = fixture();
    const loaded = load(f);
    await loaded.tools[0].execute({}, {} as never, {
      executionId: "exec-1",
      requestId: "req-1",
      traceId: "trace-1",
      orgId: "org-1",
      actor: { type: "user", id: "user-1" },
      role: "owner",
      deadline: new Date(Date.now() + 1000),
      cancellationSignal: new AbortController().signal,
      featureFlags: [],
    });
    expect(rawToolExecute).not.toHaveBeenCalled();
    expect(f.isolatedExecutor.executeTool).toHaveBeenCalledTimes(1);
  });

  test("rechecks tenant and current grant on every invocation", async () => {
    const f = fixture();
    const loaded = load(f);
    f.setGrant(transitionPluginGrant(f.grant, "revoked"));
    await expect(loaded.tools[0].execute({}, {} as never, {
      executionId: "exec-1",
      requestId: "req-1",
      traceId: "trace-1",
      orgId: "org-1",
      actor: { type: "user", id: "user-1" },
      role: "owner",
      deadline: new Date(Date.now() + 1000),
      cancellationSignal: new AbortController().signal,
      featureFlags: [],
    })).rejects.toThrow("plugin_revoked");

    await expect(loaded.tools[0].execute({}, {} as never, {
      executionId: "exec-2",
      requestId: "req-2",
      traceId: "trace-2",
      orgId: "org-2",
      actor: { type: "user", id: "user-2" },
      role: "owner",
      deadline: new Date(Date.now() + 1000),
      cancellationSignal: new AbortController().signal,
      featureFlags: [],
    })).rejects.toThrow("plugin_not_installed");
  });
});
