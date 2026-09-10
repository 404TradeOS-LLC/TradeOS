import type { AthenaPluginGrant, AthenaPluginManifest, AthenaPluginReviewRecord } from "./types";
import { assertPluginEventAllowed, assertPluginPermissionAllowed, assertPluginSandboxAllows } from "./sandbox";

export interface AthenaPluginRuntimeContext {
  manifest: AthenaPluginManifest;
  review: AthenaPluginReviewRecord;
  grant: AthenaPluginGrant;
}

export function assertPluginMayLoad(ctx: AthenaPluginRuntimeContext): void {
  assertPluginSandboxAllows(ctx);
}

export function assertPluginToolMayExecute(
  ctx: AthenaPluginRuntimeContext,
  toolId: string,
  permissions: string[],
): void {
  assertPluginMayLoad(ctx);
  if (!ctx.manifest.tools.includes(toolId)) {
    throw new Error("ATHENA_PLUGIN_SANDBOX_DENIED:tool_not_declared");
  }
  for (const permission of permissions) {
    assertPluginPermissionAllowed({ ...ctx, permission });
  }
}

export function assertPluginContextProviderMayRun(
  ctx: AthenaPluginRuntimeContext,
  providerId: string,
): void {
  assertPluginMayLoad(ctx);
  if (!ctx.manifest.contextProviders.includes(providerId)) {
    throw new Error("ATHENA_PLUGIN_SANDBOX_DENIED:context_provider_not_declared");
  }
}

export function assertPluginEventSubscriptionMayRun(
  ctx: AthenaPluginRuntimeContext,
  eventType: string,
  registeredEventTypes: ReadonlySet<string>,
): void {
  if (!registeredEventTypes.has(eventType)) {
    throw new Error("ATHENA_PLUGIN_SANDBOX_DENIED:event_not_registered");
  }
  assertPluginEventAllowed({ ...ctx, event: { direction: "consume", type: eventType } });
}

export function assertPluginEventPublicationMayRun(
  ctx: AthenaPluginRuntimeContext,
  eventType: string,
  registeredEventTypes: ReadonlySet<string>,
): void {
  if (!registeredEventTypes.has(eventType)) {
    throw new Error("ATHENA_PLUGIN_SANDBOX_DENIED:event_not_registered");
  }
  assertPluginEventAllowed({ ...ctx, event: { direction: "publish", type: eventType } });
}
