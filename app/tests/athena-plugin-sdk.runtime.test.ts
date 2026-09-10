import {
  assertPluginContextProviderMayRun,
  assertPluginEventSubscriptionMayRun,
  assertPluginNetworkAllowed,
  assertPluginToolMayExecute,
  createApprovedPluginReview,
  installApprovedPlugin,
  transitionPluginGrant,
} from "../modules/athena-plugin-sdk";

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

function installedRuntime() {
  const review = createApprovedPluginReview({ manifest, reviewedBy: "reviewer" });
  const grant = installApprovedPlugin({ orgId: "org-1", manifest, review, installedBy: "owner-1" });
  return { manifest, review, grant };
}

describe("A13 plugin runtime sandbox", () => {
  test("allows only declared tools with reviewed permissions", () => {
    const ctx = installedRuntime();
    expect(() => assertPluginToolMayExecute(ctx, "com.example.weather-risk.assessJob", ["dispatch.manage"])).not.toThrow();
    expect(() => assertPluginToolMayExecute(ctx, "com.example.weather-risk.undeclared", ["dispatch.manage"])).toThrow("tool_not_declared");
    expect(() => assertPluginToolMayExecute(ctx, "com.example.weather-risk.assessJob", ["billing.write"])).toThrow("permission_not_granted");
  });

  test("allows only declared context providers", () => {
    const ctx = installedRuntime();
    expect(() => assertPluginContextProviderMayRun(ctx, "com.example.weather-risk.forecast")).not.toThrow();
    expect(() => assertPluginContextProviderMayRun(ctx, "com.example.weather-risk.hidden")).toThrow("context_provider_not_declared");
  });

  test("network is deny-by-default outside reviewed host list", () => {
    const ctx = installedRuntime();
    expect(() => assertPluginNetworkAllowed({ ...ctx, networkHost: "api.example.com" })).not.toThrow();
    expect(() => assertPluginNetworkAllowed({ ...ctx, networkHost: "metadata.google.internal" })).toThrow("network_host_not_granted");
  });

  test("event subscriptions require both A8 registration and explicit grant", () => {
    const ctx = installedRuntime();
    const registered = new Set(["JobScheduled", "InvoicePaid"]);
    expect(() => assertPluginEventSubscriptionMayRun(ctx, "JobScheduled", registered)).not.toThrow();
    expect(() => assertPluginEventSubscriptionMayRun(ctx, "InvoicePaid", registered)).toThrow("event_not_granted");
    expect(() => assertPluginEventSubscriptionMayRun(ctx, "PluginInventedEvent", registered)).toThrow("event_not_registered");
  });

  test("disabled grants cannot execute any capability", () => {
    const ctx = installedRuntime();
    const disabled = transitionPluginGrant(ctx.grant, "disabled");
    expect(() => assertPluginToolMayExecute({ ...ctx, grant: disabled }, "com.example.weather-risk.assessJob", ["dispatch.manage"])).toThrow("plugin_disabled");
  });
});
