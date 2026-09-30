import type {
  AthenaContextProviderDefinition,
  AthenaContextProviderFetchResult,
  AthenaContextProviderInput,
} from "../athena-context-engine/types";
import type {
  AthenaAIContext,
  AthenaToolDefinition,
  AthenaToolExecutionContext,
  AthenaToolResult,
} from "../athena-tool-registry/types";
import type { AthenaPluginGrant, AthenaPluginManifest, AthenaPluginReviewRecord } from "./types";
import {
  assertPluginContextProviderMayRun,
  assertPluginEventPublicationMayRun,
  assertPluginEventSubscriptionMayRun,
  assertPluginMayLoad,
  assertPluginToolMayExecute,
  type AthenaPluginRuntimeContext,
} from "./runtime";

export interface AthenaPluginPackage {
  manifest: AthenaPluginManifest;
  tools: AthenaToolDefinition[];
  contextProviders: AthenaContextProviderDefinition[];
  eventsConsumed: string[];
  eventsPublished: string[];
}

export interface AthenaPluginRuntimeAuthorization {
  review: AthenaPluginReviewRecord;
  grant: AthenaPluginGrant;
}

/** Host-owned lookup used on every invocation so disable/revoke and tenant changes take effect immediately. */
export interface AthenaPluginRuntimeAuthorizer {
  getCurrentAuthorization(input: {
    activeOrgId: string;
    pluginId: string;
    pluginVersion: string;
  }): Promise<AthenaPluginRuntimeAuthorization | null>;
}

/**
 * Host-owned isolation boundary. Implementations execute third-party code outside
 * the TradeOS process (for example a constrained worker/runtime) and enforce the
 * supplied network allowlist. Raw package callbacks are never invoked by the SDK.
 */
export interface AthenaPluginIsolatedExecutor {
  executeTool(input: {
    pluginId: string;
    pluginVersion: string;
    toolId: string;
    toolInput: unknown;
    aiContext: AthenaAIContext;
    execution: AthenaToolExecutionContext;
    allowedHosts: string[];
  }): Promise<AthenaToolResult>;
  provideContext(input: {
    pluginId: string;
    pluginVersion: string;
    providerId: string;
    providerInput: AthenaContextProviderInput;
    allowedHosts: string[];
  }): Promise<AthenaContextProviderFetchResult<unknown>>;
}

export interface AthenaLoadedPlugin {
  manifest: AthenaPluginManifest;
  tools: AthenaToolDefinition[];
  contextProviders: AthenaContextProviderDefinition[];
  eventsConsumed: string[];
  eventsPublished: string[];
}

async function currentContext(input: {
  activeOrgId: string;
  manifest: AthenaPluginManifest;
  authorizer: AthenaPluginRuntimeAuthorizer;
}): Promise<AthenaPluginRuntimeContext> {
  const current = await input.authorizer.getCurrentAuthorization({
    activeOrgId: input.activeOrgId,
    pluginId: input.manifest.id,
    pluginVersion: input.manifest.version,
  });
  if (!current) throw new Error("ATHENA_PLUGIN_SANDBOX_DENIED:plugin_not_installed");
  return { activeOrgId: input.activeOrgId, manifest: input.manifest, review: current.review, grant: current.grant };
}

/**
 * Validates an approved package and exposes only host-controlled adapters. The
 * executable callbacks supplied by a third-party package are never returned or
 * called directly inside the TradeOS process.
 */
