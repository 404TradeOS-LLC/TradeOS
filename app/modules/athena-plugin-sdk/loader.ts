import type { AthenaContextProviderDefinition } from "../athena-context-engine/types";
import type { AthenaToolDefinition } from "../athena-tool-registry/types";
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

export interface AthenaLoadedPlugin {
  manifest: AthenaPluginManifest;
  tools: AthenaToolDefinition[];
  contextProviders: AthenaContextProviderDefinition[];
  eventsConsumed: string[];
  eventsPublished: string[];
}

export function loadApprovedPlugin(input: {
  plugin: AthenaPluginPackage;
  review: AthenaPluginReviewRecord;
  grant: AthenaPluginGrant;
  registeredEventTypes: ReadonlySet<string>;
}): AthenaLoadedPlugin {
  const ctx: AthenaPluginRuntimeContext = {
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

  return {
    manifest: input.plugin.manifest,
    tools: [...input.plugin.tools],
    contextProviders: [...input.plugin.contextProviders],
    eventsConsumed: [...input.plugin.eventsConsumed],
    eventsPublished: [...input.plugin.eventsPublished],
  };
}