export function loadApprovedPlugin(input: {
  activeOrgId: string;
  plugin: AthenaPluginPackage;
  review: AthenaPluginReviewRecord;
  grant: AthenaPluginGrant;
  registeredEventTypes: ReadonlySet<string>;
  runtimeAuthorizer: AthenaPluginRuntimeAuthorizer;
  isolatedExecutor: AthenaPluginIsolatedExecutor;
}): AthenaLoadedPlugin {
  const ctx: AthenaPluginRuntimeContext = {
    activeOrgId: input.activeOrgId,
    manifest: input.plugin.manifest,
    review: input.review,
    grant: input.grant,
  };
  const expectedOwner = `plugin:${input.plugin.manifest.id}`;

  assertPluginMayLoad(ctx);

  const packageToolIds = new Set(input.plugin.tools.map((tool) => tool.id));
  const packageProviderIds = new Set(input.plugin.contextProviders.map((provider) => provider.id));

  for (const declaredToolId of input.plugin.manifest.tools) {
    if (!packageToolIds.has(declaredToolId)) throw new Error(`ATHENA_PLUGIN_PACKAGE_MISSING_TOOL:${declaredToolId}`);
  }
  for (const tool of input.plugin.tools) {
    if (tool.owner !== expectedOwner) throw new Error(`ATHENA_PLUGIN_OWNER_MISMATCH:${tool.id}`);
    assertPluginToolMayExecute(ctx, tool.id, tool.permissions);
  }

  for (const declaredProviderId of input.plugin.manifest.contextProviders) {
    if (!packageProviderIds.has(declaredProviderId)) throw new Error(`ATHENA_PLUGIN_PACKAGE_MISSING_PROVIDER:${declaredProviderId}`);
  }
  for (const provider of input.plugin.contextProviders) {
    if (provider.owner !== expectedOwner) throw new Error(`ATHENA_PLUGIN_OWNER_MISMATCH:${provider.id}`);
    assertPluginContextProviderMayRun(ctx, provider.id);
    for (const permission of provider.permissions) {
      if (!input.grant.permissions.includes(permission)) throw new Error("ATHENA_PLUGIN_SANDBOX_DENIED:permission_not_granted");
    }
  }

  const consumed = new Set(input.plugin.eventsConsumed);
  const published = new Set(input.plugin.eventsPublished);
  for (const declared of input.plugin.manifest.eventsConsumed) {
    if (!consumed.has(declared)) throw new Error(`ATHENA_PLUGIN_PACKAGE_MISSING_EVENT_SUBSCRIPTION:${declared}`);
  }
  for (const eventType of input.plugin.eventsConsumed) {
    assertPluginEventSubscriptionMayRun(ctx, eventType, input.registeredEventTypes);
  }
  for (const declared of input.plugin.manifest.eventsPublished) {
    if (!published.has(declared)) throw new Error(`ATHENA_PLUGIN_PACKAGE_MISSING_EVENT_PUBLICATION:${declared}`);
  }
  for (const eventType of input.plugin.eventsPublished) {
    assertPluginEventPublicationMayRun(ctx, eventType, input.registeredEventTypes);
  }

  const tools = input.plugin.tools.map((tool): AthenaToolDefinition => ({
    ...tool,
    async execute(toolInput: unknown, aiContext: AthenaAIContext, execution: AthenaToolExecutionContext): Promise<AthenaToolResult> {
      const live = await currentContext({ activeOrgId: execution.orgId, manifest: input.plugin.manifest, authorizer: input.runtimeAuthorizer });
      assertPluginToolMayExecute(live, tool.id, tool.permissions);
      return input.isolatedExecutor.executeTool({
        pluginId: input.plugin.manifest.id,
        pluginVersion: input.plugin.manifest.version,
        toolId: tool.id,
        toolInput,
        aiContext,
        execution,
        allowedHosts: [...live.grant.allowedHosts],
      });
    },
  }));

  const contextProviders = input.plugin.contextProviders.map((provider): AthenaContextProviderDefinition => ({
    ...provider,
    async provide(providerInput: AthenaContextProviderInput): Promise<AthenaContextProviderFetchResult<unknown>> {
      const live = await currentContext({ activeOrgId: providerInput.orgId, manifest: input.plugin.manifest, authorizer: input.runtimeAuthorizer });
      assertPluginContextProviderMayRun(live, provider.id);
      for (const permission of provider.permissions) {
        if (!live.grant.permissions.includes(permission)) throw new Error("ATHENA_PLUGIN_SANDBOX_DENIED:permission_not_granted");
      }
      return input.isolatedExecutor.provideContext({
        pluginId: input.plugin.manifest.id,
        pluginVersion: input.plugin.manifest.version,
        providerId: provider.id,
        providerInput,
        allowedHosts: [...live.grant.allowedHosts],
      });
    },
  }));

  return {
    manifest: input.plugin.manifest,
    tools,
    contextProviders,
    eventsConsumed: [...input.plugin.eventsConsumed],
    eventsPublished: [...input.plugin.eventsPublished],
  };
}
